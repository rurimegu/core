import { BpmStore, BpmStoreData } from './bpm';
import { Tracks, TracksData } from './block/tracks';
import { PersistStoreData, persistStore } from './persist';
import { LyricsTagsData, TagsStore } from './tags';
import { IDeserializable, ISerializable } from '../utils/io';
import { DeserializeBlock } from './block/registry';
import { runInAction } from 'mobx';
import { DataError, FutureMap } from '../utils';
import { LyricsMetadata, LyricsMetadataData } from './meta';
import { LyricsBlock } from './block';

export interface LyricsStoreData {
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
    public readonly persist = persistStore,
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
    const context = new FutureMap();
    runInAction(() => {
      if (data.tracks) DeserializeBlock(this.tracks, data.tracks, context);
      else this.tracks.clear();

      if (data.bpm) this.bpm.deserialize(data.bpm);
      else this.bpm.clear();

      if (data.tags) this.tags.deserialize(data.tags, context);
      else this.tags.clear();

      if (data.meta) this.meta.deserialize(data.meta);
      else this.meta.clear();

      // Must be last since IDs might change during deserialization
      this.persist.deserialize(data.persist ?? { nextId: 0 });

      // Check for unresolved references
      if (context.unresolvedCount > 0) {
        console.warn('Failed to resolve:', context);
        throw new DataError(
          `Failed to resolve ${context.unresolvedCount} references`,
        );
      }
    });
  }

  public clear() {
    this.deserialize({
      version: LyricsStore.VERSION,
    } as LyricsStoreData);
  }
  //#endregion ISerializable
}
