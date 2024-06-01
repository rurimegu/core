import {
  AnnotationBlock,
  CallBlock,
  CallBlockBase,
  CallsTrack,
  CommentBlock,
  CommentTrack,
  LyricsBlock,
  LyricsStore,
  LyricsTrack,
  SingAlongBlock,
} from '../store';
import { ApproxEqual, InvalidStateError, MAX_FRAMES, Typeof } from '../utils';
import { AnimateConfig } from './config';
import {
  AnnotationRenderData,
  CallBlockRenderData,
  CallLineRenderData,
  CommentRenderData,
  CommentTrackRenderData,
  LineRenderData,
  LyricsBlockRenderData,
  LyricsLineRenderData,
  LyricsParagraphRenderData,
  LyricsRenderData,
  LyricsTrackRenderData,
  RenderDataBase,
} from './render-data';
import { AnimateTiming } from './timing';

type LineTrack = LyricsTrack | CallsTrack;

abstract class LineConverter<
  U extends RenderDataBase,
  T extends LineRenderData<U>,
> {
  protected head = 0;
  protected lastLine?: T;

  constructor(
    public readonly parent: RenderDataConverter,
    public track: LineTrack,
  ) {
    this.moveLineNext();
  }

  protected get headBlock() {
    if (this.isHeadFinished) return undefined;
    return this.track.children[this.head];
  }

  protected moveHeadNext() {
    if (!this.isHeadFinished) this.head++;
    return !this.isHeadFinished;
  }

  protected get isHeadFinished() {
    return this.head >= this.track.children.length;
  }

  public get isFinished() {
    return this.isHeadFinished && !this.lastLine;
  }

  public get currentLine() {
    return this.lastLine;
  }

  public abstract moveLineNext(): void;
}

class LyricsLineConverter extends LineConverter<
  LyricsBlockRenderData,
  LyricsLineRenderData
> {
  public override moveLineNext() {
    if (this.isHeadFinished) {
      this.lastLine = undefined;
      return;
    }
    const head = this.headBlock as LyricsBlock;
    const blocks = this.parent.convertLyricsBlock(head);
    const firstBlock = blocks[0];
    // Calculate if hint is needed.
    const minInterval = this.parent.timing.minHintIntervalAt(
      head.start,
    ).hintLyricsLine;
    const shouldHint =
      firstBlock.start - (this.lastLine?.end ?? 0) >= minInterval;
    const hint = shouldHint ? minInterval : 0;
    // Collect all blocks in the same line until a newline block.
    while (!head.newline) {
      if (!this.moveHeadNext()) break;
      const head = this.headBlock as LyricsBlock;
      blocks.push(...this.parent.convertLyricsBlock(head));
    }
    this.lastLine = new LyricsLineRenderData(hint, blocks);
  }
}

class CallLineConverter extends LineConverter<
  CallBlockRenderData,
  CallLineRenderData
