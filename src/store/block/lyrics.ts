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
import {
  ICopyable,
  IWithBottomText,
  IWithSpacing,
  IWithText,
  RemoveUndefined,
} from '../../utils/types';
import {
  BlockDataHelpers,
  BlockType,
  IMergable,
  ParentBlockBase,
  ParentOptionalTextData,
} from './base';
import { LyricsTrack } from './track';
import { IWithTags, TagsGroup, TagsStore } from '../tags';
import { AnnotationBlock } from './annotation';
import { SplitLyrics, SplitLyricsArray } from '../../utils';
import { ANNO_INDIC, LYRICS_SEP } from '../../utils/constants';

export interface LyricsBlockData extends ParentOptionalTextData {
  tags: string[];
  newline?: boolean;
  space?: boolean;
}

export class LyricsBlock
  extends ParentBlockBase<AnnotationBlock>
  implements
    ICopyable<LyricsBlock>,
    IWithText,
    IMergable<LyricsBlock>,
    IWithTags,
    IWithSpacing,
    IWithBottomText
{
  public override readonly type = BlockType.Lyrics;

  public static tagsStore: TagsStore;

  @observable public text = '';
  @observable public newline = false;
  @observable public space = false;

  public readonly tags = new TagsGroup();

  public constructor() {
    super();
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
  ): LyricsBlock[] {
    return LyricsBlock.FromSeparatedText(
      SplitLyrics(text),
      start,
      alignDiv,
      true,
    );
  }

  public static FromAnnotations(annotations: AnnotationBlock[]): LyricsBlock[] {
    return annotations.map((a) => LyricsBlock.Create('', [a]));
  }

  public static FromSeparatedText(
    text: string | string[],
    start: Timing,
    alignDiv: number,
    autosplit = false,
  ): LyricsBlock[] {
    const words = typeof text === 'string' ? SplitLyricsArray(text) : text;
    const blocks: LyricsBlock[] = [];
    start = start.lowerBound(alignDiv);
    for (const word of words) {
      if (word.includes(ANNO_INDIC)) {
        const [text, annoText] = word.split(ANNO_INDIC);
        const annotations = autosplit
          ? AnnotationBlock.AutoSplit(annoText, start, alignDiv)
          : AnnotationBlock.FromSeparatedText(annoText, start, alignDiv);
        const block = LyricsBlock.Create(text, annotations);
        blocks.push(block);
        start = block.end;
        continue;
      }
      if (word === '\n') {
        if (blocks.length > 0) {
          blocks[blocks.length - 1].newline = true;
          start = start.upperBound(alignDiv);
        }
        continue;
      }
      if (word === ' ') {
        if (blocks.length > 0) {
          blocks[blocks.length - 1].space = true;
          start = start.upperBound(alignDiv);
        }
        continue;
      }
      if (autosplit) {
        const newBlocks = AnnotationBlock.AutoSplit(word, start, alignDiv).map(
          (a) => LyricsBlock.Create('', [a]),
        );
        blocks.push(...newBlocks);
        if (newBlocks.length > 0) start = newBlocks[newBlocks.length - 1].end;
      }
    }
    // Add newline at the end
    if (blocks.length > 0) blocks[blocks.length - 1].newline = true;
    return blocks;
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

  @computed
  public get topText(): string {
    return this.isSimple
      ? ''
      : this.children.map((a) => a.text).join(LYRICS_SEP);
  }

  @action
  public mergeRight(block: LyricsBlock): void {
    if (block.isSimple) {
      if (this.isSimple) {
        this.first.text += block.first.text;
        this.first.end = block.first.end;
      } else {
        this.text += block.first.text;
      }
    } else {
      if (this.isSimple) {
        this.text = this.bottomText + block.bottomText;
        this.replace(block.children);
      } else {
        this.push(...block.children);
        this.text += block.text;
      }
    }
    this.newline = block.newline;
    this.space = block.space;
  }

  public newCopy(): LyricsBlock {
    const newChildren = this.children.map((c) => c.newCopy());
    const ret = LyricsBlock.Create(this.text, newChildren);
    ret.tags.push(...this.tags);
    ret.newline = this.newline;
    ret.space = this.space;
    return ret;
  }

  //#region ISerializable
  public override serialize(): LyricsBlockData {
    return RemoveUndefined(
      {
        ...super.serialize(),
        text: this.text || undefined,
        tags: this.tags.serialize(),
        newline: this.newline,
        space: this.space,
      },
      true,
    );
  }

  @override
  public override deserialize(data: LyricsBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.text = data.text ?? '';
    this.newline = Boolean(data.newline);
    this.space = Boolean(data.space);
    if (data.tags) this.tags.deserialize(data.tags, data.context);
    else this.tags.clear();
  }
  //#endregion ISerializable
}
