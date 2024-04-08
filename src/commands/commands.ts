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
  IWithNewline,
} from '../utils/types';
import { TagsStore, LyricsTag, TagsRef } from '../store/tags';

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

  public execute(): void {
    this.command.undo();
  }

  public undo(): void {
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

  public execute(): void {
    for (const command of this.commands) {
      command.execute();
    }
  }

  public undo(): void {
    for (const command of this.commands.reverse()) {
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

//#endregion Command Base

//#region Block Commands
export class RemoveBlocksCommand<T extends BlockBase> extends Command {
  protected prevBlocks: T[] = [];
  protected idx = -1;

  public constructor(
    public readonly parent: ParentBlockBase<T>,
    public readonly item: number | T,
    public readonly count = 1,
  ) {
    super();
  }

  public execute(): void {
    if (typeof this.item !== 'number') {
      this.idx = this.parent.indexOf(this.item);
    } else {
      this.idx = this.item;
    }
    this.prevBlocks = this.parent.splice(this.idx, this.count);
  }

  public undo(): void {
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

  public execute(): void {
    const blocks = Array.isArray(this.blocks) ? this.blocks : [this.blocks];
    this.parent.splice(this.idx, 0, ...blocks);
  }

  public undo(): void {
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

  public execute(): void {
    const parent = GetValue(this.parent);
    const newBlock = parent.children[this.blockIdxStart].newCopy();
    for (
      let i = this.blockIdxStart + 1;
      i < this.blockIdxStart + this.count;
      i++
    ) {
      newBlock.mergeRight(parent.children[i]);
    }
    this.prevBlocks = parent.splice(this.blockIdxStart, this.count, newBlock);
  }

  public undo(): void {
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

  public execute(): void {
    const block = GetValue(this.block);
    this.prevText = block.text;
    block.text = this.text;
  }

  public undo(): void {
    const block = GetValue(this.block);
    block.text = this.prevText;
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

  public execute(): void {
    this.prevStart = GetValue(this.block).start;
    GetValue(this.block).start = this.start;
  }

  public undo(): void {
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

  public execute(): void {
    this.prevEnd = GetValue(this.block).end;
    GetValue(this.block).end = this.end;
  }

  public undo(): void {
    GetValue(this.block).end = this.prevEnd;
  }
}

export class ReplaceChildrenCommand<T extends BlockBase> extends Command {
  protected prevChildren: BlockBase[] = [];

  public constructor(
    public readonly parent: ParentBlockBase<BlockBase>,
    public readonly children: T[],
  ) {
    super();
  }

  public execute(): void {
    this.prevChildren = this.parent.children;
    this.parent.replace(this.children);
  }

  public undo(): void {
    this.parent.replace(this.prevChildren);
  }
}

export class SetNewlineCommand extends Command {
  protected prevNewline = false;

  public constructor(
    public readonly block: IProviderOrValue<IWithNewline>,
    public readonly newline: boolean,
  ) {
    super();
  }

  public execute(): void {
    const block = GetValue(this.block);
    this.prevNewline = block.newline;
    block.newline = this.newline;
  }

  public undo(): void {
    GetValue(this.block).newline = this.prevNewline;
  }
}
//#endregion Block Commands

//#region Tag Commands
export class SetTagsStoreCommand extends Command {
  protected prevTags: LyricsTag[] = [];

  public constructor(
    public readonly store: TagsStore,
    public readonly tags: LyricsTag[],
  ) {
    super();
  }

  public execute(): void {
    this.prevTags = [...this.store.tagList];
    this.store.replaceTags(this.tags);
  }

  public undo(): void {
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

  public execute(): void {
    this.tags.forEach((tag) => this.target.addTag(tag));
  }

  public undo(): void {
    this.tags.forEach((tag) => this.target.removeTag(tag));
  }
}

export class RemoveTagsCommand extends AddTagsCommand {
  public execute(): void {
    super.undo();
  }

  public undo(): void {
    super.execute();
  }
}
//#endregion Tag Commands
