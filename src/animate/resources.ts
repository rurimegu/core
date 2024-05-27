import { ISerializable, RES_KEYS } from '../utils';

export type ResourceMappingData = Record<string, string>;

export class ResourceMapping implements ISerializable {
  public resources: Record<string, string> = {};

  public get lyricsPath() {
    return this.resources[RES_KEYS.LYRICS];
  }

  public set lyricsPath(value: string) {
    this.resources[RES_KEYS.LYRICS] = value;
  }

  public get audioPath() {
    return this.resources[RES_KEYS.AUDIO];
  }

  public set audioPath(value: string) {
    this.resources[RES_KEYS.AUDIO] = value;
  }

  //#region ISerializable
  public serialize() {
    return {
      resources: this.resources,
    };
  }

  public deserialize(data: ResourceMappingData) {
    if (data) this.resources = data;
  }
  //#endregion ISerializable
}
