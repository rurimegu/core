import { ISerializable } from '../utils/io';

export interface PersistStoreData {
  nextId: number;
}

export class PersistStore implements ISerializable {
  protected nextId_ = 0;

  public get nextId(): number {
    return this.nextId_++;
  }

  //#region ISerializable
  public serialize(): PersistStoreData {
    return {
      nextId: this.nextId_,
    };
  }

  public deserialize(data: PersistStoreData): void {
    this.nextId_ = data.nextId;
  }
  //#endregion ISerializable
}

export const persistStore = new PersistStore();
