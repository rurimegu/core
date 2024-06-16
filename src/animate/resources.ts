import { ISerializable, RES_KEYS } from '../utils';

export class ResourceMapping implements ISerializable {
  public constructor(public readonly resources: Record<string, string>) {}

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

  public get coverPath() {
    return this.resources[RES_KEYS.COVER];
  }

  public set coverPath(value: string) {
    this.resources[RES_KEYS.COVER] = value;
  }

  public get callPath() {
    return this.resources[RES_KEYS.SE_CALL];
  }

  public set callPath(value: string) {
    this.resources[RES_KEYS.SE_CALL] = value;
  }

  //#region ISerializable
  public serialize() {
    return this.resources;
  }
  //#endregion ISerializable
}
