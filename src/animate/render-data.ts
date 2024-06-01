import { LyricsMetadata } from '../store';
import { Bisect, Color, InvalidStateError, MAX_FRAMES } from '../utils';

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

export class LyricsAndCallRenderData extends RenderDataBase {
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
}

export class LyricsParagraphRenderData extends RenderDataBase {
  protected start_ = MAX_FRAMES;
  protected end_ = 0;
  public readonly children: LyricsAndCallRenderData[] = [];

  public constructor() {
    super();
  }

  public get main() {
    return this.children[0];
  }

  public addLine(line: LyricsLineRenderData | CallLineRenderData) {
    if (line instanceof LyricsLineRenderData) {
      this.children.push(new LyricsAndCallRenderData(line));
    } else {
      if (this.children.length === 0) {
        throw new InvalidStateError('Cannot add call line before lyrics line.');
      }
      this.children[this.children.length - 1].calls.push(line);
    }
    this.start_ = Math.min(this.start_, line.start);
    this.end_ = Math.max(this.end_, line.end);
  }

  public override get start() {
    return this.start_;
  }

  public override get end() {
    return this.end_;
  }
}

export class LyricsTrackRenderData extends Array<LyricsParagraphRenderData> {
  public addLine(data: LyricsParagraphRenderData) {
    const idx = Bisect(this, (x) => x.start <= data.start);
    if (idx >= this.length) {
      this.push(data);
    } else {
      this.splice(idx, 0, data);
    }
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
    public readonly meta: LyricsMetadata,
    public readonly lines = new LyricsTrackRenderData(),
    public readonly comments = new CommentTrackRenderData(),
  ) {
    super();
  }

  public override get start() {
    return 0;
  }

  public override get end() {
    return MAX_FRAMES;
  }
}
