import { action, computed, makeObservable, observable } from 'mobx';
import { ISerializable } from '../utils/io';
import { IClonable } from '../utils/types';
import { Color } from '../utils/algo';
import { FutureMap } from '../utils';
import { UniqueRefGroup } from '../utils/ref';
import { persistStore } from './persist';

interface LyricsTagData {
  id: string;
  name: string;
  color: string;
}

export interface LyricsTagsData {
  tags: LyricsTagData[];
}

export class LyricsTag implements ISerializable, IClonable<LyricsTag> {
  @observable
  public id: string;

  @observable
  public name = 'New tag';

  @observable
  public color = Color.WHITE;

  public constructor() {
    this.id = `tag-${persistStore.nextId}`;
    makeObservable(this);
  }

  public equals(other: LyricsTag): boolean {
    return (
      this.id === other.id &&
      this.name === other.name &&
      this.color.equals(other.color)
    );
  }

  //#region ISerializable
  public serialize(): LyricsTagData {
    return {
      id: this.id,
      name: this.name,
      color: this.color.serialize(),
    };
  }

  @action
  public deserialize(data: LyricsTagData): void {
    this.id = data.id;
    this.name = data.name;
    this.color = Color.Deserialize(data.color);
  }
  //#endregion ISerializable

  //#region IClonable
  public clone(): LyricsTag {
    const tag = new LyricsTag();
    tag.deserialize(this.serialize());
    return tag;
  }
  //#endregion
}

export class TagsStore implements ISerializable {
  @observable
  protected tags_ = observable.array<LyricsTag>([], {
    deep: false,
  });

  public constructor() {
    makeObservable(this);
  }

  @action
  public addTag(tag: LyricsTag): void {
    if (this.hasTag(tag.id)) return;
    this.tags_.push(tag);
  }

  @action
  public removeTag(id: string): void {
    const tag = this.getTag(id);
    if (!tag) return;
    this.tags_.remove(tag);
  }

  /**
   * Replaces all tags with the given list.
   * @param tags The new list of tags.
   * @returns The list of tags that were removed.
   */
  @action
  public replaceTags(tags: LyricsTag[]): LyricsTag[] {
    const toRemove = this.tags_.filter((tag) =>
      tags.every((t) => t.id !== tag.id),
    );
    const newTags = tags.map((t) => {
      const existing = this.getTag(t.id);
      if (existing) {
        existing.deserialize(t.serialize());
        return existing;
      }
      return t;
    });
    this.tags_.replace(newTags);
    return toRemove;
  }

  @action
  public clear(): void {
    this.tags_.clear();
  }

  public getTag(id: string): LyricsTag | undefined {
    return this.tags_.find((tag) => tag.id === id);
  }

  public hasTag(id: string): boolean {
    return this.getTag(id) !== undefined;
  }

  @computed
  public get tagList(): LyricsTag[] {
    return this.tags_;
  }

  @computed
  public get length(): number {
    return this.tags_.length;
  }

  //#region ISerializable
  public serialize(): LyricsTagsData {
    return {
      tags: this.tags_.map((tag) => tag.serialize()),
    };
  }

  @action
  public deserialize(data: LyricsTagsData, context: FutureMap): void {
    this.clear();
    for (const tagData of data.tags) {
      const tag = new LyricsTag();
      tag.deserialize(tagData);
      context.set(tag.id, tag);
      this.addTag(tag);
    }
  }
  //#endregion ISerializable
}

export class TagsGroup extends UniqueRefGroup<LyricsTag> {}

export interface IWithTags {
  tags: TagsGroup;
}
