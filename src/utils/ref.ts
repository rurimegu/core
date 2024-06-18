import { observable, makeObservable, action, computed } from 'mobx';
import { IWithId, IClonable, UndoFunc } from './types';
import { Command, CommandSet, DynamicCommand } from '../commands';
import { ISerializable } from './io';
import { persistStore } from '../store';
import { ValueError } from './error';

export class RefManager {
  protected readonly refs = new Map<string, MRef<any, any>[]>();

  public unset(id: string, ref: MRef<any, any>) {
    const refs = this.refs.get(id);
    if (refs) {
      const index = refs.indexOf(ref);
      if (index >= 0) {
        refs.splice(index, 1);
      }
    }
  }

  public set(id: string, value: MRef<any, any>) {
    const refs = this.refs.get(id);
    if (refs) {
      refs.push(value);
    } else {
      this.refs.set(id, [value]);
    }
  }

  public deleteCmd(id: string): Command {
    const refs = this.refs.get(id)?.slice();
    if (refs) {
      const cs = new CommandSet();
      cs.add(...refs.map((r) => r.removeRefCmd()));
      cs.add(
        new DynamicCommand(() => {
          const undoFuncs = refs.map((r) => r.set(undefined));
          undoFuncs.reverse();
          return () => {
            undoFuncs.forEach((f) => f());
          };
        }),
      );
      return cs;
    } else {
      return Command.Noop();
    }
  }

  public clear() {
    this.refs.clear();
  }
}

export const refManager = new RefManager();

export type RemoveRefFn<T extends IWithId, U> = (value: MRef<T, U>) => Command;
export function NoopRemoveRef(): Command {
  return Command.Noop();
}

export class MRef<T extends IWithId, U> implements IClonable<MRef<T, U>> {
  @observable
  protected value_?: T;

  public constructor(
    public readonly container: U,
    public readonly removeRefFn: RemoveRefFn<T, U>,
    value?: T,
  ) {
    this.set(value);
    makeObservable(this);
  }

  public get value(): T | undefined {
    return this.value_;
  }

  @action
  public set(value: T | undefined): UndoFunc {
    const oldValue = this.value_;
    if (oldValue) refManager.unset(oldValue.id, this);
    this.value_ = value;
    if (value) refManager.set(value.id, this);
    return () => this.set(oldValue);
  }

  public removeRefCmd(): Command {
    if (!this.value_) return Command.Noop();
    return this.removeRefFn(this);
  }

  //#region IClonable
  public clone(): MRef<T, U> {
    return new MRef<T, U>(this.container, this.removeRefFn, this.value_);
  }
  //#endregion IClonable
}

export class RefGroup<T extends IWithId> implements ISerializable {
  @observable
  public id: string;

  @observable
  protected readonly arr = observable.array<MRef<T, this>>([], {
    deep: false,
  });

  protected static REMOVE_REF_FN<T extends IWithId>(
    r: MRef<T, RefGroup<T>>,
  ): Command {
    return new DynamicCommand(() => {
      const idx = r.container.arr.indexOf(r);
      r.container.arr.splice(idx, 1);
      return () => {
        r.container.arr.splice(idx, 0, r);
      };
    });
  }

  protected createRef(item: T): MRef<T, this> {
    const ref = new MRef<T, this>(this, RefGroup.REMOVE_REF_FN);
    ref.set(item);
    return ref;
  }

  public constructor() {
    this.id = `cg-${persistStore.nextId}`;
    makeObservable(this);
  }

  @action
  public push(...items: T[]): number {
    const ret = this.arr.push(...items.map((i) => this.createRef(i)));
    return ret;
  }

  @action
  public remove(...items: T[]): void {
    items.forEach((item) => {
      const idx = this.arr.findIndex((r) => r.value === item);
      if (idx < 0)
        throw new ValueError(
          `Cannot remove ${item.id} from RefGroup ${this.id} : not found`,
        );
      this.arr.splice(idx, 1);
    });
  }

  @action
  public replace(...items: T[]): void {
    this.arr.replace(items.map((i) => this.createRef(i)));
  }

  *[Symbol.iterator](): IterableIterator<T> {
    for (const ref of this.arr) {
      yield ref.value!;
    }
  }

  @computed
  public get first() {
    return this.arr[0]?.value;
  }

  @computed
  public get last() {
    return this.arr[this.arr.length - 1]?.value;
  }

  @computed
  public get length() {
    return this.arr.length;
  }

  //#region ISerializable
  public serialize(): string {
    return this.id;
  }

  public deserialize(data: string): void {
    this.id = data;
  }
  //#endregion ISerializable
}
