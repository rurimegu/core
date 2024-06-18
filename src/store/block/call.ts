import { action, computed, makeObservable, observable, override } from 'mobx';
import { Timing } from '../range';
import {
  BlockBase,
  BlockData,
  BlockDataHelpers,
  BlockType,
  IResizeAction,
  ResizeBlockCmd,
} from './base';
import {
  EnumValues,
  IWithText,
  RemoveUndefined,
  IWithBottomText,
  UserError,
  IWithSpacing,
  Typeof,
  UniqueBy,
} from '../../utils';
import { MRef, RefGroup, RemoveRefFn } from '../../utils/ref';
import { LyricsBlock } from './lyrics';
import { CallsTrack } from './track';
import { RemoveBlocksCommand, Command } from '../../commands';

export enum CallType {
  Hi = 'Hi',
  Fu = 'Fu',
  Fuwa = 'Fuwa',
  Clap = '👏',
  U = 'U-',
  O = 'O-',
}

export interface CallBlockBaseData extends BlockData {
  newline?: boolean;
  space?: boolean;
}

export interface CallBlockData extends CallBlockBaseData {
  start: string;
  end: string;
  ref?: any; // TODO: remove
  group?: string;
  text: string;
}

export interface SingAlongBlockData extends CallBlockBaseData {
  ref?: string;
  text: string;
}

export class CallGroup extends RefGroup<CallBlock> {
  public constructor() {
    super();
    makeObservable(this);
  }

  @override
  public override push(...items: CallBlock[]): number {
    const ret = super.push(...items);
    this.arr.sort((a, b) => a.value!.start.compare(b.value!.start));
    return ret;
  }
}

export abstract class CallBlockBase
  extends BlockBase
  implements IWithText, IWithBottomText, IWithSpacing
{
  @observable
  protected text_: string = CallType.Hi;

  @observable
  public newline = false;

  @observable
  public space = false;

  public constructor() {
    super();
    makeObservable(this);
  }

  @override
  public override get parent() {
    return this.parent_ as CallsTrack;
  }

  @computed
  public get text() {
    return this.text_;
  }

  public set text(text: string) {
    this.text_ = text;
  }

  public get bottomText() {
    return this.text;
  }

  //#region ISerializable
  public override serialize(): CallBlockBaseData {
    return RemoveUndefined<CallBlockBaseData>(
      {
        ...super.serialize(),
        newline: this.newline,
        space: this.space,
      },
      true,
    );
  }

  public override deserialize(data: CallBlockBaseData & BlockDataHelpers) {
    super.deserialize(data);
    this.newline = Boolean(data.newline);
    this.space = Boolean(data.space);
  }
  //#endregion ISerializable
}

export class CallBlock extends CallBlockBase implements IWithSpacing {
  public override readonly type: BlockType = BlockType.Call;

  @observable
  protected group_?: CallGroup;

  @observable
  public start = Timing.INVALID;

  @observable
  public end = Timing.INVALID;

  @override
  public override get parent() {
    return this.parent_ as CallsTrack;
  }

  public constructor() {
    super();
    makeObservable(this);
  }

  /** Create a replica of the block at a different start time. */
  replica(start: Timing): CallBlock {
    const ret = new CallBlock();
    ret.start = start;
    ret.end = start.add(this.end.sub(this.start));
    ret.text = this.text;
    return ret;
  }

  @computed
  public get selfText(): string {
    return this.text_;
  }

  public set selfText(text: string) {
    this.text_ = text;
  }

  @override
  public override get text() {
    return this.group.selfText;
  }

  public override set text(text: string) {
    this.group.selfText = text;
  }

  @computed
  public get group(): CallBlock {
    return this.group_?.first ?? this;
  }

  @computed
  public get callGroup(): CallGroup | undefined {
    return this.isRepeated ? this.group_ : undefined;
  }

  public get all(): Iterable<CallBlock> {
    return this.group_ ?? [this];
  }

  @computed
  public get isRepeated() {
    return (this.group_?.length ?? 0) > 1;
  }

  @computed
  public get isPreset() {
    return EnumValues(CallType).includes(this.text);
  }

