import {
  AnnotationBlock,
  BlockBase,
  BpmStore,
  CallBlock,
  CallBlockBase,
  CallsTrack,
  CommentBlock,
  CommentTrack,
  LyricsBlock,
  LyricsStore,
  LyricsTrack,
  ParentBlockBase,
  SingAlongBlock,
  TagsInfo,
  TagsStore,
} from '../store';
import {
  ApproxEqual,
  InvalidStateError,
  IsFullWidth,
  MAX_FRAMES,
  Predicate,
  Typeof,
  ValueError,
} from '../utils';
import { AnimateConfig } from './config';
import {
  AnnotationRenderData,
  CallBlockRenderData,
  CallLineRenderData,
  CommentRenderData,
  CommentTrackRenderData,
  LineRenderData,
  LyricsParagraphRenderData,
  LyricsBlockRenderData,
  LyricsLineRenderData,
  LyricsRenderData,
  LyricsTrackRenderData,
  RenderDataBase,
  BpmRenderData,
  TagsRenderData,
  TagRenderData,
} from './render-data';
import { AnimateTiming } from './timing';

abstract class LineConverter<
  B extends BlockBase,
  U extends RenderDataBase,
  T extends LineRenderData<U>,
> {
  protected head = 0;
  protected currentLine_: T | undefined;

  constructor(
    public readonly parent: RenderDataConverter,
    public track: ParentBlockBase<B>,
  ) {
    this.nextLine();
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
    return this.isHeadFinished && !this.currentLine_;
  }

  public abstract nextLine(): T | undefined;
  public get currentLine(): T | undefined {
    return this.currentLine_;
  }
}

class LyricsLineConverter extends LineConverter<
  LyricsBlock,
  LyricsBlockRenderData,
  LyricsLineRenderData
> {
  public override nextLine() {
    if (this.isHeadFinished) {
      this.currentLine_ = undefined;
      return;
    }
    let head = this.headBlock!;
    const blocks = this.parent.convertLyricsBlock(head);
    // Collect all blocks in the same line until a newline block.
    while (this.moveHeadNext()) {
      if (head.space) {
        // Add space.
        const last = blocks[blocks.length - 1];
        blocks.push(
          LyricsBlockRenderData.Space(
            last.end,
            last.end,
            last.text.length > 0
              ? IsFullWidth(last.text.charCodeAt(last.text.length - 1))
              : true,
          ),
        );
      }
      if (head.newline) break;
      head = this.headBlock!;
      blocks.push(...this.parent.convertLyricsBlock(head));
    }
    this.currentLine_ = new LyricsLineRenderData(blocks);
    return this.currentLine_;
  }
}

class CallLineConverter extends LineConverter<
  CallBlockBase,
  CallBlockRenderData,
  CallLineRenderData
