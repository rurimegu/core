import { LyricsMetadata } from '../store';
import { Bisect, Color } from '../utils';

export class RenderDataBase {
  constructor(
    /** Start time in frames. */
    public readonly start: number,
    /** End time in frames. */
    public readonly end: number,
  ) {}
}

export class AnnotationRenderData extends RenderDataBase {
  constructor(
    start: number,
    end: number,
    /** Text to display. */
    public readonly text: string,
    /** Colors. Will be empty if not provided. */
    public readonly colors: Color[] = [],
  ) {
    super(start, end);
  }
}

export class LineBlockRenderData extends RenderDataBase {
  constructor(
    start: number,
    end: number,
    /** Text to display. */
    public readonly text: string,
  ) {
    super(start, end);
  }
}

export class LyricsBlockRenderData extends LineBlockRenderData {
  constructor(
    start: number,
    end: number,
    /** Text to display. A block might be split into multiple render data, and therefore the text might be different. */
    text: string,
    /** Colors. Will be empty if not provided. */
    public readonly colors: Color[] = [],
    /** Children. */
    public readonly children: AnnotationRenderData[] = [],
    /** If a string is supplied, this is a sing along block. */
    public singAlong?: string,
  ) {
    super(start, end, text);
  }

  public get isSingAlong() {
    return this.singAlong !== undefined;
  }
}

export class CallBlockRenderData extends LineBlockRenderData {}

export class CommentRenderData extends LineBlockRenderData {}

export class LineRenderData<
  T extends LineBlockRenderData,
> extends RenderDataBase {
  constructor(
    start: number,
    end: number,
    /** Children. */
    public readonly children: T[] = [],
  ) {
    super(start, end);
  }
}

export class LyricsLineRenderData extends LineRenderData<LyricsBlockRenderData> {
  public constructor(
    start: number,
    end: number,
    /** Hint frames before start time. If undefined, will not render hint animation. */
    public readonly hint?: number,
    /** Children. */
    public readonly children: LyricsBlockRenderData[] = [],
  ) {
    super(start, end, children);
  }
}

export class CallLineRenderData extends LineRenderData<CallBlockRenderData> {
  public constructor(
    start: number,
    end: number,
    /** Hint frames before start time. If undefined, will not render hint animation. */
    public readonly hint?: number,
    /** Children. */
    public readonly children: CallBlockRenderData[] = [],
    /** Repeated at different offsets. */
    public readonly repeatOffsets: number[] = [0],
  ) {
    super(start, end, children);
  }
}

export class CommentLineRenderData extends LineRenderData<CommentRenderData> {}

export class LyricsTrackRenderData extends Array<
  LineRenderData<LineBlockRenderData>
> {}

export class CommentTrackRenderData extends Array<CommentLineRenderData> {
  constructor(
    public readonly start: number,
    public readonly end: number,
  ) {
    super();
  }

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
      const track = new CommentLineRenderData(this.start, this.end, [comment]);
      this.push(track);
    }
  }
}

export class LyricsRenderData extends RenderDataBase {
  public constructor(
    start: number,
    end: number,
    public readonly meta: LyricsMetadata,
    public readonly lines = new LyricsTrackRenderData(),
    public readonly comments = new CommentTrackRenderData(start, end),
  ) {
    super(start, end);
  }
}
