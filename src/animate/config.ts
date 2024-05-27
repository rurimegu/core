import { ISerializable } from '../utils';
import { ResourceMapping, ResourceMappingData } from './resources';

export interface AnimateConfigData {
  resources: ResourceMappingData;
}

export class AnimateConfig implements ISerializable {
  public readonly resources = new ResourceMapping();

  //#region ISerializable
  public serialize() {
    return {
      resources: this.resources.serialize(),
    };
  }

  public deserialize(data: AnimateConfigData) {
    this.resources.deserialize(data.resources);
  }
  //#endregion ISerializable
}
