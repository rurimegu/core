import { BpmStore, BpmStoreData } from './bpm';
import { Tracks, TracksData } from './block/tracks';
import { PersistStore, PersistStoreData } from './persist';
import { LyricsTagsData, TagsStore } from './tags';
import { IDeserializable, ISerializable } from '../utils/io';
import { DeserializeBlock } from './block/registry';
import { runInAction } from 'mobx';
import { DataError } from '../utils';
import { LyricsMetadata, LyricsMetadataData } from './meta';
import { LyricsBlock } from './block';

interface LyricsStoreData {
  tracks: TracksData;
  bpm: BpmStoreData;
  tags: LyricsTagsData;
  persist: PersistStoreData;
  meta: LyricsMetadataData;
  version: number;
}

export class LyricsStore implements ISerializable, IDeserializable {
  public static readonly VERSION = 1;

  public constructor(
    public readonly tracks = new Tracks(),
    public readonly bpm = new BpmStore(),
    public readonly persist = new PersistStore(),
    public readonly tags = new TagsStore(),
    public readonly meta = new LyricsMetadata(),
  ) {
    LyricsBlock.tagsStore = tags;
  }

  //#region ISerializable
  public serialize(): LyricsStoreData {
    return {
      tracks: this.tracks.serialize(),
      bpm: this.bpm.serialize(),
      tags: this.tags.serialize(),
      persist: this.persist.serialize(),
      meta: this.meta.serialize(),
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
      if (data.bpm) this.bpm.deserialize(data.bpm);
      if (data.tags) this.tags.deserialize(data.tags);
      if (data.persist) this.persist.deserialize(data.persist);
      if (data.meta) this.meta.deserialize(data.meta);
    });
  }
  //#endregion ISerializable
}
