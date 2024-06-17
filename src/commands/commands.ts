import {
  BlockBase,
  IMergable,
  ITimingMutableBlock,
  ParentBlockBase,
} from '../store/block/base';
import { Timing } from '../store/range';
import {
  IWithText,
  GetValue,
  ICopyable,
  IProviderOrValue,
  IWithSpacing,
  NoopFn,
  UndoFunc,
} from '../utils/types';
import { TagsStore, LyricsTag, TagsRef } from '../store/tags';
import { AnnotationBlock, CallBlock, CallGroup, LyricsBlock } from '../store';
import { refManager } from '../utils/ref';

//#region Command Base
export abstract class Command {
  /**
   * Executes the command without adding it to the history.
   * Only use when you know what you are doing. For common use cases,
   * use CommandManager.
   */
  abstract execute(): void;
  abstract undo(): void;

  public reverse(): Command {
    return new ReverseCommand(this);
  }

  public get isNoop(): boolean {
    return (
      this instanceof NoopCommand ||
      (this instanceof CommandSet && this.commands.length === 0)
    );
  }

  public static Noop() {
    return NoopCommand.V;
  }
}

export class ReverseCommand extends Command {
  constructor(public readonly command: Command) {
    super();
  }

  public override execute(): void {
    this.command.undo();
  }

  public override undo(): void {
    this.command.execute();
  }

  public override reverse(): Command {
    return this.command;
  }
}

export class CommandSet extends Command {
  public constructor(public readonly commands: Command[] = []) {
    super();
  }

  public add(...commands: Command[]): void {
    for (const command of commands.filter((c) => !c.isNoop)) {
      if (command instanceof CommandSet) {
        this.commands.push(...command.commands);
      } else {
        this.commands.push(command);
      }
    }
  }

  public top(): Command | undefined {
    return this.commands[this.commands.length - 1];
  }

  public pop(): Command | undefined {
    return this.commands.pop();
  }

  public clear(): void {
    this.commands.length = 0;
  }

  public override execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  public override undo(): void {
    for (const command of this.commands.slice().reverse()) {
      command.undo();
    }
  }
}

export class NoopCommand extends Command {
  public static readonly V = new NoopCommand();
  execute(): void {
    return;
  }
  undo(): void {
    return;
  }

  protected constructor() {
    super();
  }
}

export class DynamicCommand extends Command {
  protected undoFn: UndoFunc = NoopFn;

  public constructor(protected readonly executeFn: () => UndoFunc) {
    super();
  }

  public override execute(): void {
    this.undoFn = this.executeFn();
  }

  public override undo(): void {
    this.undoFn();
    this.undoFn = NoopFn;
  }
}
//#endregion Command Base

//#region Block Commands
export class RemoveBlocksCommand<T extends BlockBase> extends Command {
  protected prevBlocks: T[] = [];
  protected cs = new CommandSet();
  protected idx = -1;

  public constructor(
    public readonly parent: ParentBlockBase<T>,
    public readonly item: number | T,
    public readonly count = 1,
  ) {
    super();
  }

  public override execute(): void {
    this.idx =
      typeof this.item === 'number'
        ? this.item
        : this.parent.indexOf(this.item);
    if (this.idx < 0) return;
    this.prevBlocks = this.parent.splice(this.idx, this.count);
    this.cs.clear();
    this.cs.add(...this.prevBlocks.map((b) => refManager.deleteCmd(b.id)));
    this.cs.execute();
  }

  public override undo(): void {
    if (this.idx < 0) return;
    this.cs.undo();
    this.parent.splice(this.idx, 0, ...this.prevBlocks);
  }
}

export class AddBlocksCommand<T extends BlockBase> extends Command {
  public constructor(
    public readonly parent: ParentBlockBase<BlockBase>,
    public readonly blocks: T[] | T,
    public readonly idx: number,
  ) {
    super();
  }

  public override execute(): void {
    const blocks = Array.isArray(this.blocks) ? this.blocks : [this.blocks];
    this.parent.splice(this.idx, 0, ...blocks);
  }

  public override undo(): void {
    const length = Array.isArray(this.blocks) ? this.blocks.length : 1;
    this.parent.splice(this.idx, length);
  }
}

export class MergeBlocksCommand<
  T extends BlockBase & IMergable<T> & ICopyable<T>,
> extends Command {
  protected prevBlocks: T[] = [];

  public constructor(
    public readonly parent: IProviderOrValue<ParentBlockBase<T>>,
    public readonly blockIdxStart: number,
    public readonly count: number,
  ) {
    super();
  }

  public override execute(): void {
    const parent = GetValue(this.parent);
    const newBlock = parent.children[this.blockIdxStart].newCopy();
    for (
      let i = this.blockIdxStart + 1;
      i < this.blockIdxStart + this.count;
      i++
    ) {
      newBlock.mergeRight(parent.children[i].newCopy());
    }
    this.prevBlocks = parent.splice(this.blockIdxStart, this.count, newBlock);
  }

  public override undo(): void {
    GetValue(this.parent).splice(this.blockIdxStart, 1, ...this.prevBlocks);
  }
}
export class SetTextCommand extends Command {
  protected prevText = '';

  public constructor(
    public readonly block: IProviderOrValue<IWithText>,
    public readonly text: string,
  ) {
    super();
  }

