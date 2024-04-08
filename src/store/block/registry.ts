import { ValueError } from '../../utils/error';
import {
  BlockBase,
  BlockData,
  BlockDataHelpers,
  BlockType,
  ParentBlockBase,
} from './base';
import { AnnotationBlock } from './annotation';
import { LyricsBlock } from './lyrics';
import { LyricsTrack } from './track';
import { Tracks } from './tracks';
import { Finalizer } from '../../utils/io';

export const BLOCK_REGISTRY = {
  [BlockType.Lyrics]: LyricsBlock,
  [BlockType.LyricsTrack]: LyricsTrack,
  [BlockType.Tracks]: Tracks,
  [BlockType.Annotation]: AnnotationBlock,
};

export type BlockRegistryType = typeof BLOCK_REGISTRY;

class BlockIdMapping {
  private idMap = new Map<string, BlockBase>();

  public constructor(...blocks: BlockBase[]) {
    blocks.forEach((block: BlockBase) => this.addRecursively(block));
  }

  public addRecursively(block: BlockBase) {
    this.idMap.set(block.id, block);
    if (block instanceof ParentBlockBase) {
      block.children.forEach((child: BlockBase) => this.addRecursively(child));
    }
  }

  public get(id: string) {
    return this.idMap.get(id);
  }
}

export function CreateBlock(
  data: BlockData,
): [BlockBase, Finalizer<BlockBase>] {
  if (data.type === BlockType.Unknown) {
    throw new ValueError('Block type is not defined');
  }
  const BlockClass = BLOCK_REGISTRY[data.type];
  if (!BlockClass) {
    throw new ValueError(`Block type ${data.type} is not registered`);
  }
  const block = new BlockClass(data.id);
  const dataWithHelpers: BlockData & BlockDataHelpers = {
    ...data,
    create: CreateBlock,
  };
  return [block, block.deserialize(dataWithHelpers as any)];
}

export function DeserializeBlock(block: BlockBase, data: BlockData) {
  const dataWithHelpers: BlockData & BlockDataHelpers = {
    ...data,
    create: CreateBlock,
  };
  const finalizer = block.deserialize(dataWithHelpers);
  const mapping = new BlockIdMapping(block);
  finalizer((id) => mapping.get(id));
  return block;
}
