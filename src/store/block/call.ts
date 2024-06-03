import { computed, makeObservable, observable, override } from 'mobx';
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
import { MRef, UFRef, UFRefData } from '../../utils/ds';
import { LyricsBlock } from './lyrics';
import { CallsTrack } from './track';
import { MergeUFCommand } from '../../commands';

export enum CallType {
  Hi = 'Hi',
  Fu = 'Fu',
  Fuwa = 'Fuwa',
  Clap = '👏',
  U = 'U-',
  O = 'O-',
}

export interface CallBlockData extends BlockData {
  start: string;
  end: string;
  ref: UFRefData;
  text: string;
  newline?: boolean;
  space?: boolean;
}

export interface SingAlongBlockData extends BlockData {
  ref?: string;
  text: string;
}

export abstract class CallBlockBase
  extends BlockBase
  implements IWithText, IWithBottomText, IWithSpacing
{
  @observable
  protected text_: string = CallType.Hi;

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }

  //#region IWithSpacing
  abstract get newline(): boolean;
  abstract set newline(value: boolean);
  abstract get space(): boolean;
  abstract set space(value: boolean);
  //#endregion IWithSpacing

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
}

export class CallBlock extends CallBlockBase implements IWithSpacing {
  public override readonly type: BlockType = BlockType.Call;

  // Union find ref to self.
  protected readonly ref_ = new UFRef<CallBlock>(this);

  @observable
  public start = Timing.INVALID;

  @observable
  public end = Timing.INVALID;

  //#region IWithSpacing
  @observable
  public newline = false;

  @observable
  public space = false;
  //#endregion IWithSpacing

  @override
  public override get parent() {
    return this.parent_ as CallsTrack;
  }

  public constructor(id?: string) {
    super(id);
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

  /** Root of union find. */
  @computed
  public get group(): CallBlock {
    return this.ref_.value;
  }

  public get all(): Iterable<CallBlock> {
    return this.ref_.all;
  }

  @computed
  public get isRepeated() {
    return this.ref_.size > 1;
  }

  @computed
  public get isPreset() {
    return EnumValues(CallType).includes(this.text);
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

  public mergeCmd(other: CallBlock): MergeUFCommand<CallBlock> {
    return new MergeUFCommand<CallBlock>(this.ref_, other.ref_);
  }
  //#endregion Commands

  //#region ISerializable
  public override serialize(): CallBlockData {
    return RemoveUndefined(
      {
        ...super.serialize(),
        start: this.start.serialize(),
        end: this.end.serialize(),
        ref: this.ref_.serialize(),
        text: this.selfText,
        newline: this.newline,
        space: this.space,
      },
      true,
    );
  }

  public override deserialize(data: CallBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.start = Timing.Deserialize(data.start);
    this.end = Timing.Deserialize(data.end);
    this.ref_.deserialize(data.ref, data.context);
    this.text_ = data.text;
    this.newline = Boolean(data.newline);
    this.space = Boolean(data.space);
  }
  //#endregion ISerializable
}

export class SingAlongBlock extends CallBlockBase implements IWithSpacing {
  public override readonly type: BlockType = BlockType.SingAlong;
  public override readonly resizable = false;

  protected readonly ref_ = new MRef<LyricsBlock, SingAlongBlock>(this);

  public constructor(id?: string) {
    super(id);
    this.text_ = '';
    makeObservable(this);
  }

  @computed
  public get lyricsBlock(): LyricsBlock | undefined {
    return this.ref_.get();
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

  //#region IWithSpacing
  public get newline() {
    return this.lyricsBlock?.newline ?? false;
  }

  public set newline(value: boolean) {
    this.lyricsBlock!.newline = value;
  }

  public get space() {
    return this.lyricsBlock?.space ?? false;
  }

  public set space(value: boolean) {
    this.lyricsBlock!.space = value;
  }
  //#endregion IWithSpacing

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
