import {
  IObservableArray,
  action,
  comparer,
  computed,
  makeObservable,
  observable,
  override,
} from 'mobx';
import { UserError, ValueError } from '../../utils/error';
import { Timing, TimingRange } from '../range';
import {
  Finalizer,
  IFinalizable,
  ISerializable,
  LookupFunc,
} from '../../utils/io';
import { persistStore } from '../persist';
import {
  AddBlocksCommand,
  Command,
  CommandSet,
  SetBlockEndCommand,
  SetBlockStartCommand,
} from '../../commands';
import { Bisect } from '../../utils/math';
import { SMALL_DS_THRESHOLD } from '../../utils/constants';
import { Constructor, IWithId } from '../../utils/types';

export enum BlockType {
  Unknown = 'Unknown',
  Lyrics = 'Lyrics',
  LyricsTrack = 'LyricsTrack',
  Tracks = 'Tracks',
  Annotation = 'Annotation',
}

export interface IMergable<T> {
  mergeRight(other: T): void;
}

export interface ITimingMutableBlock {
  set start(value: Timing);
  set end(value: Timing);
}

export interface BlockData {
  type: BlockType;
  id: string;
  parent?: string;
}

export interface BlockDataHelpers {
  create(data: BlockData): [BlockBase, Finalizer<BlockBase>];
}

export interface ParentBlockData extends BlockData {
  children: BlockData[];
}

export interface ParentWithTextData extends ParentBlockData {
  text: string;
}

export interface ParentOptionalTextData extends ParentBlockData {
  text?: string;
}

export interface IResizeAction {
  start: Timing;
  end: Timing;
  cmd: Command;
}

export abstract class BlockBase
  implements ISerializable, IFinalizable<BlockBase>, IWithId
{
  @observable
  protected id_: string;

  abstract readonly type: BlockType;
  public abstract get start(): Timing;
  public abstract get end(): Timing;

  public constructor(id?: string) {
    this.id_ = id || `bl-${persistStore.nextId}`;
    makeObservable(this);
  }

  @computed({ equals: TimingRange.EqualityComparer })
  public get range(): TimingRange {
    return new TimingRange(this.start, this.end);
  }

  @computed
  public get id() {
    return this.id_;
  }

  @observable
  protected parent_?: ParentBlockBase<BlockBase>;

  @action
  public setParent(value: ParentBlockBase<BlockBase> | undefined) {
    this.parent_ = value;
  }

  public getParent<T extends BlockBase>(type: Constructor<T>): T | undefined {
    if (this instanceof type) return this;
    return this.parent?.getParent(type);
  }

  @computed
  public get parent(): ParentBlockBase<BlockBase> | undefined {
    return this.parent_;
  }

  @computed({ equals: comparer.shallow })
  public get noopResizeAction(): IResizeAction {
    return { start: this.start, end: this.end, cmd: Command.Noop() };
  }

  //#region ISerializable
  public serialize(): BlockData {
    return {
      type: this.type,
      id: this.id,
      parent: this.parent?.id,
    };
  }

  @action
  public deserialize(data: BlockData) {
    this.id_ = data.id;
    return (blockGetter: LookupFunc<BlockBase>) => {
      if (data.parent)
        this.setParent(blockGetter(data.parent) as ParentBlockBase<BlockBase>);
    };
  }
  //#endregion ISerializable

  //#region Commands
  public abstract resizeCmd(
    alignDiv: number,
    allowExpand: boolean,
    start?: Timing,
    end?: Timing,
    notifyParent?: boolean,
  ): IResizeAction;
  //#endregion Commands
}

