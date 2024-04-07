import { BpmStore, BpmStoreData } from './bpm';
import { Tracks, TracksData } from './block/tracks';
import { PersistStore, PersistStoreData } from './persist';
import { LyricsTagsData, TagsStore } from './tags';
import { ISerializable } from '../utils/io';
import { DeserializeBlock } from './block/registry';
import { runInAction } from 'mobx';
import { DataError } from '../utils';

interface LyricsStoreData {
  tracks: TracksData;
  bpm: BpmStoreData;
  tags: LyricsTagsData;
  persist: PersistStoreData;
  version: number;
}

export class LyricsStore implements ISerializable {
  public static readonly VERSION = 1;

  public constructor(
    public readonly tracks: Tracks,
    public readonly bpm: BpmStore,
    public readonly persist: PersistStore,
    public readonly tags: TagsStore,
  ) {}

  //#region ISerializable
  public serialize(): LyricsStoreData {
    return {
      tracks: this.tracks.serialize(),
      bpm: this.bpm.serialize(),
      tags: this.tags.serialize(),
      persist: this.persist.serialize(),
      version: LyricsStore.VERSION,
    };
  }

  public deserialize(data: LyricsStoreData) {
    const version = data.version;
    if (version > LyricsStore.VERSION) {
      throw new DataError(
        `Lyrics is from a higher version ${version} > current version ${LyricsStore.VERSION}`,
      );
    }
    runInAction(() => {
      DeserializeBlock(this.tracks, data.tracks);
      this.bpm.deserialize(data.bpm);
      this.tags.deserialize(data.tags);
      this.persist.deserialize(data.persist);
    });
  }
  //#endregion ISerializable
}
