import { makeObservable, observable, override, runInAction } from 'mobx';
import { Timing } from '../range';
import { SplitLyricsArray, SplitWords } from '../../utils/string';
import { IClonable, ICopyable, IWithText } from '../../utils/types';
import {
  BlockBase,
  BlockData,
  BlockDataHelpers,
  BlockType,
  IMergable,
  IResizeAction,
  ITimingMutableBlock,
  ResizeBlockCmd,
} from './base';
import { LyricsBlock } from './lyrics';

interface AnnotationBlockData extends BlockData {
  text: string;
  start: string;
  end: string;
}

export enum AnnotationPlaceholder {
  LINE_BREAK,
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
  ): AnnotationBlock[] {
    return AnnotationBlock.FromSeparatedText(SplitWords(text), start, alignDiv);
  }

  public static FromSeparatedText(
    text: string | string[],
    start: Timing,
    alignDiv: number,
  ): AnnotationBlock[] {
    const words = typeof text === 'string' ? SplitLyricsArray(text) : text;
    const annotations: AnnotationBlock[] = [];
    start = start.lowerBound(alignDiv);
    for (const word of words) {
      if (word === '\n' || word === ' ') {
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
