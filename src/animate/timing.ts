import { BpmStore, Timing } from '../store';
import { CeilToMultiple } from '../utils';
import { AnimateConfig, IntervalData } from './config';

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

  public minHintIntervalAt(timing: Timing | number): IntervalData {
    const bpm = this.bpm.at(timing).bpm;
    const beatFrames = this.timeToFrame(60 / bpm);
    const hintLyricsLine = Math.round(
      CeilToMultiple(this.config.minIntervals.hintLyricsLine, beatFrames),
    );
    const hintCallBlock = Math.round(
      CeilToMultiple(this.config.minIntervals.hintCallBlock, beatFrames),
    );
    const sepCallBlock = Math.round(
      CeilToMultiple(this.config.minIntervals.sepCallBlock, beatFrames),
    );
    return { hintLyricsLine, hintCallBlock, sepCallBlock };
  }
}
