import { BpmStore, BpmStoreData } from './bpm';
import { Tracks, TracksData } from './block/tracks';
import { PersistStore, PersistStoreData } from './persist';
import { LyricsTagsData, TagsStore } from './tags';
import { ISerializable } from '../utils/io';
import { DeserializeBlock } from './block/registry';
import { runInAction } from 'mobx';

interface LyricsStoreData {
  tracks: TracksData;
  bpm: BpmStoreData;
  tags: LyricsTagsData;
  persist: PersistStoreData;
}

export class LyricsStore implements ISerializable {
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
    };
  }

  public deserialize(data: LyricsStoreData) {
    runInAction(() => {
      DeserializeBlock(this.tracks, data.tracks);
      this.bpm.deserialize(data.bpm);
      this.tags.deserialize(data.tags);
      this.persist.deserialize(data.persist);
    });
  }
  //#endregion ISerializable
}
