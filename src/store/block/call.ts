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
  UserError,
  SerializeIdOrString,
  IsId,
  GetIdOrString,
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
  value: string;
}

export class CallBlock extends BlockBase implements IWithText {
  public override readonly type: BlockType = BlockType.Call;

  // Union find ref to self.
  protected readonly ref_ = new UFRef<CallBlock>(this);

  @observable
  protected value_: string | MRef<LyricsBlock> = CallType.Hi;

  @observable
  public start = Timing.INVALID;

  @observable
  public end = Timing.INVALID;

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
    ret.value_ = this.value_;
    return ret;
  }

  @computed
  public get text() {
    const value = this.group.selfValue;
    return typeof value === 'string' ? value : value.text;
  }

  public set text(text: string) {
    const value = this.group;
    if (typeof value.value_ !== 'string') {
      throw new UserError('Cannot set text of CallBlock with LyricsBlock ref');
    }
    value.value_ = text;
  }

  /** Root of union find. */
  @computed
  public get group(): CallBlock {
    return this.ref_.value;
  }

  @computed
  protected get selfValue(): string | LyricsBlock {
    const value = this.value_;
    return typeof value === 'string' ? value : value.get() ?? '';
  }

  @computed
  public get parentValue(): string | LyricsBlock {
    return this.group.selfValue;
  }

  @computed
  public get bottomText() {
    const value = this.parentValue;
    return typeof value === 'string' ? value : value.bottomText;
  }

  @computed
  public get isLyricsRef() {
    return typeof this.parentValue !== 'string';
  }

  @computed
  public get isRepeated() {
    return this.ref_.size > 1;
  }

  @computed
  public get isPreset() {
    const value = this.parentValue;
    return typeof value === 'string' && EnumValues(CallType).includes(value);
  }

  //#region Commands
  public resizeCmd(
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
  public serialize(): CallBlockData {
    const value = this.selfValue;
    return RemoveUndefined({
      ...super.serialize(),
      start: this.start.toString(),
      end: this.end.toString(),
      ref: this.ref_.serialize(),
      value: SerializeIdOrString(value),
    });
  }

  @override
  public override deserialize(data: CallBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.start = Timing.Deserialize(data.start);
    this.end = Timing.Deserialize(data.end);
    this.ref_.deserialize(data.ref, data.context);
    const value = GetIdOrString(data.value);
    if (IsId(data.value)) {
      data.context.runWhenReady(value, (value: LyricsBlock) => {
        this.value_ = new MRef(value);
      });
    } else {
      this.value_ = value;
    }
  }
  //#endregion ISerializable
}
