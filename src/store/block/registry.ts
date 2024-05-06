import { DataError, ValueError } from '../../utils/error';
import { BlockBase, BlockData, BlockDataHelpers, BlockType } from './base';
import { AnnotationBlock } from './annotation';
import { LyricsBlock } from './lyrics';
import { CallsTrack, LyricsTrack } from './track';
import { Tracks } from './tracks';
import { CallBlock, SingAlongBlock } from './call';
import { FutureMap } from '../../utils';

export const BLOCK_REGISTRY = {
  [BlockType.Lyrics]: LyricsBlock,
  [BlockType.LyricsTrack]: LyricsTrack,
  [BlockType.CallsTrack]: CallsTrack,
  [BlockType.Tracks]: Tracks,
  [BlockType.Annotation]: AnnotationBlock,
  [BlockType.Call]: CallBlock,
  [BlockType.SingAlong]: SingAlongBlock,
};

export type BlockRegistryType = typeof BLOCK_REGISTRY;
export type ResizableBlock = AnnotationBlock | LyricsBlock | CallBlock;

export function CreateBlock(data: BlockData & BlockDataHelpers): BlockBase {
  if (data.type === BlockType.Unknown) {
    throw new ValueError('Block type is not defined');
  }
  const BlockClass = BLOCK_REGISTRY[data.type];
  if (!BlockClass) {
    throw new ValueError(`Block type ${data.type} is not registered`);
  }
  const block = new BlockClass(data.id);
  block.deserialize(data as any);
  return block;
}

export function DeserializeBlock(block: BlockBase, data: BlockData) {
  const dataWithHelpers: BlockData & BlockDataHelpers = {
    ...data,
    create: CreateBlock,
    context: new FutureMap(),
  };
  block.deserialize(dataWithHelpers);
  if (dataWithHelpers.context.unresolvedCount > 0) {
    throw new DataError(
      `Failed to resolve ${dataWithHelpers.context.unresolvedCount} references`,
    );
  }
  return block;
}
