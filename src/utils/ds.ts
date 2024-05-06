import { observable, makeObservable, action, computed } from 'mobx';
import { IClonable, IWithId, NoopFn, SimpleFunc } from './types';
import { InvalidStateError, ValueError } from './error';
import { ISerializable } from './io';
import { persistStore } from '../store';

/**
 * A double-ended queue that auto resizes.
 */
export class Deque<T> {
  protected static MIN_HALF_CAPACITY = 16;
  protected items: T[] = [];
  protected frontIdx = Deque.MIN_HALF_CAPACITY;
  protected backIdx = Deque.MIN_HALF_CAPACITY;

  protected resize(newHalfCap: number) {
    if (newHalfCap < Deque.MIN_HALF_CAPACITY) {
      console.warn(
        `Deque is too small while resizing to ${newHalfCap}, expect at least ${Deque.MIN_HALF_CAPACITY}`,
      );
      return;
    }

    const items = this.items.slice(this.frontIdx, this.backIdx);
    this.items = [];
    this.frontIdx = newHalfCap;
    this.backIdx = newHalfCap + items.length;
    for (let i = 0; i < items.length; i++) {
      this.items[this.frontIdx + i] = items[i];
    }
  }

  protected maybeResize() {
    const length = this.backIdx - this.frontIdx;
    if (this.frontIdx === 0) {
      // No empty slots in front
      this.resize(Math.max(Deque.MIN_HALF_CAPACITY, length));
    } else if (this.frontIdx > length * 3) {
      // Too many empty slots in front
      this.resize(Math.max(Deque.MIN_HALF_CAPACITY, length));
    }
  }

  public get length() {
    return this.backIdx - this.frontIdx;
  }

  public get empty() {
    return this.backIdx === this.frontIdx;
  }

  public get front() {
    if (this.empty) return undefined;
    return this.items[this.frontIdx];
  }

  public get back() {
    if (this.empty) return undefined;
    return this.items[this.backIdx - 1];
  }

  public pushBack(item: T) {
    this.maybeResize();
    this.items[this.backIdx++] = item;
  }

  public pushFront(item: T) {
    this.maybeResize();
    this.items[--this.frontIdx] = item;
  }

  public popFront() {
    if (this.empty) {
      console.warn('Deque is empty while popping front');
      return undefined;
    }
    return this.items[this.frontIdx++];
  }

  public popBack() {
    if (this.empty) {
      console.warn('Deque is empty while popping back');
      return undefined;
    }
    return this.items[--this.backIdx];
  }

  public clear() {
    this.frontIdx = this.backIdx = Deque.MIN_HALF_CAPACITY;
    this.items = [];
  }
}

export class RedoQueue<T> extends Deque<T> {
  private undoneSteps = 0;

  protected get headIdx() {
    return this.backIdx - this.undoneSteps;
  }

  public get canRecover() {
    return this.undoneSteps > 0;
  }

  public override get empty() {
    return this.frontIdx === this.headIdx;
  }

  public override get back() {
    if (this.empty) return undefined;
    return this.items[this.headIdx - 1];
  }

  public override pushBack(item: T) {
    this.backIdx = this.headIdx;
    super.pushBack(item);
    this.undoneSteps = 0;
  }

  public override popBack() {
    if (this.empty) {
      console.warn('RedoQueue is empty while popping back');
      return undefined;
    }
    this.undoneSteps++;
    return this.items[this.headIdx];
  }

  public override clear() {
    super.clear();
    this.undoneSteps = 0;
  }

  public recoverBack() {
    if (!this.canRecover) {
      console.warn('RedoQueue has nothing to recover');
      return undefined;
    }
    this.undoneSteps--;
    return this.back;
  }
}

export function RangeArray(end: number): number[];
export function RangeArray(start: number, end: number, step?: number): number[];

export function RangeArray(startOrEnd: number, end = NaN, step = 1): number[] {
  let start = 0;
  if (!isNaN(end)) {
    start = startOrEnd;
  } else {
    end = startOrEnd;
  }

  const length = Math.max(0, Math.ceil((end - start) / step));
  return Array.from({ length }, (_, i) => start + i * step);
}

export type FutureExecutor = (obj: any) => any;
export class FutureMap {
  protected readonly map = new Map<string, any>();
  protected readonly futureMap = new Map<string, FutureExecutor[]>();

  public set(key: string, value: any) {
    this.map.set(key, value);
    const future = this.futureMap.get(key);
    if (future) {
      for (const executor of future) {
        executor(value);
      }
      this.futureMap.delete(key);
    }
  }

  public get(key: string) {
    return this.map.get(key);
  }

