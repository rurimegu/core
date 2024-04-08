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
import { ICopyable, IWithText } from '../../utils/types';
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

export interface LyricsBlockData extends ParentOptionalTextData {
  tags: string[];
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
}