> {
  protected calcSimpleCallBlocks(startIdx: number): CallBlockRenderData[] {
    const track = this.track as CallsTrack;
    const blocks = new Array<CallBlockRenderData>();
    for (let i = startIdx; i < track.length; i++) {
      const block = track.children[i];
      if (block instanceof SingAlongBlock) break;
      const data = this.parent.convertCallBlock(block);
      if (
        blocks.length > 0 &&
        data.start - blocks[blocks.length - 1].end >
          this.parent.timing.minHintIntervalAt(block.start).sepCallBlock
      )
        break;
      blocks.push(data);
    }
    return blocks;
  }
  /**
   * Calculate repeat offsets for the call blocks starting from `startIdx`.
   * @param startIdx The index of the first call block.
   * @returns A tuple of the call blocks and repeat offsets.
   */
  protected calcRepeatOffsets(
    startIdx: number,
  ): [CallBlockRenderData[], number[]] {
    const track = this.track as CallsTrack;
    const head = track.children[startIdx] as CallBlock;
    const group = head.group;
    const possibleRepeats = [...group.all]
      .filter((b) => b.start.compare(head.start) >= 0)
      .sort((a, b) => a.start.compare(b.start));

    if (possibleRepeats.length <= 1) {
      // No repeats.
      return [this.calcSimpleCallBlocks(startIdx), [0]];
    }

    const endIdx = track.children.indexOf(possibleRepeats[1]);
    const blocks = track.children
      .slice(startIdx, endIdx)
      .map((b) => this.parent.convertCallBlock(b));

    if (blocks.some((b) => b.isSingAlong)) {
      // Sing along blocks should not be repeated.
      return [this.calcSimpleCallBlocks(startIdx), [0]];
    }

    const repeatInterval =
      this.parent.lyrics.bpm.barToAudioTime(possibleRepeats[1].start) -
      this.parent.lyrics.bpm.barToAudioTime(head.start);
    const repeatOffsets = new Array<number>();

    // Find max repeats.
    for (
      let i = startIdx;
      i + blocks.length <= track.length;
      i += blocks.length
    ) {
      let isRepeat = true;
      const expectedTimeOffset =
        ((i - startIdx) / blocks.length) * repeatInterval;
      for (let j = 0; j < blocks.length; j++) {
        const original = track.children[startIdx + j] as CallBlock;
        const current = track.children[i + j];
        // Repeated blocks should have the same type.
        if (!(current instanceof CallBlock)) {
          isRepeat = false;
          break;
        }
        // Repeated blocks should have the same group.
        if (original.group !== current.group) {
          isRepeat = false;
          break;
        }
        // Check timings match.
        const timeOffset =
          this.parent.lyrics.bpm.barToAudioTime(current.start) -
          this.parent.lyrics.bpm.barToAudioTime(original.start);
        if (!ApproxEqual(timeOffset, expectedTimeOffset)) {
          isRepeat = false;
          break;
        }
      }
      if (!isRepeat) break;
      repeatOffsets.push(
        this.parent.timing.barToFrame(track.children[i].start) -
          blocks[0].start,
      );
    }
    return [blocks, repeatOffsets];
  }

  protected getCallBlocks() {
    // Checks whether hint is needed.
    const head = this.headBlock as CallBlock;
    const firstBlock = this.parent.convertCallBlock(head);
    const minInterval = this.parent.timing.minHintIntervalAt(
      head.start,
    ).hintCallBlock;
    const shouldHint =
      firstBlock.start - (this.lastLine?.end ?? 0) >= minInterval;
    const hint = shouldHint ? minInterval : 0;
    const [blocks, repeatOffsets] = this.calcRepeatOffsets(this.head);
    return new CallLineRenderData(hint, blocks, repeatOffsets);
  }

  protected getSingAlongBlocks() {
    const blocks = new Array<CallBlockRenderData>();
    let head = this.headBlock;
    while (head instanceof SingAlongBlock) {
      const block = this.parent.convertCallBlock(head);
      const sepInterval = this.parent.timing.minHintIntervalAt(
        block.start,
      ).sepCallBlock;
      if (
        blocks.length > 0 &&
        block.start - blocks[blocks.length - 1].end > sepInterval
      ) {
        // Separate sing along blocks due to long interval.
        break;
      }
      blocks.push(block);
      if (!this.moveHeadNext()) break;
      head = this.headBlock;
    }
    return blocks;
  }

  public override moveLineNext() {
    if (this.isHeadFinished) {
      this.lastLine = undefined;
      return;
    }
    const head = this.headBlock as CallBlockBase;
    if (head instanceof SingAlongBlock) {
      const blocks = this.getSingAlongBlocks();
      const repeatOffsets = [0];
      // No need to hint for sing along blocks.
      this.lastLine = new CallLineRenderData(0, blocks, repeatOffsets);
    } else {
      this.lastLine = this.getCallBlocks();
    }
  }
}