  public runWhenReady(key: string, executor: FutureExecutor) {
    const value = this.map.get(key);
    if (value !== undefined) {
      executor(value);
    } else {
      let future = this.futureMap.get(key);
      if (!future) {
        future = [];
        this.futureMap.set(key, future);
      }
      future.push(executor);
    }
  }

  public get unresolvedCount() {
    return this.futureMap.size;
  }
}

export class RefManager {
  protected readonly refs = new Map<string, MRef<any>[]>();

  public unset(id: string, ref: MRef<any>) {
    const refs = this.refs.get(id);
    if (refs) {
      const index = refs.indexOf(ref);
      if (index >= 0) {
        refs.splice(index, 1);
      }
    }
  }

  public get(id: string): MRef<any>[] | undefined {
    return this.refs.get(id);
  }

  public set(id: string, value: MRef<any>) {
    let refs = this.refs.get(id);
    if (!refs) {
      refs = [];
      this.refs.set(id, refs);
    }
    refs.push(value);
  }

  public delete(id: string) {
    const refs = this.refs.get(id);
    if (refs) {
      for (const ref of refs.slice()) {
        ref.set(undefined);
      }
    }
  }

  public clear() {
    this.refs.clear();
  }

  public recover<T extends IWithId>(target: T, ...values: MRef<any>[]) {
    for (const value of values) {
      value.set(target);
    }
  }
}

export const refManager = new RefManager();

export class MRef<T extends IWithId> implements IClonable<MRef<T>> {
  @observable
  protected value?: T;

  constructor(value?: T) {
    this.set(value);
    makeObservable(this);
  }

  public get(): T | undefined {
    return this.value;
  }

  @action
  public set(value: T | undefined) {
    if (this.value) {
      refManager.unset(this.value.id, this);
    }
    this.value = value;
    if (value) {
      refManager.set(value.id, this);
    }
  }

  //#region IClonable
  public clone(): MRef<T> {
    return new MRef<T>(this.value);
  }
  //#endregion IClonable
}

export interface UFRefData {
  ref?: string;
  value: string;
  size: number;
}

/**
 * A reference maintained by union find.
 */
export class UFRef<T extends IWithId> implements IWithId, ISerializable {
  public readonly id: string;

  @observable
  protected ref_?: UFRef<T>;

  protected value_: T;

  @observable
  protected size_ = 1;

  @observable
  protected readonly children_ = observable.set<UFRef<T>>([], {
    deep: false,
  });

  constructor(value: T) {
    if (value instanceof UFRef) {
      throw new ValueError('Cannot create UFRef to another UFRef');
    }
    this.id = `uf-${persistStore.nextId}`;
    this.value_ = value;
    makeObservable(this);
  }

  @computed
  public get value(): T {
    return this._root.value_;
  }

  @computed
  protected get _root(): UFRef<T> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node: UFRef<T> = this;
    while (node.ref_ !== undefined) {
      node = node.ref_;
    }
    return node;
  }

  @computed
  public get size() {
    return this._root.size_;
  }

  protected *_getAllValues(): Iterable<T> {
    if (this.value_) yield this.value_;
    for (const child of this.children_) {
      for (const item of child._getAllValues()) {
        yield item;
      }
    }
  }

  @computed
  public get all(): Iterable<T> {
    return this._root._getAllValues();
  }

  protected _addChild(child: UFRef<T>) {
    child.ref_ = this;
    this.children_.add(child);
    this.size_ += child.size_;
  }

  @action
  public merge(rhs: UFRef<T>): SimpleFunc {
    let root1 = this._root;
    let root2 = rhs._root;
    if (root1 === root2) return NoopFn;
    if (root1.size_ < root2.size_) {
      [root1, root2] = [root2, root1];
    }
    root1._addChild(root2);
    return () => root2.unmerge();
  }

  @action
  public unmerge() {
    if (this.ref_ === undefined) {
      throw new InvalidStateError('Cannot unmerge root of union find');
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let node: UFRef<T> = this;
    while (node.ref_ instanceof UFRef) {
      const parent = node.ref_;
      parent.size_ -= this.size_;
      parent.children_.delete(node);
      node = parent;
    }
    this.ref_ = undefined;
  }

  //#region ISerializable
  serialize(): UFRefData {
    return {
      ref: this.ref_?.id,
      value: this.value_.id,
      size: this.size_,
    };
  }

  deserialize(data: UFRefData, future: FutureMap) {
    this.size_ = data.size;
    if (data.ref) {
      future.runWhenReady(data.ref, (value: UFRef<T>) => {
        this.ref_ = value;
      });
    }
    future.runWhenReady(data.value, (value: T) => {
      this.value_ = value;
    });
  }
  //#endregion ISerializable
}
