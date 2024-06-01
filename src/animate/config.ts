import { ISerializable } from '../utils';
import { ResourceMapping, ResourceMappingData } from './resources';

export interface IntervalData {
  hintLyricsLine: number;
  hintCallBlock: number;
  sepCallBlock: number;
}

export interface AnimateConfigData {
  resources: ResourceMappingData;
  fps?: number;
  openFrames?: number;
  minIntervals?: IntervalData;
}

export class AnimateConfig implements ISerializable {
  public readonly resources = new ResourceMapping();
  public fps = 60;
  public openFrames = 180;
  public minIntervals: IntervalData = {
    hintLyricsLine: 180,
    hintCallBlock: 180,
    sepCallBlock: 10,
  };

  //#region ISerializable
  public serialize() {
    return {
      resources: this.resources.serialize(),
      fps: this.fps,
      openFrames: this.openFrames,
      minHintIntervals: this.minIntervals,
    };
  }

  public deserialize(data: AnimateConfigData) {
    this.resources.deserialize(data.resources);
    this.fps = data.fps ?? this.fps;
    this.openFrames = data.openFrames ?? this.openFrames;
    this.minIntervals = data.minIntervals ?? this.minIntervals;
  }
  //#endregion ISerializable
}
