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
import { Bisect, EnumValues, IWithText, RemoveUndefined } from '../../utils';
import { MRef, refManager } from './utils';
import { LyricsBlock } from './lyrics';
import { CallsTrack } from './track';

const CALLGROUPS_KEY = 'CallGroups';

export enum CallType {
  Hi = 'Hi',
  Fu = 'Fu',
  Fuwa = 'Fuwa',
  Clap = '👏',
  U = 'U-',
  O = 'O-',
}

export class CallGroup {
  @observable
  public readonly blocks = observable.array<CallBlock>([], { deep: false });

  public constructor(
    public readonly id: number,
    public readonly type: string,
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
  text?: string;
  start: string;
  end: string;
  group?: number;
  ref?: string;
}

export class CallBlock extends BlockBase implements IWithText {
  public override readonly type: BlockType = BlockType.Call;

  @observable
  public text_ = CallType.Hi as string;

  @observable
  public start = Timing.INVALID;

  @observable
  public end = Timing.INVALID;

  @observable
  public group?: CallGroup;

  @observable
  public ref = new MRef<LyricsBlock>(refManager);

  @override
  public override get parent() {
    return this.parent_ as CallsTrack;
  }

  public constructor(id?: string) {
    super(id);
    makeObservable(this);
  }

  @action
  public setRef(target: LyricsBlock | undefined) {
    this.ref.set(target);
  }

  public get text() {
    return this.text_;
  }

  public set text(text: string) {
    this.text_ = text;
    this.setRef(undefined);
  }

  @computed
  public get bottomText() {
    return this.ref.get()?.bottomText ?? this.text_;
  }

  @computed
  public get isRef() {
    return this.ref.get() !== undefined;
  }

  @computed
  public get isPreset() {
    return EnumValues(CallType).includes(this.text_);
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
    return RemoveUndefined({
      ...super.serialize(),
      start: this.start.toString(),
      end: this.end.toString(),
      group: this.group?.id,
      ref: this.ref.get()?.id,
      text: this.text,
    });
  }

  @override
  public override deserialize(data: CallBlockData & BlockDataHelpers) {
    super.deserialize(data);
    if (data.text) this.text = data.text;
    this.start = Timing.Deserialize(data.start);
    this.end = Timing.Deserialize(data.end);
    if (data.group) {
      let callGroups: Map<number, CallGroup> = data.context.get(CALLGROUPS_KEY);
      if (!callGroups) {
        callGroups = new Map<number, CallGroup>();
        data.context.set(CALLGROUPS_KEY, callGroups);
      }

      let group = callGroups.get(data.group);
      if (!group) {
        group = new CallGroup(data.group, this.text);
        callGroups.set(data.group, group);
      }

      this.setGroup(group);
    }
    if (data.ref) {
      data.context.runWhenReady(data.ref, (ref: LyricsBlock) =>
        this.setRef(ref),
      );
    }
  }
  //#endregion ISerializable
}
