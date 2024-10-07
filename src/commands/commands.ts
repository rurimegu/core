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
  IWithId,
  OfType,
} from '../utils/types';
import { TagsStore, LyricsTag } from '../store/tags';
import {
  AnnotationBlock,
  CallBlock,
  CallGroup,
  LyricsBlock,
  SingAlongBlock,
  TagsGroup,
} from '../store';
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
    for (let i = 0; i < this.commands.length; i++) {
      try {
        this.commands[i].execute();
      } catch (e) {
        for (let j = i - 1; j >= 0; j--) {
          this.commands[j].undo();
        }
        throw e;
      }
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
  protected deleteCmd: Command = Command.Noop();

  public constructor(
    public readonly block: IProviderOrValue<ITimingMutableBlock & IWithId>,
    public readonly start: Timing,
  ) {
    super();
  }

  public override execute(): void {
    const block = GetValue(this.block);
    this.prevStart = block.start;
    const refs = refManager.get(block.id);
    if (block instanceof AnnotationBlock) {
      refs.push(...refManager.get(block.parent.id));
    }
    // Find all references that became invalid after the resize
    this.deleteCmd = new CommandSet(
      OfType(
        refs.map((r) => r.container),
        SingAlongBlock,
      )
        .filter((b) => !b.isResizeValid(this.start, b.end))
        .map((b) => new RemoveBlocksCommand(b.parent, b)),
    );
    this.deleteCmd.execute();
    block.start = this.start;
  }

  public override undo(): void {
    GetValue(this.block).start = this.prevStart;
    this.deleteCmd.undo();
  }
}

export class SetBlockEndCommand extends Command {
  protected prevEnd: Timing = Timing.INVALID;
  protected deleteCmd: Command = Command.Noop();

  public constructor(
    public readonly block: IProviderOrValue<ITimingMutableBlock & IWithId>,
    public readonly end: Timing,
  ) {
    super();
  }

  public override execute(): void {
    const block = GetValue(this.block);
    this.prevEnd = block.end;
    const refs = refManager.get(block.id);
    if (block instanceof AnnotationBlock) {
      refs.push(...refManager.get(block.parent.id));
    }
    // Find all references that became invalid after the resize
    this.deleteCmd = new CommandSet(
      OfType(
        refs.map((r) => r.container),
        SingAlongBlock,
      )
        .filter((b) => !b.isResizeValid(b.start, this.end))
        .map((b) => new RemoveBlocksCommand(b.parent, b)),
    );
    this.deleteCmd.execute();
    block.end = this.end;
  }

  public override undo(): void {
    GetValue(this.block).end = this.prevEnd;
    this.deleteCmd.undo();
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

  public constructor(
    public readonly group: CallGroup | undefined,
    ...blocks: CallBlock[]
  ) {
    super();
    this.blocks = blocks;
  }

  public override execute(): void {
    this.prevGroups = this.blocks.map((b) => b.callGroup);
    this.blocks.forEach((b) => {
      b.setGroup(this.group);
    });
    this.group?.push(...this.blocks);
  }

  public override undo(): void {
    this.blocks.forEach((b, i) => {
      b.setGroup(this.prevGroups[i]);
    });
  }
}

export class UngroupCallsCommand extends GroupCallsCommand {
  public constructor(...blocks: CallBlock[]) {
    super(undefined, ...blocks);
  }
}
//#endregion Call Commands

//#region Tag Commands
export class SetTagsStoreCommand extends Command {
  protected prevTags: LyricsTag[] = [];
  protected deleteCmd: Command = Command.Noop();

  public constructor(
    public readonly store: TagsStore,
    public readonly tags: LyricsTag[],
  ) {
    super();
  }

  public override execute(): void {
    this.prevTags = this.store.tagList.map((t) => t.clone());
    const removed = this.store.replaceTags(this.tags);
    this.deleteCmd = new CommandSet(
      removed.map((t) => refManager.deleteCmd(t.id)),
    );
    this.deleteCmd.execute();
  }

  public override undo(): void {
    this.deleteCmd.undo();
    const removed = this.store.replaceTags(this.prevTags);
    new CommandSet(removed.map((t) => refManager.deleteCmd(t.id))).execute();
  }
}

export class AddTagsCommand extends Command {
  public tags: LyricsTag[];
  public constructor(
    public readonly target: TagsGroup,
    ...tags: LyricsTag[]
  ) {
    super();
    this.tags = tags;
  }

  public override execute(): void {
    this.tags = this.tags.filter((tag) =>
      this.target.values.every((t) => t.id !== tag.id),
    );
    this.target.push(...this.tags);
  }

  public override undo(): void {
    this.target.remove(...this.tags);
  }
}

export class RemoveTagsCommand extends Command {
  public tags: LyricsTag[];
  public constructor(
    public readonly target: TagsGroup,
    ...tags: LyricsTag[]
  ) {
    super();
    this.tags = tags;
  }

  public override execute(): void {
    this.tags = this.tags.filter((tag) =>
      this.target.values.some((t) => t.id === tag.id),
    );
    this.target.remove(...this.tags);
  }

  public override undo(): void {
    this.target.push(...this.tags);
  }
}
//#endregion Tag Commands
