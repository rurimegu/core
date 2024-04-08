import { comparer, computed, makeObservable, observable, override } from 'mobx';
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

export type TrackBlock = LyricsTrack;

export abstract class TrackBlockBase<
  T extends BlockBase,
> extends ParentBlockBase<T> {}

export class LyricsTrack
  extends TrackBlockBase<LyricsBlock>
  implements IWithText
{
  public readonly type = BlockType.LyricsTrack;
  @observable public text = 'New track';
  @observable public visibleRange = new FloatRange(0, MAX_BAR);

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }

  @override
  public override get start() {
    return Timing.ZERO;
  }

  @override
  public override get end() {
    return Timing.INFINITY;
  }

  //#region ISerializable
  public override serialize(): ParentWithTextData {
    return {
      ...super.serialize(),
      text: this.text,
    };
  }

  @override
  public override deserialize(data: ParentWithTextData & BlockDataHelpers) {
    const ret = super.deserialize(data);
    this.text = data.text;
    return ret;
  }
  //#endregion ISerializable

  @computed({ equals: comparer.shallow })
  public get visibleBlocks() {
    return this.children.filter((block) =>
      this.visibleRange.overlaps(block.range),
    );
  }

  @computed({ equals: comparer.shallow })
  public get visibleNewlines() {
    return this.visibleBlocks.filter((block) => block.newline);
  }
}
