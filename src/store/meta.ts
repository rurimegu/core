import { action, makeObservable, observable } from 'mobx';
import { DeepEquals, IClonable, ISerializable } from '../utils';

export interface LyricsMetadataData {
  title: string;
  artist: string;
  series: string;
  lyricist: string;
  composer: string;
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
  public lyricist = '';

  @observable
  public composer = '';

  @observable
  public coverImagePath = '';

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
  public setLyricist(lyricist: string) {
    this.lyricist = lyricist;
  }

  @action
  public setComposer(composer: string) {
    this.composer = composer;
  }

  @action
  public setCoverImagePath(path: string) {
    this.coverImagePath = path;
  }

  //#region IClonable
  @action
  public clone(): LyricsMetadata {
    const clone = new LyricsMetadata();
    clone.copyFrom(this);
    return clone;
  }

  @action
  public copyFrom(other: LyricsMetadata) {
    this.deserialize(other.serialize());
  }

  public equals(other: LyricsMetadata): boolean {
    return DeepEquals(this.serialize(), other.serialize());
  }
  //#endregion

  //#region ISerializable
  public serialize(): LyricsMetadataData {
    return {
      title: this.title,
      artist: this.artist,
      series: this.series,
      lyricist: this.lyricist,
      composer: this.composer,
      coverImagePath: this.coverImagePath,
    };
  }

  public deserialize(data: LyricsMetadataData) {
    this.title = data.title;
    this.artist = data.artist;
    this.series = data.series;
    this.lyricist = data.lyricist;
    this.composer = data.composer;
    this.coverImagePath = data.coverImagePath;
  }
  //#endregion
}
