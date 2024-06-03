import {
  action,
  comparer,
  computed,
  makeObservable,
  observable,
  override,
} from 'mobx';
import { LyricsBlock } from './lyrics';
import { FloatRange, MAX_BAR, Timing } from '../range';
import {
  BlockType,
  BlockBase,
  BlockDataHelpers,
  ParentBlockBase,
  ParentWithTextData,
} from './base';
import { IWithText } from '../../utils/types';
import { CallBlockBase } from './call';
import { CommentBlock } from './comment';

export type TrackBlock = LyricsTrack | CallsTrack | CommentTrack;

interface TrackBlockData extends ParentWithTextData {
  seVolume: number;
  muted: boolean;
}

export abstract class TrackBlockBase<
  T extends BlockBase,
> extends ParentBlockBase<T> {
  @observable public text = 'New track';
  @observable public visibleRange = new FloatRange(0, MAX_BAR);

  //#region Audio
  @observable public seVolume = 1;
  @observable public muted = false;

  @action
  public setSeVolume(volume: number) {
    this.seVolume = volume;
  }

  @action
  public setMuted(muted: boolean) {
    this.muted = muted;
  }
  //#endregion Audio

  @override
  public override get start() {
    return Timing.ZERO;
  }

  @override
  public override get end() {
    return Timing.INFINITY;
  }

  @computed({ equals: comparer.shallow })
  public get visibleBlocks() {
    const ret = this.children.filter((block) =>
      this.visibleRange.overlaps(block.range),
    );
    return ret;
  }

  //#region ISerializable
  public override serialize(): TrackBlockData {
    return {
      ...super.serialize(),
      text: this.text,
      seVolume: this.seVolume,
      muted: this.muted,
    };
  }

  @override
  public override deserialize(data: TrackBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.text = data.text;
    if (data.seVolume !== undefined) this.seVolume = data.seVolume;
    this.muted = Boolean(data.muted);
  }
  //#endregion ISerializable
}

export class LyricsTrack
  extends TrackBlockBase<LyricsBlock>
  implements IWithText
{
  public readonly type = BlockType.LyricsTrack;

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }

  @computed({ equals: comparer.shallow })
  public get visibleNewlines() {
    return this.visibleBlocks.filter((block) => block.newline);
  }
}

export class CallsTrack extends TrackBlockBase<CallBlockBase> {
  public override readonly type = BlockType.CallsTrack;

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
    this.muted = true;
  }
}

export class CommentTrack extends TrackBlockBase<CommentBlock> {
  public override readonly type = BlockType.CommentTrack;

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }
}