function createLineConverter(parent: RenderDataConverter, track: LineTrack) {
  if (track instanceof LyricsTrack) {
    return new LyricsLineConverter(parent, track);
  } else if (track instanceof CallsTrack) {
    return new CallLineConverter(parent, track);
  } else {
    throw new InvalidStateError(
      'Unsupported track type when creating line converter.',
    );
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

  public convertAnnotation(block: AnnotationBlock): AnnotationRenderData {
    return new AnnotationRenderData(
      this.timing.barToFrame(block.start),
      this.timing.barToFrame(block.end),
      block.text,
    );
  }

  public convertLyricsBlock(block: LyricsBlock): LyricsBlockRenderData[] {
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

  public convertLyricsLine(
    blocks: LyricsBlock[],
    emptyFramesBefore: number,
  ): LyricsLineRenderData {
    const first = blocks[0];
    const last = blocks[blocks.length - 1];
    const minInterval = this.timing.minHintIntervalAt(
      first.start,
    ).hintLyricsLine;
    const hint = minInterval >= emptyFramesBefore ? minInterval : undefined;
    if (!last.newline) {
      console.warn('Last block of a line should have newline bit set.');
    }
    const ret = new LyricsLineRenderData(
      hint,
      blocks.flatMap((x) => this.convertLyricsBlock(x)),
    );
    return ret;
  }

  public convertCallBlock(block: CallBlockBase): CallBlockRenderData {
    return new CallBlockRenderData(
      this.timing.barToFrame(block.start),
      this.timing.barToFrame(block.end),
      block.text,
      block instanceof SingAlongBlock,
    );
  }

  public convertCallLine(
    blocks: CallBlock[],
    emptyFramesBefore: number,
    repeatOffsets: number[],
  ): CallLineRenderData {
    const first = blocks[0];
    const minInterval = this.timing.minHintIntervalAt(
      first.start,
    ).hintCallBlock;
    const hint = minInterval >= emptyFramesBefore ? minInterval : undefined;
    const callBlocks = blocks.map((x) => this.convertCallBlock(x));
    return new CallLineRenderData(hint, callBlocks, repeatOffsets);
  }

  public convertComment(block: CommentBlock): CommentRenderData {
    return new CommentRenderData(
      this.timing.barToFrame(block.start),
      this.timing.barToFrame(block.end),
      block.text,
    );
  }

  public convertCommentTracks(tracks: CommentTrack[]): CommentTrackRenderData {
    const ret = new CommentTrackRenderData();
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

  public convertLyricsTracks(): LyricsTrackRenderData {
    const trackConvs = (
      this.lyrics.tracks.children.filter(
        (x) => x instanceof LyricsTrack || x instanceof CallsTrack,
      ) as LineTrack[]
    ).map((x) => createLineConverter(this, x));
    // Find the main lyrics track.
    const main = trackConvs.shift();
    if (!main || !(main instanceof LyricsLineConverter)) {
      throw new InvalidStateError(
        'Main lyrics track not found. It must be the first track.',
      );
    }
    const ret = new LyricsTrackRenderData();
    while (!main.isFinished) {
      const paragraph = new LyricsParagraphRenderData();
      paragraph.addLine(main.currentLine!);
      main.moveLineNext();
      const nextStart = main.currentLine?.start ?? MAX_FRAMES;
      // Find the next line in other tracks.
      for (const conv of trackConvs) {
        while (!conv.isFinished && conv.currentLine!.end <= nextStart) {
          paragraph.addLine(conv.currentLine!);
          conv.moveLineNext();
        }
      }
      ret.push(paragraph);
    }
    return ret;
  }

  public convert(): LyricsRenderData {
    const comments = this.convertCommentTracks(
      Typeof(this.lyrics.tracks.children, CommentTrack),
    );
    const lines = this.convertLyricsTracks();
    const ret = new LyricsRenderData(
      this.timing.maxFrame,
      this.lyrics.meta,
      lines,
      comments,
    );
    return ret;
  }
}
