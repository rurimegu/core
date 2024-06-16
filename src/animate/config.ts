import { DataError, ISerializable, OptionalAssignRecursive } from '../utils';
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
  metaColumn?: RenderTemplateTypeData;
}

export interface AnimateConfigData {
  resources: ResourceMappingData;
  fps?: number;
  openTime?: number;
  width?: number;
  height?: number;
  minIntervals?: IntervalData;
  template?: RenderTemplateData;
  version?: number;
}

export class AnimateConfig implements ISerializable {
  public static readonly VERSION = 1;

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
  public readonly version = AnimateConfig.VERSION;

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
  public serialize(): AnimateConfigData {
    return {
      resources: this.resources.serialize(),
      fps: this.fps,
      openTime: this.openTime,
      width: this.width,
      height: this.height,
      minIntervals: this.minIntervals,
      template: this.template,
      version: this.version,
    };
  }

  public deserialize(data: AnimateConfigData) {
    if (data.version && data.version > this.version) {
      throw new DataError(
        `Unsupported version ${data.version}, loader version ${this.version}`,
      );
    }
    this.resources.deserialize(data.resources);
    this.fps = data.fps ?? this.fps;
    this.openTime = data.openTime ?? this.openTime;
    this.width = data.width ?? this.width;
    this.height = data.height ?? this.height;
    this.minIntervals = data.minIntervals ?? this.minIntervals;
    if (data.template) OptionalAssignRecursive(this.template, data.template);
    else this.template = {};
  }
  //#endregion ISerializable
}
