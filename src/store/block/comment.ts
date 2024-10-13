import { action, makeObservable, observable, override } from 'mobx';
import {
  BlockBase,
  BlockDataHelpers,
  BlockDataWithText,
  BlockType,
  IResizeAction,
  ResizeBlockCmd,
} from './base';
import { CommentTrack } from './track';
import {
  ICopyable,
  IMutableStart,
  IWithBottomText,
  IWithText,
} from '../../utils';
import { Timing } from '../range';

interface CommentBlockData extends BlockDataWithText {
  start: string;
  end: string;
}

export class CommentBlock
  extends BlockBase
  implements IWithText, IWithBottomText, IMutableStart, ICopyable<CommentBlock>
{
  public override readonly type = BlockType.Comment;

  @observable
  public start = Timing.INVALID;

  @observable
  public end = Timing.INVALID;

  @observable
  public text = '';

  public get bottomText(): string {
    return this.text;
  }

  @override
  public override get parent() {
    return this.parent_ as CommentTrack;
  }

  public constructor() {
    super();
    makeObservable(this);
  }

  //#region Commands
  public override resizeCmd(
    alignDiv: number,
    allowExpand: boolean,
    start?: Timing | undefined,
    end?: Timing | undefined,
    notifyParent?: boolean | undefined,
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

  //#region ISerializable
  public override serialize(): CommentBlockData {
    return {
      ...super.serialize(),
      text: this.text,
      start: this.start.serialize(),
      end: this.end.serialize(),
    };
  }

  public override deserialize(data: CommentBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.text = data.text;
    this.start = Timing.Deserialize(data.start);
    this.end = Timing.Deserialize(data.end);
  }
  //#endregion ISerializable

  //#region IMutableStart
  @action
  public moveStart(newStart: Timing) {
    const delta = newStart.sub(this.start);
    this.start = this.start.add(delta);
    this.end = this.end.add(delta);
  }
  //#endregion

  //#region ICopyable
  public newCopy(): CommentBlock {
    const ret = new CommentBlock();
    ret.start = this.start;
    ret.end = this.end;
    ret.text = this.text;
    return ret;
  }
  //#endregion ICopyable
}
