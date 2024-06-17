import _ from 'lodash';
import { BpmStore, LyricsMetadata } from '../store';
import { Bisect, Clamp01, Color, InverseLerp, MAX_TIME } from '../utils';

export abstract class RenderDataBase {
  /** Start time in seconds. */
  public abstract get start(): number;
  /** End time in seconds. */
  public abstract get end(): number;

  public ratio(time: number) {
    return InverseLerp(this.start, this.end, time);
  }

  public ratioClamped(time: number) {
    return Clamp01(this.ratio(time));
  }
}

//#region Tracks
export abstract class LineBlockRenderData extends RenderDataBase {
  constructor(
    /** Text to display. */
    public readonly text: string,
  ) {
    super();
  }
}

export class AnnotationRenderData extends LineBlockRenderData {
  constructor(
    public readonly start: number,
    public readonly end: number,
    text: string,
  ) {
    super(text);
  }
}

export class LyricsBlockRenderData extends LineBlockRenderData {
  constructor(
    public readonly start: number,
    public readonly end: number,
    /** Text to display. A block might be split into multiple render data, and therefore the text might be different. */
    text: string,
    /** Colors. Will be empty if not provided. */
    public readonly colors: Color[] = [],
    /** Children. */
    public readonly children: AnnotationRenderData[] = [],
    /** If a string is supplied, this is a sing along block. */
    public singAlong?: string,
  ) {
    super(text);
  }

  public get isSingAlong() {
    return this.singAlong !== undefined;
  }

  public get isEmpty() {
    return !this.text && this.children.length === 0;
  }

  public static Space(start: number, end: number, fullWidth = false) {
    return new LyricsBlockRenderData(start, end, fullWidth ? '　' : ' ');
  }
}

export class CallBlockRenderData extends LineBlockRenderData {
  constructor(
    public readonly start: number,
    public readonly end: number,
    text: string,
    public isSingAlong: boolean = false,
  ) {
    super(text);
  }
}

export class CommentRenderData extends LineBlockRenderData {
  constructor(
    public readonly start: number,
    public readonly end: number,
    text: string,
  ) {
    super(text);
  }
}

export class LineRenderData<T extends RenderDataBase> extends RenderDataBase {
  constructor(
    /** Children. */
    public readonly children: T[] = [],
  ) {
    super();
  }

  public override get start() {
    return this.children[0].start;
  }

  public override get end() {
    return this.children[this.children.length - 1].end;
  }

  public get first() {
    return this.children[0];
  }

  public get last() {
    return this.children[this.children.length - 1];
  }
}

export class LyricsLineRenderData extends LineRenderData<LyricsBlockRenderData> {
  /** Hint seconds before start time. If undefined, will not render hint animation. */
  public hint?: number;

  public static Placeholder(start: number, end: number) {
    return new LyricsLineRenderData([
      new LyricsBlockRenderData(start, end, ''),
    ]);
  }

  public constructor(
    /** Children. */
    children: LyricsBlockRenderData[] = [],
  ) {
    super(children);
  }

  public get isEmpty() {
    return this.children.every((x) => x.isEmpty);
  }

  public get validChildren() {
    return this.children.filter((x) => !x.isEmpty);
  }

  public finalize() {
    if (this.isEmpty) return; // No need to finalize placeholder block
    while (this.children[this.children.length - 1].isEmpty) {
      this.children.pop();
    }
    while (this.children[0].isEmpty) {
      this.children.shift();
    }
  }
}

export class CallLineRenderData extends LineRenderData<CallBlockRenderData> {
  /** Hint seconds before start time. If undefined, will not render hint animation. */
  public hint?: number;

  public constructor(
    /** Children. */
    children: CallBlockRenderData[] = [],
    /** Repeated at different offsets. */
    public readonly repeatOffsets: number[] = [0],
  ) {
    super(children);
  }

  public get firstEnd() {
    return super.end;
  }

  public override get end() {
    return this.firstEnd + this.repeatOffsets[this.repeatOffsets.length - 1];
  }
}

export class CommentLineRenderData extends LineRenderData<CommentRenderData> {}

export class LyricsParagraphRenderData extends RenderDataBase {
  public constructor(
    public readonly lyrics: LyricsLineRenderData,
    public readonly calls: CallLineRenderData[][] = [],
  ) {
    super();
  }

  public static PlaceHolder(start: number, end: number) {
    return new LyricsParagraphRenderData(
      LyricsLineRenderData.Placeholder(start, end),
    );
  }

  public override get start() {
    return Math.min(
      this.lyrics.start,
      this.calls
        .flatMap((c) => c)
        .reduce((a, b) => Math.min(a, b.start), MAX_TIME),
    );
  }

  public override get end() {
    return Math.max(
      this.lyrics.end,
      this.calls.flat().reduce((a, b) => Math.max(a, b.end), 0),
    );
  }

  public get isEmpty() {
    return (
      this.lyrics.isEmpty &&
      this.calls.flat().every((x) => x.children.length === 0)
    );
  }

  public finalize() {
    this.lyrics.finalize();
  }

  public removeEmpty() {
    _.remove(this.calls, (x) => x.every((y) => y.children.length === 0));
  }
}

export class LyricsMultiParagraphRenderData extends Array<LyricsParagraphRenderData> {
  public finalize() {
    this.forEach((x) => x.finalize());
    this.sort((a, b) => a.start - b.start);
  }

  public get start() {
    return this[0].start;
  }

  public get end() {
    return this[this.length - 1].end;
  }

  public get isEmpty() {
    return this.every((x) => x.isEmpty);
  }

  public removeEmpty() {
    _.remove(this, (x) => x.isEmpty);
  }
}

export class LyricsTrackRenderData extends Array<LyricsMultiParagraphRenderData> {
  public finalize() {
    this.forEach((x) => x.finalize());
    this.sort((a, b) => a.start - b.start);
  }

  public removeEmpty() {
    this.forEach((x) => x.removeEmpty());
    _.remove(this, (x) => x.isEmpty);
  }
}

export class CommentTrackRenderData extends Array<CommentLineRenderData> {
  public addComment(...comments: CommentRenderData[]) {
    for (const comment of comments) {
      let inserted = false;
      for (const track of this) {
        const idx = Bisect(track.children, (x) => x.end <= comment.start);
        if (idx >= track.children.length) {
          track.children.push(comment);
          inserted = true;
          break;
        }
        const nxt = track.children[idx];
        if (nxt.start >= comment.end) {
          track.children.splice(idx, 0, comment);
          inserted = true;
          break;
        }
      }
      if (inserted) continue;
      const track = new CommentLineRenderData([comment]);
      this.push(track);
    }
  }
}
//#endregion Tracks

//#region Metadata
export class TagRenderData {
  public constructor(
    public readonly name: string,
    public readonly color: Color,
    public readonly totalDuration: number,
  ) {}
}

export class TagsRenderData extends Array<TagRenderData> {}
//#endregion Metadata

export class LyricsRenderData extends RenderDataBase {
  public constructor(
    public readonly end: number,
    public readonly meta: LyricsMetadata,
    public readonly lyrics: LyricsTrackRenderData,
    public readonly comments: CommentTrackRenderData,
    public readonly bpms: BpmStore,
    public readonly tags: TagsRenderData,
  ) {
    super();
  }

  public override get start() {
    return 0;
  }
}
