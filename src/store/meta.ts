import { action, makeObservable, observable } from 'mobx';
import { IClonable, ISerializable } from '../utils';
import { tauri } from '@tauri-apps/api';

export interface LyricsMetadataData {
  title: string;
  artist: string;
  series: string;
  coverImagePath: string;
}

export class LyricsMetadata
  implements ISerializable, IClonable<LyricsMetadata>
{
  @observable
  public title = '';

  @observable
  public artist = '';

  @observable
  public series = '';

  @observable
  public coverImagePath = '';

  @observable
  public coverImageUri = '';

  public constructor() {
    makeObservable(this);
  }

  @action
  public setTitle(title: string) {
    this.title = title;
  }

  @action
  public setArtist(artist: string) {
    this.artist = artist;
  }

  @action
  public setSeries(series: string) {
    this.series = series;
  }

  @action
  public setCoverImagePath(path: string) {
    this.coverImagePath = path;
    this.coverImageUri = tauri.convertFileSrc(this.coverImagePath);
  }

  //#region IClonable
  @action
  public clone(): LyricsMetadata {
    const clone = new LyricsMetadata();
    clone.title = this.title;
    clone.artist = this.artist;
    clone.series = this.series;
    clone.coverImagePath = this.coverImagePath;
    clone.coverImageUri = this.coverImageUri;
    return clone;
  }

  @action
  public copyFrom(other: LyricsMetadata) {
    this.title = other.title;
    this.artist = other.artist;
    this.series = other.series;
    this.coverImagePath = other.coverImagePath;
    this.coverImageUri = other.coverImageUri;
  }

  public equals(other: LyricsMetadata): boolean {
    return (
      this.title === other.title &&
      this.artist === other.artist &&
      this.series === other.series &&
      this.coverImagePath === other.coverImagePath
    );
  }
  //#endregion

  //#region ISerializable
  public serialize(): LyricsMetadataData {
    return {
      title: this.title,
      artist: this.artist,
      series: this.series,
      coverImagePath: this.coverImagePath,
    };
  }

  public deserialize(data: LyricsMetadataData) {
    this.title = data.title;
    this.artist = data.artist;
    this.series = data.series;
    this.setCoverImagePath(data.coverImagePath);
  }
  //#endregion
}