  @action
  public setGroup(group: CallGroup | undefined) {
    this.group_ = group;
  }

  //#region Commands
  public override resizeCmd(
    alignDiv: number,
    allowExpand: boolean,
    start?: Timing | undefined,
    end?: Timing | undefined,
    notifyParent?: boolean | undefined,
  ): IResizeAction {
    return ResizeBlockCmd(
      this,
      alignDiv,
      allowExpand,
      start,
      end,
      notifyParent,
    );
  }
  //#endregion Commands

  //#region ISerializable
  public override serialize(): CallBlockData {
    return RemoveUndefined(
      {
        ...super.serialize(),
        start: this.start.serialize(),
        end: this.end.serialize(),
        group: this.group_?.serialize(),
        text: this.selfText,
      },
      true,
    );
  }

  public override deserialize(data: CallBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.start = Timing.Deserialize(data.start);
    this.end = Timing.Deserialize(data.end);
    if (typeof data.ref === 'string') data.group = data.ref;
    if (data.group) {
      this.group_ = data.context.getOrCreate(data.group, () => {
        const gr = new CallGroup();
        gr.deserialize(data.group!);
        return gr;
      });
      this.group_.push(this);
    } else if (data.ref) {
      // Backfill: union find
      const findRoot = (d: any) => {
        const { id, ref } = d;
        if (ref) {
          data.context.set(id, d);
          data.context.runWhenReady(ref, findRoot);
          return;
        }
        this.group_ = data.context.getOrCreate(id, () => {
          const gr = new CallGroup();
          gr.deserialize(id);
          return gr;
        });
        this.group_.push(this);
        return;
      };
      findRoot(data.ref);
    }
    this.text_ = data.text;
  }
  //#endregion ISerializable
}

export class SingAlongBlock extends CallBlockBase implements IWithSpacing {
  public override readonly type: BlockType = BlockType.SingAlong;
  public override readonly resizable = false;

  protected static readonly REMOVE_LYRICS_REF_FN: RemoveRefFn<
    LyricsBlock,
    SingAlongBlock
  > = (r) =>
    r.container.parent
      ? new RemoveBlocksCommand(r.container.parent, r.container)
      : Command.Noop();

  protected readonly ref_ = new MRef<LyricsBlock, SingAlongBlock>(
    this,
    SingAlongBlock.REMOVE_LYRICS_REF_FN,
  );

  public constructor() {
    super();
    this.text_ = '';
    makeObservable(this);
  }

  @computed
  public get lyricsBlock(): LyricsBlock | undefined {
    return this.ref_.value;
  }

  public set lyricsBlock(block: LyricsBlock | undefined) {
    this.ref_.set(block);
  }

  @override
  public override get text() {
    return this.text_ || (this.lyricsBlock?.bottomText ?? '');
  }

  public override set text(text: string) {
    if (text === this.lyricsBlock?.bottomText) text = '';
    super.text = text;
  }

  @computed
  public get isOverriden(): boolean {
    return this.text_ !== '';
  }

  public override get start() {
    return this.lyricsBlock?.start ?? Timing.INVALID;
  }

  public override get end() {
    return this.lyricsBlock?.end ?? Timing.INVALID;
  }

  public override resizeCmd(): IResizeAction {
    throw new UserError('Cannot resize SingAlongBlock');
  }

  //#region ISerializable
  public override serialize(): SingAlongBlockData {
    return RemoveUndefined({
      ...super.serialize(),
      ref: this.lyricsBlock?.id,
      text: this.text_,
    });
  }

  public override deserialize(data: SingAlongBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.text_ = data.text;
    if (data.ref) {
      data.context.runWhenReady(data.ref, (block: LyricsBlock) => {
        this.lyricsBlock = block;
      });
    } else {
      this.lyricsBlock = undefined;
    }
  }
  //#endregion ISerializable
}

export function checkFullCallGroup(blocks: BlockBase[]) {
  const callBlocks = Typeof(blocks, CallBlock);
  const group = UniqueBy(callBlocks, (block) => block.group);
  if (group.some((g) => [...g.all].some((b) => !callBlocks.includes(b)))) {
    return false;
  }
  return true;
}
