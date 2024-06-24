import {
  action,
  computed,
  makeObservable,
  observable,
  runInAction,
} from 'mobx';
import { ISerializable } from '../utils/io';
import { IClonable } from '../utils/types';
import { Color } from '../utils/algo';
import { FutureMap, RangeArray } from '../utils';
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
    // TODO: Remove
    const tags = RangeArray(9).map(() => new LyricsTag());
    runInAction(() => {
      tags[0].name = '乙宗梢';
      tags[0].color = Color.FromHex('#68BE8D')!;
      tags[1].name = '日野下花帆';
      tags[1].color = Color.FromHex('#F8B500')!;
      tags[2].name = '百世吟子';
      tags[2].color = Color.FromHex('#A2D7DD')!;
      tags[3].name = '夕霧綴理';
      tags[3].color = Color.FromHex('#C22D3B')!;
      tags[4].name = '村野さやか';
      tags[4].color = Color.FromHex('#5383C3')!;
      tags[5].name = '徒町小鈴';
      tags[5].color = Color.FromHex('#FAD764')!;
      tags[6].name = '藤島慈';
      tags[6].color = Color.FromHex('#C8C2C6')!;
      tags[7].name = '大沢瑠璃乃';
      tags[7].color = Color.FromHex('#E7609E')!;
      tags[8].name = '安養寺姫芽';
      tags[8].color = Color.FromHex('#9D8DE2')!;
      this.replaceTags(tags);
    });
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