  public override execute(): void {
    const block = GetValue(this.block);
    this.prevText = block.text;
    block.text = this.text;
  }

  public override undo(): void {
    const block = GetValue(this.block);
    block.text = this.prevText;
  }
}

export class SetSimpleBlockCommand extends CommandSet {
  public constructor(block: LyricsBlock, alignDiv: number, text: string) {
    super([
      new SetTextCommand(block, ''),
      new ReplaceChildrenCommand(block, alignDiv, [
        AnnotationBlock.Create(text, block.start, block.end),
      ]),
    ]);
  }
}

export class SetBlockStartCommand extends Command {
  protected prevStart: Timing = Timing.INVALID;

  public constructor(
    public readonly block: IProviderOrValue<ITimingMutableBlock>,
    public readonly start: Timing,
  ) {
    super();
  }

  public override execute(): void {
    this.prevStart = GetValue(this.block).start;
    GetValue(this.block).start = this.start;
  }

  public override undo(): void {
    GetValue(this.block).start = this.prevStart;
  }
}

export class SetBlockEndCommand extends Command {
  protected prevEnd: Timing = Timing.INVALID;

  public constructor(
    public readonly block: IProviderOrValue<ITimingMutableBlock>,
    public readonly end: Timing,
  ) {
    super();
  }

  public override execute(): void {
    this.prevEnd = GetValue(this.block).end;
    GetValue(this.block).end = this.end;
  }

  public override undo(): void {
    GetValue(this.block).end = this.prevEnd;
  }
}

export class ReplaceChildrenCommand<T extends BlockBase> extends Command {
  protected prevChildren: BlockBase[] = [];
  protected readonly resizeCmd: Command;

  public constructor(
    public readonly parent: ParentBlockBase<BlockBase>,
    alignDiv: number,
    public readonly children: T[],
  ) {
    super();
    const grandParent = parent.parent;
    if (grandParent) {
      this.resizeCmd = grandParent.resizeChildCmd(
        parent,
        alignDiv,
        children[0].start,
        children[children.length - 1].end,
      );
    } else {
      this.resizeCmd = Command.Noop();
    }
  }

  public override execute(): void {
    this.prevChildren = this.parent.children.slice();
    this.resizeCmd.execute();
    this.parent.replace(this.children);
  }

  public override undo(): void {
    this.parent.replace(this.prevChildren);
    this.resizeCmd.undo();
  }
}

export class SetNewlineCommand extends Command {
  protected prevNewline = false;

  public constructor(
    public readonly block: IProviderOrValue<IWithSpacing>,
    public readonly newline: boolean,
  ) {
    super();
  }

  public override execute(): void {
    const block = GetValue(this.block);
    this.prevNewline = block.newline;
    block.newline = this.newline;
  }

  public override undo(): void {
    GetValue(this.block).newline = this.prevNewline;
  }
}

export class SetSpaceCommand extends Command {
  protected prevSpace = false;

  public constructor(
    public readonly block: IProviderOrValue<IWithSpacing>,
    public readonly space: boolean,
  ) {
    super();
  }

  public override execute(): void {
    const block = GetValue(this.block);
    this.prevSpace = block.space;
    block.space = this.space;
  }

  public override undo(): void {
    GetValue(this.block).space = this.prevSpace;
  }
}
//#endregion Block Commands

//#region Call Commands
/** Puts all blocks into a new call group. Will remove them from existing call group if any. */
export class GroupCallsCommand extends Command {
  protected prevGroups: (CallGroup | undefined)[] = [];
  protected readonly blocks: CallBlock[];
  protected readonly group = new CallGroup();

  public constructor(...blocks: CallBlock[]) {
    super();
    this.blocks = blocks;
  }

  public override execute(): void {
    this.prevGroups = this.blocks.map((b) => b.callGroup);
    this.blocks.forEach((b) => {
      b.callGroup?.remove(b);
      b.setGroup(this.group);
    });
    this.group.push(...this.blocks);
  }

  public override undo(): void {
    this.group.remove(...this.blocks);
    this.blocks.forEach((b, i) => {
      b.setGroup(this.prevGroups[i]);
      this.prevGroups[i]?.push(b);
    });
  }
}
//#endregion Call Commands

//#region Tag Commands
export class SetTagsStoreCommand extends Command {
  protected prevTags: LyricsTag[] = [];

  public constructor(
    public readonly store: TagsStore,
    public readonly tags: LyricsTag[],
  ) {
    super();
  }

  public override execute(): void {
    this.prevTags = [...this.store.tagList];
    this.store.replaceTags(this.tags);
  }

  public override undo(): void {
    this.store.replaceTags(this.prevTags);
  }
}

export class AddTagsCommand extends Command {
  public readonly tags: string[];
  public constructor(
    public readonly target: TagsRef,
    ...tags: string[]
  ) {
    super();
    this.tags = tags;
  }

  public override execute(): void {
    this.tags.forEach((tag) => this.target.addTag(tag));
  }

  public override undo(): void {
    this.tags.forEach((tag) => this.target.removeTag(tag));
  }
}

export class RemoveTagsCommand extends AddTagsCommand {
  public override execute(): void {
    super.undo();
  }

  public override undo(): void {
    super.execute();
  }
}
//#endregion Tag Commands
