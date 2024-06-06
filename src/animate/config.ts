import { ISerializable } from '../utils';
import { ResourceMapping, ResourceMappingData } from './resources';

export interface IntervalData {
  hintLyricsLine: number;
  hintCallLine: number;
}

export interface AnimateConfigData {
  resources: ResourceMappingData;
  fps?: number;
  openFrames?: number;
  width?: number;
  height?: number;
  minIntervals?: IntervalData;
}

export class AnimateConfig implements ISerializable {
  public readonly resources = new ResourceMapping();
  public fps = 60;
  public openFrames = 180;
  public width = 1280;
  public height = 720;
  public minIntervals: IntervalData = {
    hintLyricsLine: 120,
    hintCallLine: 60,
  };

  //#region ISerializable
  public serialize() {
    return {
      resources: this.resources.serialize(),
      fps: this.fps,
      openFrames: this.openFrames,
      width: this.width,
      height: this.height,
      minHintIntervals: this.minIntervals,
    };
  }

  public deserialize(data: AnimateConfigData) {
    this.resources.deserialize(data.resources);
    this.fps = data.fps ?? this.fps;
    this.openFrames = data.openFrames ?? this.openFrames;
    this.width = data.width ?? this.width;
    this.height = data.height ?? this.height;
    this.minIntervals = data.minIntervals ?? this.minIntervals;
  }
  //#endregion ISerializable
}
