import { action, makeObservable, override } from 'mobx';
import { BlockType, ParentBlockBase, ParentBlockData } from './base';
import { CallsTrack, CommentTrack, LyricsTrack, TrackBlock } from './track';
import { Timing } from '../range';

export type TracksData = ParentBlockData;

export class Tracks extends ParentBlockBase<TrackBlock> {
  public override readonly childTypes = [LyricsTrack, CallsTrack, CommentTrack];
  public override readonly type = BlockType.Tracks;

  public constructor() {
    super();
    this.id_ = 'main-tracks';
    this.clear();
    makeObservable(this);
  }

  @override
  public override get start(): Timing {
    return Timing.INVALID;
  }

  @override
  public override get end(): Timing {
    return Timing.INVALID;
  }

  @action
  public clear() {
    this.children_.replace([]);
    this.children_.push(new LyricsTrack());
  }
}
