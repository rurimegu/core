import { BlockBase, LyricsBlock, ParentBlockBase } from './block';
import { BpmStore } from './bpm';

export class TagsInfo {
  public readonly timing: Record<string, number> = {};

  protected recordTag(tag: string, duration: number) {
    if (!this.timing[tag]) {
      this.timing[tag] = 0;
    }
    this.timing[tag] += duration;
  }

  public get maxDuration() {
    return Math.max(0, ...Object.values(this.timing));
  }

  public gatherInfo(bpm: BpmStore, block: BlockBase) {
    if (block instanceof LyricsBlock) {
      const duration =
        bpm.barToAudioTime(block.end) - bpm.barToAudioTime(block.start);
      for (const tag of block.tags) {
        this.recordTag(tag.id, duration);
      }
      return;
    }
    if (block instanceof ParentBlockBase) {
      for (const child of block.children) {
        this.gatherInfo(bpm, child);
      }
    }
  }
}
