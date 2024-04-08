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
import { ICopyable, IWithNewline, IWithText } from '../../utils/types';
import {
  BlockDataHelpers,
  BlockType,
  IMergable,
  ParentBlockBase,
  ParentOptionalTextData,
} from './base';
import { LyricsTrack } from './track';
import { IWithTags, TagsStore } from '../tags';
import { AnnotationBlock } from './annotation';
import { SplitLyricsArray, SplitWords } from '../../utils';
import { ANNO_INDIC } from '../../utils/constants';

export interface LyricsBlockData extends ParentOptionalTextData {
  tags: string[];
  newline: boolean;
}

export class LyricsBlock
  extends ParentBlockBase<AnnotationBlock>
  implements
    ICopyable<LyricsBlock>,
    IWithText,
    IMergable<LyricsBlock>,
    IWithTags,
    IWithNewline
{
  public override readonly type = BlockType.Lyrics;

  public static tagsStore: TagsStore;

  @observable public text = '';
  @observable public newline = false;

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
  ): LyricsBlock[] {
    return LyricsBlock.FromSeparatedText(
      SplitWords(text),
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
        start = start.upperBound(alignDiv);
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
      newline: this.newline,
    };
  }

  @override
  public override deserialize(data: LyricsBlockData & BlockDataHelpers) {
    const ret = super.deserialize(data);
    this.text = data.text ?? '';
    this.newline = Boolean(data.newline);
    if (data.tags) this.tags.deserialize(data.tags);
    return ret;
  }
}
