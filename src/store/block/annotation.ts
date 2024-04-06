import {
  action,
  computed,
  makeObservable,
  observable,
  override,
  runInAction,
} from 'mobx';
import { Timing } from '../range';
import { DataError } from '../../utils/error';
import { SplitWords } from '../../utils/string';
import { IClonable, ICopyable } from '../../utils/types';
import {
  BlockBase,
  BlockData,
  BlockDataHelpers,
  BlockType,
  IMergable,
  IResizeAction,
  ITimingMutableBlock,
  IWithText,
  ParentBlockBase,
  ParentOptionalTextData,
  ResizeBlockCmd,
} from './base';
import { LyricsTrack } from './track';
import { IWithTags, TagsStore } from '../tags';

interface AnnotationBlockData extends BlockData {
  text: string;
  start: string;
  end: string;
}

interface LyricsBlockData extends ParentOptionalTextData {
  tags: string[];
}

export class AnnotationBlock
  extends BlockBase
  implements
    IClonable<AnnotationBlock>,
    ICopyable<AnnotationBlock>,
    IMergable<AnnotationBlock>,
    ITimingMutableBlock,
    IWithText
{
  public override readonly type = BlockType.Annotation;

  @observable public text = '';
  @observable public override start: Timing = Timing.INVALID;
  @observable public override end: Timing = Timing.INVALID;

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }

  @override
  public override get parent() {
    return this.parent_ as LyricsBlock;
  }

  public static Create(
    text: string,
    start: Timing,
    end: Timing,
  ): AnnotationBlock {
    const ret = new AnnotationBlock();
    ret.text = text;
    ret.start = start;
    ret.end = end;
    return ret;
  }

  public static AutoSplit(
    text: string,
    start: Timing,
    alignDiv: number,
    separator: string,
  ): AnnotationBlock[] {
    return AnnotationBlock.FromSeparatedText(
      SplitWords(text),
      start,
      alignDiv,
      separator,
    );
  }

  public static FromSeparatedText(
    text: string | string[],
    start: Timing,
    alignDiv: number,
    separator: string,
  ): AnnotationBlock[] {
    const words =
      typeof text === 'string'
        ? text
            .replace(/[\n\r]+/g, `${separator} ${separator}`)
            .split(separator)
            .filter((w) => w)
        : text;
    const annotations: AnnotationBlock[] = [];
    start = start.lowerBound(alignDiv);
    for (const word of words) {
      if (word === ' ') {
        start = start.upperBound(alignDiv);
        continue;
      }
      const next = start.upperBound(alignDiv);
      annotations.push(AnnotationBlock.Create(word, start, next));
      start = next;
    }
    return annotations;
  }

  public clone(): AnnotationBlock {
    const ret = new AnnotationBlock(this.id);
    runInAction(() => {
      ret.text = this.text;
      ret.start = this.start;
      ret.end = this.end;
    });
    return ret;
  }

  public newCopy(): AnnotationBlock {
    return AnnotationBlock.Create(this.text, this.start, this.end);
  }

  public mergeRight(annotation: AnnotationBlock) {
    this.text += annotation.text;
    this.end = annotation.end;
  }

  public get bottomText() {
    return this.text;
  }

  //#region ISerializable
  public override serialize(): AnnotationBlockData {
    return {
      ...super.serialize(),
      text: this.text,
      start: this.start.serialize(),
      end: this.end.serialize(),
    };
  }

  @override
  public override deserialize(data: AnnotationBlockData & BlockDataHelpers) {
    const ret = super.deserialize(data);
    this.text = data.text;
    this.start = Timing.Deserialize(data.start);
    this.end = Timing.Deserialize(data.end);
    return ret;
  }
  //#endregion

  //#region Commands
  public resizeCmd(
    alignDiv: number,
    allowExpand: boolean,
    start?: Timing,
    end?: Timing,
    notifyParent?: boolean,
  ): IResizeAction {
    return ResizeBlockCmd(
      this,
      alignDiv,
      allowExpand,
      start,
      end,
      notifyParent,
    );
  }
  //#endregion Commands
}

export class LyricsBlock
  extends ParentBlockBase<AnnotationBlock>
  implements
    ICopyable<LyricsBlock>,
    IWithText,
    IMergable<LyricsBlock>,
    IWithTags
{
  public override readonly type = BlockType.Lyrics;

  public static tagsStore: TagsStore;

  @observable public text = '';
  public readonly tags = LyricsBlock.tagsStore.createRef();

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }

  public static Create(character: string, annotations: AnnotationBlock[]) {
    if (annotations.length === 0) {
      throw new DataError(
        `Cannot create block ${character} with no annotations`,
      );
    }
    const ret = new LyricsBlock();
    runInAction(() => {
      ret.text = character;
      ret.replace(annotations);
    });
    return ret;
  }

  public static Simple(
    character: string,
    start: Timing,
    end: Timing,
  ): LyricsBlock {
    return LyricsBlock.Create('', [
      AnnotationBlock.Create(character, start, end),
    ]);
  }

  public static AutoSplit(
    text: string,
    start: Timing,
    alignDiv: number,
    separator: string,
  ): LyricsBlock[] {
    return LyricsBlock.FromAnnotations(
      AnnotationBlock.AutoSplit(text, start, alignDiv, separator),
    );
  }

  public static FromAnnotations(annotations: AnnotationBlock[]): LyricsBlock[] {
    return annotations.map((a) => LyricsBlock.Create('', [a]));
  }

  @override
  public override get parent() {
    return this.parent_ as LyricsTrack;
  }

  @computed
  public get isSimple(): boolean {
    return !this.text && this.length === 1;
  }

  @computed
  public get bottomText(): string {
    return this.isSimple ? this.first.text : this.text;
  }

  @action
  public mergeRight(block: LyricsBlock): void {
    this.push(...block.children);
    this.text += block.text;
  }

  public newCopy(): LyricsBlock {
    return LyricsBlock.Create(this.text, this.children.slice());
  }

  //#region ISerializable
  public override serialize(): LyricsBlockData {
    return {
      ...super.serialize(),
      text: this.text || undefined,
      tags: this.tags.serialize(),
    };
  }

  @override
  public override deserialize(data: LyricsBlockData & BlockDataHelpers) {
    const ret = super.deserialize(data);
    this.text = data.text ?? '';
    if (data.tags) this.tags.deserialize(data.tags);
    return ret;
  }
  //#endregion
}