> {
  protected calcSimpleCallBlocks(): CallBlockRenderData[] {
    const blocks = new Array<CallBlockRenderData>();
    while (!this.isHeadFinished) {
      const block = this.headBlock!;
      const data = this.parent.convertCallBlock(block);
      blocks.push(data);
      this.moveHeadNext();
      if (block.newline) break;
    }
    return blocks;
  }
  /**
   * Calculate repeat offsets for the call blocks starting from `startIdx`.
   * @param startIdx The index of the first call block.
   * @returns A tuple of the call blocks and repeat offsets.
   */
  protected calcRepeatOffsets(): [CallBlockRenderData[], number[]] {
    const track = this.track as CallsTrack;
    const startIdx = this.head;
    const head = track.children[startIdx] as CallBlock;
    const group = head.group;
    const possibleRepeats = [...group.all]
      .filter((b) => b.start.compare(head.start) >= 0)
      .sort((a, b) => a.start.compare(b.start));

    if (possibleRepeats.length <= 1) {
      // No repeats.
      return [this.calcSimpleCallBlocks(), [0]];
    }

    const endIdx = track.children.indexOf(possibleRepeats[1]);
    const blocks = track.children
      .slice(startIdx, endIdx)
      .map((b) => this.parent.convertCallBlock(b));

    if (blocks.some((b) => b.isSingAlong)) {
      // Sing along blocks should not be repeated.
      return [this.calcSimpleCallBlocks(), [0]];
    }

    const repeatInterval =
      this.parent.lyrics.bpm.barToAudioTime(possibleRepeats[1].start) -
      this.parent.lyrics.bpm.barToAudioTime(head.start);
    const repeatOffsets = new Array<number>();

    // Find max repeats.
    let encounteredNewline = false;
    for (
      let i = startIdx;
      i + blocks.length <= track.length && !encounteredNewline;
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
        // Repeated blocks should not have line breaks.
        if (current.newline) {
          encounteredNewline = true;
          if (j !== blocks.length - 1) {
            isRepeat = false;
            break;
          }
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
    this.head += repeatOffsets.length * blocks.length;
    return [blocks, repeatOffsets];
  }

  protected getCallBlocks() {
    // Checks whether hint is needed.
    const [blocks, repeatOffsets] = this.calcRepeatOffsets();
    return new CallLineRenderData(blocks, repeatOffsets);
  }

  public override nextLine() {
    if (this.isHeadFinished) {
      this.currentLine_ = undefined;
      return;
    }
    const head = this.headBlock as CallBlockBase;
    if (head instanceof SingAlongBlock) {
      const blocks = this.calcSimpleCallBlocks();
      const repeatOffsets = [0];
      // No need to hint for sing along blocks.
      this.currentLine_ = new CallLineRenderData(blocks, repeatOffsets);
    } else {
      this.currentLine_ = this.getCallBlocks();
    }
    return this.currentLine_;
  }
}

function createLineConverter(
  parent: RenderDataConverter,
  track: LyricsTrack | CallsTrack,
) {
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

  //#region Track converters
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
    const startFrame = this.timing.barToFrame(block.start);
    const endFrame = this.timing.barToFrame(block.end);
    if (leftPunctuations) {
      ret.push(
        new LyricsBlockRenderData(
          startFrame,
          startFrame,
          leftPunctuations,
          colors,
        ),
      );
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
          endFrame,
          rightPunctuations,
          colors,
        ),
      );
    }
    return ret;
  }

  public convertLyricsLine(blocks: LyricsBlock[]): LyricsLineRenderData {
    const last = blocks[blocks.length - 1];
    if (!last.newline) {
      console.warn('Last block of a line should have newline bit set.');
    }
    const ret = new LyricsLineRenderData(
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
    repeatOffsets: number[],
  ): CallLineRenderData {
    const callBlocks = blocks.map((x) => this.convertCallBlock(x));
    return new CallLineRenderData(callBlocks, repeatOffsets);
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

  /**
   * Merge lyrics and calls into paragraphs.
   * @param main The main lyrics line.
   * @param convs The converters for other tracks.
   * @param onlyContained Whether to merge only if the line is fully contained.
   * @returns The merged paragraph.
   */
  protected processNextParagraph(
    main: LyricsLineRenderData,
    convs: CallLineConverter[],
    onlyContained: boolean,
  ) {
    const paragraph = new LyricsParagraphRenderData(main);
    const predicate: Predicate<LineRenderData<any>> = onlyContained
      ? (x) => x.end <= main.end
      : (x) => x.start < main.end;
    // Find the next line in other tracks.
    for (const conv of convs) {
      const lines = new Array<CallLineRenderData>();
      while (!conv.isFinished && predicate(conv.currentLine!)) {
        lines.push(conv.currentLine!);
        conv.nextLine();
      }
      paragraph.calls.push(lines);
    }
    return paragraph;
  }

  protected processLyricsAndCalls(
    lyrics: LyricsLineConverter,
    calls: CallLineConverter[],
  ): LyricsParagraphRenderData[] {
    let current = lyrics.currentLine;
    if (!current) return [];
    const ret = new Array<LyricsParagraphRenderData>();
    const firstLine = LyricsLineRenderData.Placeholder(0, current.start);
    ret.push(this.processNextParagraph(firstLine, calls, true));
    while (!lyrics.isFinished) {
      lyrics.nextLine();
      const nextStart = lyrics.currentLine?.start ?? MAX_FRAMES;
      ret.push(this.processNextParagraph(current!, calls, false));
      const placeholder = LyricsLineRenderData.Placeholder(
        current!.end,
        nextStart,
      );
      ret.push(this.processNextParagraph(placeholder, calls, true));
      current = lyrics.currentLine;
    }
    return ret;
  }

  public convertLyricsTracks(): LyricsTrackRenderData {
    const trackConvs = (
      this.lyrics.tracks.children.filter(
        (x) => x instanceof LyricsTrack || x instanceof CallsTrack,
      ) as (LyricsTrack | CallsTrack)[]
    ).map((x) => createLineConverter(this, x));

    // Add lyrics / calls before the first lyrics line.
    const ret = new LyricsTrackRenderData();
    let mainLyrics: LyricsLineConverter | undefined;
    const calls = new Array<CallLineConverter>();

    const processCurrentLyricsAndCalls = () => {
      if (mainLyrics) {
        // Process lyrics and calls.
        ret.push(...this.processLyricsAndCalls(mainLyrics, calls));
      } else if (calls.length > 0) {
        throw new ValueError('Call tracks must not appear before lyrics.');
      }
    };

    for (const conv of trackConvs) {
      if (conv instanceof LyricsLineConverter) {
        processCurrentLyricsAndCalls();
        mainLyrics = conv;
        continue;
      }
      if (conv instanceof CallLineConverter) {
        calls.push(conv);
        continue;
      }
    }
    processCurrentLyricsAndCalls();
    ret.finalize();
    return ret;
  }

  public calcHint(data: LyricsTrackRenderData) {
    // Calculate hint for lyrics.
    let prevLyricsEnd = 0;
    const lyrics = data.flatMap((x) => x.lyrics).filter((x) => !x.isEmpty);
    lyrics.sort((a, b) => a.start - b.start);
    for (const lyric of lyrics) {
      const emptyFrames = lyric.start - prevLyricsEnd;
      // Add 1 frame for floating point error.
      const minHint = this.timing.hintIntervalAt(
        lyric.start + 1,
      ).hintLyricsLine;
      if (emptyFrames >= this.config.minIntervals.hintLyricsLine)
        lyric.hint = minHint;
      prevLyricsEnd = Math.max(lyric.end, prevLyricsEnd);
    }
    // Calculate hint for calls.
    let prevCallsEnd = 0;
    const calls = data.flatMap((x) => x.calls.flatMap((y) => y));
    calls.sort((a, b) => a.start - b.start);
    for (const call of calls) {
      const emptyFrames = call.start - prevCallsEnd;
      // Add 1 frame for floating point error.
      const minHint = this.timing.hintIntervalAt(call.start + 1).hintCallLine;
      if (emptyFrames >= this.config.minIntervals.hintCallLine)
        call.hint = minHint;
      prevCallsEnd = Math.max(call.end, prevCallsEnd);
    }
  }
  //#endregion Track converters

  //#region Metadata converters
  protected convertBpm(bpm: BpmStore) {
    return new BpmRenderData(bpm);
  }

  protected convertTags(tags: TagsStore) {
    const ret = new TagsRenderData();
    const info = new TagsInfo();
    info.gatherInfo(this.lyrics.bpm, this.lyrics.tracks);
    const sortedTags = [...tags.tagList]
      .filter((t) => (info.timing[t.id] ?? 0) > 0)
      .sort((a, b) => {
        return info.timing[b.id] - info.timing[a.id];
      });
    ret.push(
      ...sortedTags.map(
        (tag) => new TagRenderData(tag.name, tag.color, info.timing[tag.id]),
      ),
    );
    return ret;
  }
  //#endregion Metadata converters

  public convert(): LyricsRenderData {
    const comments = this.convertCommentTracks(
      Typeof(this.lyrics.tracks.children, CommentTrack),
    );
    const lyrics = this.convertLyricsTracks();
    this.calcHint(lyrics);
    const ret = new LyricsRenderData(
      this.timing.maxFrame,
      this.lyrics.meta,
      lyrics,
      comments,
      this.convertBpm(this.lyrics.bpm),
      this.convertTags(this.lyrics.tags),
    );
    return ret;
  }
}
