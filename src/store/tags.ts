import {
  action,
  comparer,
  computed,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';
import { ISerializable } from '../utils/io';
import _ from 'lodash';
import { IClonable } from '../utils/types';
import { Color } from '../utils/algo';

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
  public name = 'New tag';

  @observable
  public color = Color.WHITE;

  public constructor(public readonly id: string = '') {
    if (!id) {
      this.id = _.uniqueId('tag-');
    }
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
  //#endregion ISerializable

  //#region IClonable
  public clone(): LyricsTag {
    const tag = new LyricsTag(this.id);
    tag.name = this.name;
    tag.color = this.color;
    return tag;
  }
  //#endregion
}

export class TagsStore implements ISerializable {
  @observable
  protected tags_ = observable.map<string, LyricsTag>(
    {},
    {
      deep: false,
    },
  );

  @observable
  protected tagsOrder_ = observable.array<string>([], {
    deep: false,
  });

  public constructor() {
    makeObservable(this);
    // TODO: Remove
    const tag1 = new LyricsTag();
    const tag2 = new LyricsTag();
    runInAction(() => {
      tag1.name = '大沢瑠璃乃';
      tag1.color = Color.FromHex('#E7609E')!;
      tag2.name = '藤島慈';
      tag2.color = Color.FromHex('#C8C2C6')!;
      this.replaceTags([tag1, tag2]);
    });
  }

  public createRef(): TagsRef {
    return new TagsRef(this);
  }

  @action
  public addTag(tag: LyricsTag): void {
    this.tags_.set(tag.id, tag);
    this.tagsOrder_.push(tag.id);
  }

  @action
  public removeTag(id: string): void {
    this.tagsOrder_.remove(id);
    this.tags_.delete(id);
  }

  @action
  public replaceTags(tags: LyricsTag[]): void {
    this.tags_.clear();
    this.tagsOrder_.clear();
    for (const tag of tags) {
      this.addTag(tag);
    }
  }

  public getTag(id: string): LyricsTag | undefined {
    return this.tags_.get(id);
  }

  public hasTag(id: string): boolean {
    return this.tags_.has(id);
  }

  @computed({ equals: comparer.shallow })
  public get tagIds(): string[] {
    return this.tagsOrder_;
  }

  @computed({ equals: comparer.shallow })
  public get tagList(): LyricsTag[] {
    return this.tagsOrder_.map((id) => this.tags_.get(id)!);
  }

  //#region ISerializable
  public serialize(): LyricsTagsData {
    return {
      tags: this.tagsOrder_.map((id) => this.tags_.get(id)!.serialize()),
    };
  }

  @action
  public deserialize(data: LyricsTagsData): void {
    this.tags_.clear();
    this.tagsOrder_.clear();
    for (const tagData of data.tags) {
      const tag = new LyricsTag(tagData.id);
      tag.name = tagData.name;
      tag.color = Color.Deserialize(tagData.color);
      this.addTag(tag);
    }
  }
  //#endregion ISerializable
}

export interface IWithTags {
  tags: TagsRef;
}

export class TagsRef implements ISerializable {
  @observable protected _tags = observable.array<string>([], { deep: false });

  public constructor(public readonly store: TagsStore) {
    makeObservable(this);
  }

  @computed({ equals: comparer.shallow })
  public get tags(): LyricsTag[] {
    const tags = this._tags.map((id) => this.store.getTag(id));
    for (let i = tags.length - 1; i >= 0; i--) {
      if (!tags[i]) this._tags.splice(i, 1);
    }
    return tags.filter((t) => t) as LyricsTag[];
  }

  @computed({ equals: comparer.shallow })
  public get tagIds(): string[] {
    return this._tags;
  }

  @action
  public removeTag(id: string): void {
    this._tags.remove(id);
  }

  @action
  public addTag(id: string): void {
    if (this._tags.includes(id)) return;
    const tag = this.store.getTag(id);
    if (!tag) return;
    this._tags.push(id);
  }

  //#region ISerializable
  public serialize(): string[] {
    return this._tags;
  }

  @action
  public deserialize(data: string[]) {
    this._tags.replace(data);
  }
  //#endregion ISerializable
}
