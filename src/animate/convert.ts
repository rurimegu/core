import {
  AnnotationBlock,
  CallBlock,
  CallsTrack,
  CommentBlock,
  CommentTrack,
  LyricsBlock,
  LyricsStore,
  LyricsTrack,
  SingAlongBlock,
} from '../store';
import { RangeArray, Typeof, Unreachable } from '../utils';
import { AnimateConfig } from './config';
import {
  AnnotationRenderData,
  CallBlockRenderData,
  CallLineRenderData,
  CommentRenderData,
  CommentTrackRenderData,
  LyricsBlockRenderData,
  LyricsLineRenderData,
  LyricsRenderData,
  LyricsTrackRenderData,
} from './render-data';
import { AnimateTiming } from './timing';

type LyricsLineTrack = LyricsTrack | CallsTrack;

class LyricsMerger {
  protected readonly head: number[];

  public constructor(public readonly tracks: LyricsLineTrack[]) {
    this.head = RangeArray(tracks.length).map(() => 0);
  }

  protected getLyricsHeadBlock(track: LyricsLineTrack) {}

  protected getCallHeadBlock(track: CallsTrack) {}

  protected getHeadBlock(track: LyricsLineTrack) {
    if (track instanceof LyricsTrack) {
      return this.getLyricsHeadBlock(track);
    } else if (track instanceof CallsTrack) {
      return this.getCallHeadBlock(track);
    } else {
      throw new Unreachable(`${track} is not a valid track type.`);
    }
  }

  public get isEnd() {
    return this.head.every((i) => i >= this.tracks[i].children.length);
  }
}

export class RenderDataConverter {
  public readonly timing: AnimateTiming;

  private readonly singAlongMap: Record<string, string> = {};

  public constructor(
    duration: number,
    public readonly config: AnimateConfig,
    public readonly lyrics: LyricsStore,
  ) {
    this.timing = new AnimateTiming(duration, config, lyrics.bpm);
  }

  protected convertAnnotation(block: AnnotationBlock): AnnotationRenderData {
    return new AnnotationRenderData(
      this.timing.barToFrame(block.start),
      this.timing.barToFrame(block.end),
      block.text,
    );
  }

  protected convertLyricsBlock(block: LyricsBlock): LyricsBlockRenderData[] {
    const ret = new Array<LyricsBlockRenderData>();
    // Handle color.
    const colors = block.tags.tags.map((x) => x.color);
    // Handle top annotations.
    const annotations = block.isSimple
      ? []
      : block.children.map((x) => this.convertAnnotation(x));
    // Handle sing alongs.
    const singAlong: string | undefined = this.singAlongMap[block.id];
    // Handle text.
    let text = block.bottomText;
    let leftPunctuations = /^\p{P}*/u.exec(text)?.[0] ?? '';
    let rightPunctuations = /\p{P}*$/u.exec(text)?.[0] ?? '';
    if (leftPunctuations === text) {
      // Punctuation only.
      leftPunctuations = '';
      rightPunctuations = '';
    }
    text = text.substring(
      leftPunctuations.length,
      text.length - rightPunctuations.length,
    );
    // Just one frame for punctuation.
    let startFrame = this.timing.barToFrame(block.start);
    let endFrame = this.timing.barToFrame(block.end);
    if (rightPunctuations) endFrame -= 1;
    if (leftPunctuations) {
      ret.push(
        new LyricsBlockRenderData(
          startFrame,
          startFrame + 1,
          leftPunctuations,
          colors,
        ),
      );
      startFrame += 1;
    }
    ret.push(
      new LyricsBlockRenderData(
        startFrame,
        endFrame,
        text,
        colors,
        annotations,
        singAlong,
      ),
    );
    if (rightPunctuations) {
      ret.push(
        new LyricsBlockRenderData(
          endFrame,
          endFrame + 1,
          rightPunctuations,
          colors,
        ),
      );
    }
    return ret;
  }

  protected convertLyricsLine(
    blocks: LyricsBlock[],
    emptyFramesBefore: number,
  ): LyricsLineRenderData {
    const first = blocks[0];
    const last = blocks[blocks.length - 1];
    const minInterval = this.timing.minHintIntervalAt(first.start).lyricsLine;
    const hint = minInterval >= emptyFramesBefore ? minInterval : undefined;
    if (!last.newline) {
      console.warn('Last block of a line should have newline bit set.');
    }
    const startFrame = this.timing.barToFrame(first.start);
    const lastFrame = this.timing.barToFrame(last.end);
    const ret = new LyricsLineRenderData(
      startFrame,
      lastFrame,
      hint,
      blocks.flatMap((x) => this.convertLyricsBlock(x)),
    );
    return ret;
  }

  protected convertCallBlock(block: CallBlock): CallBlockRenderData {
    return new CallBlockRenderData(
      this.timing.barToFrame(block.start),
      this.timing.barToFrame(block.end),
      block.text,
    );
  }

  protected convertCallLine(
    blocks: CallBlock[],
    emptyFramesBefore: number,
    repeatOffsets: number[],
  ): CallLineRenderData {
    const first = blocks[0];
    const last = blocks[blocks.length - 1];
    const minInterval = this.timing.minHintIntervalAt(first.start).callBlock;
    const hint = minInterval >= emptyFramesBefore ? minInterval : undefined;
    const startFrame = this.timing.barToFrame(first.start);
    const lastFrame = this.timing.barToFrame(last.end);
    const callBlocks = blocks.map((x) => this.convertCallBlock(x));
    return new CallLineRenderData(
      startFrame,
      lastFrame,
      hint,
      callBlocks,
      repeatOffsets,
    );
  }

  protected convertComment(block: CommentBlock): CommentRenderData {
    return new CommentRenderData(
      this.timing.barToFrame(block.start),
      this.timing.barToFrame(block.end),
      block.text,
    );
  }

  protected convertCommentTracks(
    tracks: CommentTrack[],
  ): CommentTrackRenderData {
    const ret = new CommentTrackRenderData(0, this.timing.maxFrame);
    ret.addComment(
      ...tracks.flatMap((t) => t.children.map((b) => this.convertComment(b))),
    );
    return ret;
  }

  protected preprocessCallsTrack(track: CallsTrack) {
    // Load all sing along blocks.
    for (const block of Typeof(track.children, SingAlongBlock)) {
      const lyricsBlock = block.lyricsBlock;
      if (!lyricsBlock) continue;
      if (lyricsBlock.id in this.singAlongMap) {
        console.warn(
          'Duplicate sing along block for same lyrics block:',
          lyricsBlock.id,
        );
      }
      this.singAlongMap[lyricsBlock.id] = block.isOverriden ? block.text : '';
    }
  }

  protected convertLyricsTracks(
    tracks: LyricsLineTrack[],
  ): LyricsTrackRenderData {}

  public convert(): LyricsRenderData {
    const comments = this.convertCommentTracks(
      Typeof(this.lyrics.tracks.children, CommentTrack),
    );
    const lines = this.convertLyricsTracks(
      this.lyrics.tracks.children.filter(
        (x) => x instanceof LyricsTrack || x instanceof CallsTrack,
      ) as LyricsLineTrack[],
    );
    const ret = new LyricsRenderData(
      0,
      this.timing.maxFrame,
      this.lyrics.meta,
      lines,
      comments,
    );
    return ret;
  }
}
