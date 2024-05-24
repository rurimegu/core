import { makeObservable, observable, override } from 'mobx';
import {
  BlockBase,
  BlockDataHelpers,
  BlockDataWithText,
  BlockType,
  CommentTrack,
  IResizeAction,
  ResizeBlockCmd,
} from '.';
import { IWithBottomText, IWithText } from '../../utils';
import { Timing } from '../range';

interface CommentBlockData extends BlockDataWithText {
  start: string;
  end: string;
}

export class CommentBlock
  extends BlockBase
  implements IWithText, IWithBottomText
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

  public constructor(id?: string) {
    super(id);
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
  public serialize(): CommentBlockData {
    return {
      ...super.serialize(),
      text: this.text,
      start: this.start.serialize(),
      end: this.end.serialize(),
    };
  }

  public deserialize(data: CommentBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.text = data.text;
    this.start = Timing.Deserialize(data.start);
    this.end = Timing.Deserialize(data.end);
  }
  //#endregion ISerializable
}
