import { ISerializable } from '../utils';
import { ResourceMapping, ResourceMappingData } from './resources';

export interface HintIntervalData {
  lyricsLine: number;
  callBlock: number;
}

export interface AnimateConfigData {
  resources: ResourceMappingData;
  fps?: number;
  openFrames?: number;
  minHintIntervals?: HintIntervalData;
}

export class AnimateConfig implements ISerializable {
  public readonly resources = new ResourceMapping();
  public fps = 60;
  public openFrames = 180;
  public minHintIntervals: HintIntervalData = {
    lyricsLine: 180,
    callBlock: 180,
  };

  //#region ISerializable
  public serialize() {
    return {
      resources: this.resources.serialize(),
      fps: this.fps,
      openFrames: this.openFrames,
      minHintIntervals: this.minHintIntervals,
    };
  }

  public deserialize(data: AnimateConfigData) {
    this.resources.deserialize(data.resources);
    this.fps = data.fps ?? this.fps;
    this.openFrames = data.openFrames ?? this.openFrames;
    this.minHintIntervals = data.minHintIntervals ?? this.minHintIntervals;
  }
  //#endregion ISerializable
}
