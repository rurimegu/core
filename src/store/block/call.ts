import { action, computed, makeObservable, observable, override } from 'mobx';
import { Timing } from '../range';
import {
  BlockBase,
  BlockData,
  BlockDataHelpers,
  BlockType,
  IResizeAction,
  ResizeBlockCmd,
} from './base';
import { Bisect, IWithText } from '../../utils';

const CALLGROUPS_KEY = 'CallGroups';
const TEXTREF_PREFIX = '#ref:';

export enum CallType {
  Hi = 'Hi',
  Fu = 'Fu',
  Fuwa = 'Fuwa',
  Clap = 'Clap',
  Oh = 'Oh',
}

export class CallGroup {
  @observable
  public readonly blocks = observable.array<CallBlock>([], { deep: false });

  public constructor(
    public readonly id: number,
    public readonly type: CallType,
  ) {
    makeObservable(this);
  }

  @computed
  public get length() {
    return this.blocks.length;
  }

  @action
  public add(block: CallBlock) {
    if (block.type !== BlockType.Call) {
      throw new Error(
        `Cannot add block of type ${block.type} to CallGroup of type ${this.type}`,
      );
    }
    const idx = Bisect(this.blocks, (b) => b.start.compare(block.start) >= 0);
    this.blocks.splice(idx, 0, block);
  }

  @action
  public remove(block: CallBlock) {
    const idx = this.blocks.indexOf(block);
    if (idx >= 0) {
      this.blocks.splice(idx, 1);
    }
  }
}

export interface CallBlockData extends BlockData {
  callType: CallType;
  start: string;
  end: string;
  group?: number;
}

export class CallBlock extends BlockBase {
  public override readonly type = BlockType.Call;
  public callType = CallType.Hi;

  @observable
  public start = Timing.INVALID;

  @observable
  public end = Timing.INVALID;

  @observable
  public group?: CallGroup;

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }

  public resizeCmd(
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

  @action
  public setGroup(group: CallGroup | undefined) {
    if (this.group === group) return;
    this.group?.remove(this);
    this.group = group;
    group?.add(this);
  }

  //#region ISerializable
  public serialize(): CallBlockData {
    const ret: CallBlockData = {
      ...super.serialize(),
      callType: this.callType,
      start: this.start.toString(),
      end: this.end.toString(),
    };
    if (this.group) {
      ret.group = this.group.id;
    }
    return ret;
  }

  @override
  public override deserialize(data: CallBlockData & BlockDataHelpers) {
    super.deserialize(data);
    this.callType = data.callType;
    this.start = Timing.Deserialize(data.start);
    this.end = Timing.Deserialize(data.end);
    if (data.group) {
      let callGroups = data.context.get(CALLGROUPS_KEY);
      if (!callGroups) {
        callGroups = new Map<number, CallGroup>();
        data.context.set(CALLGROUPS_KEY, callGroups);
      }

      let group = callGroups.get(data.group);
      if (!group) {
        group = new CallGroup(data.group, data.callType);
        callGroups.set(data.group, group);
      }

      this.setGroup(group);
    }
  }
  //#endregion ISerializable
}

export class CallLyricsBlock extends BlockBase implements IWithText {
  public override readonly type = BlockType.CallLyrics;

  @observable
  public start = Timing.INVALID;

  @observable
  public end = Timing.INVALID;

  @observable
  public text = '';

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }

  @action
  public setRef(target: BlockBase & IWithText) {
    this.text = TEXTREF_PREFIX + target.id;
  }

  @computed
  public get bottomText() {
    return this.text;
  }

  public resizeCmd(
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
}
