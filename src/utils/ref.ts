import { observable, makeObservable, action } from 'mobx';
import { IWithId, IClonable, UndoFunc } from './types';
import { Command, CommandSet, DynamicCommand } from '../commands';

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

type RemoveRefFn<T> = (value: T) => Command;

export class MRef<T extends IWithId, U> implements IClonable<MRef<T, U>> {
  @observable
  protected value?: T;

  public constructor(
    public readonly parent: U,
    public readonly removeRefFn: RemoveRefFn<MRef<T, U>>,
    value?: T,
  ) {
    this.set(value);
    makeObservable(this);
  }

  public get(): T | undefined {
    return this.value;
  }

  @action
  public set(value: T | undefined): UndoFunc {
    const oldValue = this.value;
    if (oldValue) refManager.unset(oldValue.id, this);
    this.value = value;
    if (value) refManager.set(value.id, this);
    return () => this.set(oldValue);
  }

  public removeRefCmd(): Command {
    if (!this.value) return Command.Noop();
    return this.removeRefFn(this);
  }

  //#region IClonable
  public clone(): MRef<T, U> {
    return new MRef<T, U>(this.parent, this.removeRefFn, this.value);
  }
  //#endregion IClonable
}