export abstract class ParentBlockBase<T extends BlockBase>
  extends BlockBase
  implements Iterable<T>
{
  @observable
  protected children_ = observable.array<T>([], { deep: false });

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }

  public get children(): IObservableArray<T> {
    return this.children_;
  }

  public indexOf(child: T) {
    if (this.length <= SMALL_DS_THRESHOLD) return this.children_.indexOf(child);
    const idx = Bisect(this.children, (c) => c.start.compare(child.start) < 0);
    if (this.children[idx] !== child) return -1;
    return idx;
  }

  @computed
  public get length() {
    return this.children_.length;
  }

  @computed({ equals: Timing.EqualityComparer })
  public get start(): Timing {
    if (this.length === 0) {
      console.warn(`No children for ${this.constructor.name}`);
      return Timing.INVALID;
    }
    return this.children_[0].start;
  }

  @computed({ equals: Timing.EqualityComparer })
  public get end(): Timing {
    if (this.length === 0) {
      console.warn(`No children for ${this.constructor.name}`);
      return Timing.INVALID;
    }
    return this.children_[this.length - 1].end;
  }

  @computed
  public get first(): T {
    return this.children_[0];
  }

  @computed
  public get last(): T {
    return this.children_[this.length - 1];
  }

  [Symbol.iterator](): Iterator<T> {
    return this.children[Symbol.iterator]();
  }

  public push(...items: T[]) {
    this.children_.push(...items);
    for (const item of items) {
      item.setParent(this);
    }
  }

  public replace(items: T[]) {
    this.children_.replace(items);
    for (const item of items) {
      item.setParent(this);
    }
  }

  @action
  public splice(start: number, deleteCount: number, ...items: T[]) {
    for (const item of items) {
      item.setParent(this);
    }
    return this.children_.splice(start, deleteCount, ...items);
  }

  //#region ISerializable
  public override serialize(): ParentBlockData {
    return {
      ...super.serialize(),
      children: this.children.map((c) => c.serialize()),
    };
  }

  @override
  public override deserialize(data: ParentBlockData & BlockDataHelpers) {
    const parentFinalizer = super.deserialize(data);
    const results = data.children.map((c) => data.create(c));
    const blocks = results.map((r) => r[0]) as T[];
    const finalizers = results.map((r) => r[1]);
    this.replace(blocks);
    return (blockGetter: LookupFunc<BlockBase>) => {
      for (const finalizer of finalizers) finalizer(blockGetter);
      parentFinalizer(blockGetter);
    };
  }
  //#endregion ISerializable

  //#region Commands
  /**
   * Checks if the previous child block needs to be resized.
   * @param idx Index of the child block
   * @param alignDiv Alignment division
   * @param nextStart Start time of the next child block
   * @returns New timing of the previous block
   */
  protected checkPrevChild(
    idx: number,
    alignDiv: number,
    nextStart: Timing,
  ): IResizeAction {
    if (idx === 0)
      return { start: nextStart, end: Timing.INVALID, cmd: Command.Noop() };
    const prev = this.children_[idx - 1];
    if (prev.end.compare(nextStart) <= 0) return prev.noopResizeAction;
    return prev.resizeCmd(alignDiv, false, prev.start, nextStart, false);
  }

  /**
   * Checks if the next child block needs to be resized.
   * @param idx Index of the child block
   * @param alignDiv Alignment division
   * @param prevEnd End time of the previous child block
   * @returns End time of the last modified block
   */
  protected checkNextChild(
    idx: number,
    alignDiv: number,
    prevEnd: Timing,
  ): IResizeAction {
    const cs = new CommandSet();
    const children = this.children;
    for (let i = idx + 1; i < this.length; i++) {
      const block = children[i];
      if (block.start.compare(prevEnd) >= 0) break;
      const start = prevEnd;
      const resizeInfo = block.resizeCmd(
        alignDiv,
        true,
        start,
        block.end,
        false,
      );
      cs.add(resizeInfo.cmd);
      if (resizeInfo.end.compare(prevEnd) <= 0) {
        prevEnd = resizeInfo.end;
        break;
      }
      prevEnd = resizeInfo.end;
    }
    return { start: Timing.INVALID, end: prevEnd, cmd: cs };
  }

  public resizeChildCmd(
    child: T,
    alignDiv: number,
    start: Timing = Timing.INVALID,
    end: Timing = Timing.INVALID,
    notifyParent = true,
  ): Command {
    if (!start.isValid) start = child.start;
    if (!end.isValid) end = child.end;
    const idx = this.indexOf(child);
    const cs = new CommandSet();
    const leftInfo = this.checkPrevChild(idx, alignDiv, start);
    const newStart =
      leftInfo.start.compare(this.start) < 0 ? leftInfo.start : this.start;
    const rightInfo = this.checkNextChild(idx, alignDiv, end);
    const newEnd =
      rightInfo.end.compare(this.end) > 0 ? rightInfo.end : this.end;
    if (!newStart.equals(this.start) || !newEnd.equals(this.end)) {
      if (notifyParent && this.parent) {
        cs.add(
          this.parent.resizeChildCmd(this, alignDiv, newStart, newEnd, true),
        );
      }
    }
    cs.add(leftInfo.cmd);
    cs.add(rightInfo.cmd);
    return cs;
  }

  public override resizeCmd(
    alignDiv: number,
    allowExpand: boolean,
    start: Timing = Timing.INVALID,
    end: Timing = Timing.INVALID,
    notifyParent = true,
  ): IResizeAction {
    if (!start.isValid) start = this.start;
    if (!end.isValid) end = this.end;
    const cs = new CommandSet();
    if (!start.equals(this.start)) {
      const info = this.checkNextChild(-1, alignDiv, start);
      if (info.end.compare(end) > 0) {
        if (!allowExpand) {
          throw new UserError(
            `Block ${
              this.id
            } is not allowed to expand after resize: ${start.serialize()} to ${end.serialize()}`,
          );
        }
        end = info.end;
      }
      cs.add(info.cmd);
    }
    if (!end.equals(this.end)) {
      const info = this.last.resizeCmd(
        alignDiv,
        allowExpand,
        this.last.start,
        end,
        false,
      );
      end = info.end;
      cs.add(info.cmd);
    }
    if (cs.commands.length > 0 && notifyParent && this.parent) {
      cs.add(this.parent.resizeChildCmd(this, alignDiv, start, end, true));
    }
    return { start, end, cmd: cs };
  }

  public insertCmd(alignDiv: number, ...items: T[]): Command {
    if (items.length === 0) {
      throw new UserError('No blocks to insert');
    }
    const start = items[0].start;
    if (start.compare(this.start) < 0) {
      throw new ValueError(
        `Inserted blocks (${start}) is before ${this.id} (${this.start})`,
      );
    }
    const end = items[items.length - 1].end;
    const idx = Bisect(this.children, (b) => b.end.compare(start) <= 0);
    if (idx < this.length) {
      const child = this.children[idx];
      if (child.start.compare(start) < 0) {
        throw new ValueError(`Inserted blocks overlaps with ${child.id}`);
      }
    }
    // Get enough space for the new blocks
    const cs = new CommandSet();
    const rightInfo = this.checkNextChild(idx - 1, alignDiv, end);
    const newEnd =
      rightInfo.end.compare(this.end) > 0 ? rightInfo.end : this.end;
    if (!newEnd.equals(this.end) && this.parent) {
      cs.add(
        this.parent.resizeChildCmd(this, alignDiv, this.start, newEnd, true),
      );
    }
    cs.add(rightInfo.cmd);
    cs.add(new AddBlocksCommand(this, items, idx));
    return cs;
  }
  //#endregion Commands
}

//#region Commands
export function ResizeBlockCmd<T extends BlockBase>(
  block: T & ITimingMutableBlock,
  alignDiv: number,
  allowExpand: boolean,
  start: Timing = Timing.INVALID,
  end: Timing = Timing.INVALID,
  notifyParent = true,
): IResizeAction {
  if (!start.isValid) start = block.start;
  if (!end.isValid) end = block.end;
  const minEnd = start.lowerBound(alignDiv).next();
  if (end.compare(minEnd) < 0) {
    if (!allowExpand) {
      throw new UserError(
        `Block ${
          block.id
        } too short after resize: ${start.serialize()} to ${end.serialize()}`,
      );
    }
    end = minEnd;
  }
  if (block.start.equals(start) && block.end.equals(end))
    return block.noopResizeAction;
  const cs = new CommandSet();
  if (notifyParent && block.parent) {
    cs.add(block.parent.resizeChildCmd(block, alignDiv, start, end, true));
  }
  if (!block.start.equals(start)) {
    cs.add(new SetBlockStartCommand(block, start));
  }
  if (!block.end.equals(end)) {
    cs.add(new SetBlockEndCommand(block, end));
  }
  return { start, end, cmd: cs };
}
//#endregion Commands
