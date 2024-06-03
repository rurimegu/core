import _ from 'lodash';
import { LyricsMetadata } from '../store';
import { Bisect, Color, MAX_FRAMES } from '../utils';

export abstract class RenderDataBase {
  /** Start time in frames. */
  public abstract get start(): number;
  /** End time in frames. */
  public abstract get end(): number;
}

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
    /** Colors. Will be empty if not provided. */
    public readonly colors: Color[] = [],
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

  public static Space(start: number, end: number) {
    return new LyricsBlockRenderData(start, end, ' ');
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
}

export class LyricsLineRenderData extends LineRenderData<LyricsBlockRenderData> {
  public constructor(
    /** Hint frames before start time. If undefined, will not render hint animation. */
    public readonly hint?: number,
    /** Children. */
    children: LyricsBlockRenderData[] = [],
  ) {
    super(children);
  }

  public get isEmpty() {
    return this.children.every((x) => x.isEmpty);
  }

  public static Placeholder(start: number, end: number) {
    return new LyricsLineRenderData(undefined, [
      new LyricsBlockRenderData(start, end, ''),
    ]);
  }
}

export class CallLineRenderData extends LineRenderData<CallBlockRenderData> {
  public constructor(
    /** Hint frames before start time. If undefined, will not render hint animation. */
    public readonly hint?: number,
    /** Children. */
    children: CallBlockRenderData[] = [],
    /** Repeated at different offsets. */
    public readonly repeatOffsets: number[] = [0],
  ) {
    super(children);
  }
}

export class CommentLineRenderData extends LineRenderData<CommentRenderData> {}

export class LyricsParagraphRenderData extends RenderDataBase {
  public constructor(
    public readonly lyrics: LyricsLineRenderData,
    public readonly calls: CallLineRenderData[] = [],
  ) {
    super();
  }

  public override get start() {
    return Math.min(this.lyrics.start, this.calls[0]?.start ?? MAX_FRAMES);
  }

  public override get end() {
    return Math.max(
      this.lyrics.end,
      this.calls[this.calls.length - 1]?.end ?? 0,
    );
  }

  public get isEmpty() {
    return (
      this.lyrics.isEmpty && this.calls.every((x) => x.children.length === 0)
    );
  }
}

export class LyricsTrackRenderData extends Array<LyricsParagraphRenderData> {
  public finalize() {
    _.remove(this, (x) => x.isEmpty);
    this.sort((a, b) => a.start - b.start);
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

export class LyricsRenderData extends RenderDataBase {
  public constructor(
    public readonly end: number,
    public readonly meta: LyricsMetadata,
    public readonly lines = new LyricsTrackRenderData(),
    public readonly comments = new CommentTrackRenderData(),
  ) {
    super();
  }

  public override get start() {
    return 0;
  }
}
