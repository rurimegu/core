import { BpmStore, Timing } from '../store';
import { AnimateConfig, IntervalData } from './config';

function getInterval(beatFrame: number, target: number) {
  // Ensures the return value is within [2/3, 4/3] of the target
  while (beatFrame < (target * 2) / 3) {
    beatFrame *= 2;
  }
  return beatFrame;
}

export class AnimateTiming {
  public constructor(
    public readonly duration: number,
    public readonly config: AnimateConfig,
    public readonly bpm: BpmStore,
  ) {}

  public barToFrame(timing: Timing | number): number {
    const time = this.bpm.barToAudioTime(timing);
    return this.timeToFrame(time);
  }

  public timeToFrame(time: number): number {
    return Math.round(time * this.config.fps);
  }

  public frameToTime(frame: number): number {
    return frame / this.config.fps;
  }

  public frameToBar(frame: number): number {
    return this.bpm.audioTimeToBar(this.frameToTime(frame));
  }

  public get maxFrame(): number {
    return this.timeToFrame(this.duration);
  }

  public hintIntervalAt(timing: Timing | number): IntervalData {
    const bpm = this.bpm.at(timing).bpm;
    const beatS = 60 / bpm;
    const hintLyricsLine = getInterval(
      beatS,
      this.config.minIntervals.hintLyricsLine,
    );
    const hintCallLine = getInterval(
      beatS,
      this.config.minIntervals.hintCallLine,
    );
    return { hintLyricsLine, hintCallLine };
  }

  public hintIntervalAtFrame(frame: number): IntervalData {
    return this.hintIntervalAt(this.frameToBar(frame));
  }
}
