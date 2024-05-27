import { action, computed, makeObservable, observable } from 'mobx';
import { Timing } from './range';
import { InvalidStateError, ValueError } from '../utils/error';
import { IDeserializable, ISerializable } from '../utils/io';
import { persistStore } from './persist';
import { IClonable } from '../utils/types';
import { DEFAULT_BPM_DIV } from '../utils';

interface BpmData {
  id: string;
  time: string;
  bpm: number;
  div: number;
}

export interface BpmStoreData {
  bpms: BpmData[];
  offset: number;
}

export class Bpm implements ISerializable, IClonable<Bpm> {
  @observable
  public time: Timing;

  @observable
  public bpm: number;

  @observable
  public div: number;

  public constructor(
    public readonly id: string,
    time: Timing,
    bpm: number,
    div: number,
  ) {
    if (bpm < 1) {
      throw new ValueError(`BPM must be >= 1, got ${bpm}`);
    }
    if (div < 1) {
      throw new ValueError(`Div must be >= 1, got ${div}`);
    }
    makeObservable(this);
    this.time = time;
    this.bpm = bpm;
    this.div = div;
  }

  @computed
  public get barLen(): number {
    return 60 / this.bpm;
  }

  @action
  public setTime(time: Timing) {
    this.time = time;
  }

  @action
  public setBpm(bpm: number) {
    this.bpm = bpm;
  }

  @action
  public setDiv(div: number) {
    this.div = div;
  }

  public clone(): Bpm {
    return new Bpm(this.id, this.time, this.bpm, this.div);
  }

  public equals(rhs: Bpm): boolean {
    return this.time.equals(rhs.time) && this.bpm === rhs.bpm;
  }

  //#region ISerializable
  public serialize(): BpmData {
    return {
      id: this.id,
      time: this.time.serialize(),
      bpm: this.bpm,
      div: this.div,
    };
  }

  public static Deserialize(data: BpmData): Bpm {
    return new Bpm(
      data.id,
      Timing.Deserialize(data.time),
      data.bpm,
      data.div ?? DEFAULT_BPM_DIV,
    );
  }
  //#endregion ISerializable
}

export class BpmStore implements ISerializable, IDeserializable {
  @observable
  public bpmPoints = observable.array<Bpm>([], {
    deep: false,
  });

  /** Offset in microseconds */
  @observable
  public offset = 0;

  public constructor() {
    makeObservable(this);
    this.bpmPoints.push(this.newBpm(new Timing(0, 0, 1), 120, DEFAULT_BPM_DIV));
  }

  public get offsetS(): number {
    return this.offset / 1000;
  }

  public barToAudioTime(bar: number | Timing): number {
    if (bar instanceof Timing) {
      bar = bar.value;
    }
    let time = -this.offsetS;
    for (let i = 0; i < this.bpmPoints.length; i++) {
      const bpm = this.bpmPoints[i];
      const next = this.bpmPoints[i + 1];
      if (next && bar > next.time.value) {
        // Bar is after this BPM segment
        time += (next.time.value - bpm.time.value) * bpm.barLen;
        continue;
      }
      // Bar is within this BPM segment
      time += (bar - bpm.time.value) * bpm.barLen;
      return time;
    }
    throw new InvalidStateError('No BPM points, expect at least 1');
  }

  public audioTimeToBar(time: number): number {
    let bar = 0;
    time -= this.offsetS;

    for (let i = 0; i < this.bpmPoints.length; i++) {
      const bpm = this.bpmPoints[i];
      const next = this.bpmPoints[i + 1];
      if (next) {
        const segBar = next.time.value - bpm.time.value;
        const segSec = segBar * bpm.barLen;
        if (time > segSec) {
          // Time is after this BPM segment
          bar += segBar;
          time -= segSec;
          continue;
        }
      }
      // Time is within this BPM segment
      bar += time / bpm.barLen;
      return bar;
    }
    throw new InvalidStateError('No BPM points, expect at least 1');
  }

  @action
  public newBpm(time: Timing, bpm: number, div: number): Bpm {
    return new Bpm(`bpm-${persistStore.nextId}`, time, bpm, div);
  }

  @action
  public setBpmAndOffset(bpms: Bpm[], offset: number) {
    this.bpmPoints.replace(bpms);
    this.offset = offset;
  }

  //#region ISerializable
  public serialize(): BpmStoreData {
    return {
      bpms: this.bpmPoints.map((bpm) => bpm.serialize()),
      offset: this.offset,
    };
  }

  @action
  public deserialize(data: BpmStoreData) {
    this.bpmPoints.replace(data.bpms.map((bpm) => Bpm.Deserialize(bpm)));
    this.offset = data.offset;
  }
  //#endregion ISerializable
}
