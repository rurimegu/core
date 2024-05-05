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
import { EnumValues, IWithText, RemoveUndefined, UserError } from '../../utils';
import { UFRef, UFRefData } from '../../utils/ds';
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
}

type CallBlockRefValueType = string | LyricsBlock;

export class CallBlock extends BlockBase implements IWithText {
  public override readonly type: BlockType = BlockType.Call;

  // Union find ref to text or LyricsBlock.
  protected readonly ref_ = new UFRef<CallBlockRefValueType>(CallType.Hi);

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

  replica(start: Timing): CallBlock {
    const ret = new CallBlock();
    ret.start = start;
    ret.end = start.add(this.end.sub(this.start));
    ret.ref_.set(this.ref_.value);
    return ret;
  }

  public get text() {
    const value = this.ref_.value;
    if (value instanceof LyricsBlock) {
      return value.text;
    }
    return value;
  }

  public set text(text: string) {
    if (this.ref_.value instanceof LyricsBlock) {
      throw new UserError('Cannot set text of CallBlock with LyricsBlock ref');
    }
    this.ref_.set(text);
  }

  @computed
  public get bottomText() {
    const value = this.ref_.value;
    if (value instanceof LyricsBlock) {
      return value.bottomText;
    }
    return value;
  }

  @computed
  public get isLyricsRef() {
    return this.ref_.value instanceof LyricsBlock;
  }

  @computed
  public get isRepeated() {
    return this.ref_.size > 1;
  }

  @computed
  public get isPreset() {
    const value = this.ref_.value;
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

  public mergeCmd(other: CallBlock): MergeUFCommand<CallBlockRefValueType> {
    return new MergeUFCommand<CallBlockRefValueType>(this.ref_, other.ref_);
  }
  //#endregion Commands

  //#region ISerializable
  public serialize(): CallBlockData {
    return RemoveUndefined({
      ...super.serialize(),
      start: this.start.toString(),
      end: this.end.toString(),
      ref: this.ref_.serialize(),
    });
  }

  @override
  public override deserialize(data: CallBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.start = Timing.Deserialize(data.start);
    this.end = Timing.Deserialize(data.end);
    this.ref_.deserialize(data.ref, data.context);
  }
  //#endregion ISerializable
}
