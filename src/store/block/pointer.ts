import { observable, makeObservable, computed, action } from 'mobx';
import { ValueError, InvalidStateError } from '../../utils/error';
import { Direction } from '../../utils/math';
import { IClonable } from '../../utils/types';
import { ParentBlockBase, BlockBase } from './base';

export class BlockPointer implements IClonable<BlockPointer> {
  @observable
  public parent: ParentBlockBase<BlockBase>;

  @observable
  public idx: number;

  constructor(parent: ParentBlockBase<BlockBase>, idx: number) {
    this.parent = parent;
    this.idx = idx;
    makeObservable(this);
  }

  public static FromLocator(
    parent: ParentBlockBase<BlockBase>,
    ...loc: number[]
  ) {
    if (loc.length === 0) throw new ValueError('No locator provided');
    let current: BlockBase | ParentBlockBase<BlockBase> = parent;
    for (const idx of loc) {
      if (!(current instanceof ParentBlockBase)) {
        throw new ValueError(`Invalid parent block: ${current.id}`);
      }
      if (idx < 0) return BlockPointer.REnd(parent);
      if (idx >= current.length) return BlockPointer.End(parent);
      current = current.children[idx];
    }
    return BlockPointer.FromBlock(current);
  }

  public static FromBlock(block: BlockBase) {
    if (!block.parent) throw new ValueError('Block has no parent');
    return new BlockPointer(block.parent, block.parent.indexOf(block));
  }

  public static REnd(parent: ParentBlockBase<BlockBase>) {
    while (parent.parent) parent = parent.parent;
    while (parent.first instanceof ParentBlockBase) parent = parent.first;
    return new BlockPointer(parent, -1);
  }

  public static End(parent: ParentBlockBase<BlockBase>) {
    while (parent.parent) parent = parent.parent;
    while (parent.last instanceof ParentBlockBase) parent = parent.last;
    return new BlockPointer(parent, parent.length);
  }

  @computed
  protected get locator(): [BlockBase, number[]] {
    const ret = [this.idx];
    let current = this.parent;
    while (current.parent) {
      const idx = current.parent.indexOf(current);
      if (idx < 0) {
        throw new InvalidStateError(
          `Invalid block: ${current.id}. Is it already removed?`,
        );
      }
      ret.push(idx);
      current = current.parent;
    }
    ret.reverse();
    return [current, ret];
  }

  @computed
  public get isREnd() {
    return this.idx < 0;
  }

  @computed
  public get isEnd() {
    return this.idx >= this.parent.length;
  }

  @computed
  public get block(): BlockBase | undefined {
    return this.parent.children[this.idx];
  }

  public clone() {
    return new BlockPointer(this.parent, this.idx);
  }

  protected moveHelper() {
    if (this.idx < this.parent.length) return;
  }

  @action
  public moveNext(): this {
    if (this.isEnd) return this;
    this.idx++;
    if (this.idx >= this.parent.length) {
      let current = this.parent;
      while (current.parent && current.parent.last === current) {
        current = current.parent;
      }
      if (!current.parent || current.parent.last === current) {
        // Single layer or reached the end.
        return this;
      }
      const idx = current.parent.indexOf(current);
      if (idx < 0) {
        throw new InvalidStateError(
          `Invalid block: ${current.id}. Is it already removed?`,
        );
      }
      const nextBlock = current.parent.children[idx + 1];
      if (!(nextBlock instanceof ParentBlockBase)) {
        this.parent = current.parent;
        this.idx = idx + 1;
        return this;
      }
      current = nextBlock;
      while (current.first instanceof ParentBlockBase) {
        current = current.first;
      }
      this.parent = current;
      this.idx = 0;
      return this;
    }
    return this;
  }

  @action
  public movePrev(): this {
    if (this.isREnd) return this;
    this.idx--;
    if (this.idx < 0) {
      let current = this.parent;
      while (current.parent && current.parent.first === current) {
        current = current.parent;
      }
      if (!current.parent || current.parent.first === current) {
        // Single layer or reached the beginning.
        return this;
      }
      const idx = current.parent.indexOf(current);
      if (idx < 0) {
        throw new InvalidStateError(
          `Invalid block: ${current.id}. Is it already removed?`,
        );
      }
      const prevBlock = current.parent.children[idx - 1];
      if (!(prevBlock instanceof ParentBlockBase)) {
        this.parent = current.parent;
        this.idx = idx;
        return this;
      }
      current = prevBlock;
      while (current.last instanceof ParentBlockBase) {
        current = current.last;
      }
      this.parent = current;
      this.idx = current.length - 1;
      return this;
    }
    return this;
  }

  public asIterator(direction: Direction = Direction.RIGHT) {
    return new BlockIterator(this, direction);
  }
}

export class BlockIterator implements Iterator<BlockBase>, Iterable<BlockBase> {
  protected first = true;

  constructor(
    public readonly pointer: BlockPointer,
    public readonly direction: Direction = Direction.RIGHT,
  ) {}

  [Symbol.iterator](): Iterator<BlockBase> {
    return this;
  }

  public get block() {
    return this.pointer.block;
  }

  public next(): IteratorResult<BlockBase, undefined> {
    if (!this.first) {
      if (this.direction === Direction.LEFT) this.pointer.movePrev();
      else this.pointer.moveNext();
    } else {
      this.first = false;
    }

    if (this.pointer.isEnd || this.pointer.isREnd)
      return { done: true, value: undefined };

    return {
      done: false,
      value: this.block!,
    };
  }
}
