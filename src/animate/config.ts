import { template } from 'lodash';
import { ISerializable, OptionallAssignRecursive } from '../utils';
import { ResourceMapping, ResourceMappingData } from './resources';

export interface IntervalData {
  hintLyricsLine: number;
  hintCallLine: number;
}

export interface RenderTemplateTypeData {
  type: string;
  options?: Record<string, any>;
}

export interface RenderTemplateData {
  lyricsBlock?: RenderTemplateTypeData;
  lyricsHint?: RenderTemplateTypeData;
  lyricsColumn?: RenderTemplateTypeData;
}

export interface AnimateConfigData {
  resources: ResourceMappingData;
  fps?: number;
  openTime?: number;
  width?: number;
  height?: number;
  minIntervals?: IntervalData;
  template?: RenderTemplateData;
}

export class AnimateConfig implements ISerializable {
  public readonly resources = new ResourceMapping();
  public fps = 60;
  public openTime = 3;
  public width = 1280;
  public height = 720;
  public minIntervals: IntervalData = {
    hintLyricsLine: 3,
    hintCallLine: 1.5,
  };
  public template: RenderTemplateData = {};

  //#region Timing
  public timeToFrame(s: number) {
    return Math.round(s * this.fps);
  }

  public frameToTime(frame: number) {
    return frame / this.fps;
  }

  public get openFrames() {
    return this.timeToFrame(this.openTime);
  }
  //#endregion Timing

  //#region ISerializable
  public serialize() {
    return {
      resources: this.resources.serialize(),
      fps: this.fps,
      openTime: this.openTime,
      width: this.width,
      height: this.height,
      minHintIntervals: this.minIntervals,
      template,
    };
  }

  public deserialize(data: AnimateConfigData) {
    this.resources.deserialize(data.resources);
    this.fps = data.fps ?? this.fps;
    this.openTime = data.openTime ?? this.openTime;
    this.width = data.width ?? this.width;
    this.height = data.height ?? this.height;
    this.minIntervals = data.minIntervals ?? this.minIntervals;
    if (data.template) OptionallAssignRecursive(this.template, data.template);
    else this.template = {};
  }
  //#endregion ISerializable
}
