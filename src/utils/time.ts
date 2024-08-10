import { IClonable } from './types';

class TimeSnapshot implements IClonable<TimeSnapshot> {
  private _time = NaN;
  private _lastUpdate = NaN;

  public get time() {
    return this._time;
  }

  public set time(time: number) {
    this._time = time;
    this._lastUpdate = performance.now();
  }

  public get lastUpdate() {
    return this._lastUpdate;
  }

  public get hasLastUpdate() {
    return !isNaN(this._lastUpdate);
  }

  //#region IClonable
  public clone(): TimeSnapshot {
    const clone = new TimeSnapshot();
    clone._time = this._time;
    clone._lastUpdate = this._lastUpdate;
    return clone;
  }
  //#endregion IClonable
}

export class SmoothTimer {
  private smoothed = new TimeSnapshot();
  private actual = new TimeSnapshot();
  private rate = 1;
  public isPlaying = false;

  public start() {
    this.smoothed = new TimeSnapshot();
    this.actual = new TimeSnapshot();
    this.isPlaying = true;
  }

  public stop() {
    this.isPlaying = false;
  }

  public get time() {
    return this.actual.time;
  }

  public set time(time: number) {
    this.actual.time = time;
    this.smoothed.time = time;
  }

  public set playbackRate(rate: number) {
    this.rate = rate;
  }

  public get smoothTime() {
    return this.smoothed.time;
  }

  protected updateSmoothTime() {
    if (
      !this.isPlaying ||
      !this.actual.hasLastUpdate ||
      !this.smoothed.hasLastUpdate
    ) {
      if (this.actual.hasLastUpdate) this.smoothed.time = this.actual.time;
      return;
    }
    this.smoothed.time +=
      ((performance.now() - this.smoothed.lastUpdate) * this.rate) / 1000;
  }

  public update(time: number) {
    this.updateSmoothTime();
    if (time !== this.actual.time) {
      this.actual.time = time;
      if (!this.smoothed.hasLastUpdate) {
        this.smoothed.time = time;
      } else {
        const diff = this.smoothed.time - time;
        if (Math.abs(diff) >= 0.02) {
          this.smoothed.time -= diff * 0.5;
        }
      }
    }
  }
}
