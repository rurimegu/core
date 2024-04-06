import { makeObservable, override } from 'mobx';
import { BlockType, ParentBlockBase, ParentBlockData } from './base';
import { TrackBlock } from './track';
import { Timing } from '../range';

export type TracksData = ParentBlockData;

export class Tracks extends ParentBlockBase<TrackBlock> {
  public override readonly type = BlockType.Tracks;

  public constructor(id?: string) {
    super(id);
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
}
