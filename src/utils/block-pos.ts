import { RenderDataBase } from '@rurino/core';
import {
  Bisect,
  Lerp,
  InverseLerp,
  ApproxLeq,
  ApproxGeq,
  ApproxLess,
} from '../utils';

/** Left - Returns right position of previous block.
 *
 * Lerp - Linear interpolation between two blocks.
 *
 * Right - Returns left position of next block. */
type SpaceInterpolationStrategy = 'left' | 'lerp' | 'right';

export class BlockPositions {
  public constructor(
    public readonly blocks: RenderDataBase[],
    public readonly rects: DOMRect[],
  ) {
    if (blocks.length !== rects.length) {
      throw new Error(
        `Blocks and rects must have the same length, got ${blocks.length} and ${rects.length}`,
      );
    }
  }

  public get isEmpty() {
    return this.blocks.length === 0;
  }

  /**
   * Get the position of the block at the given time.
   * @param time Query time.
   * @param leftmost If true, return the leftmost position of the block if block has 0 duration. Otherwise, return the rightmost position.
   * @param
   * @returns Position in pixels.
   */
  public positionAt(
    time: number,
    leftmost: boolean,
    spaceInterpolation: SpaceInterpolationStrategy,
  ) {
    if (this.blocks.length === 0) return 0;
    const idx = Bisect(this.blocks, (x) =>
      leftmost ? ApproxLeq(x.end, time) : ApproxLess(x.end, time),
    );
    if (idx >= this.blocks.length) return this.rects[idx - 1].right;
    const block = this.blocks[idx];
    if (ApproxGeq(time, block.start)) {
      return Lerp(
        this.rects[idx].left,
        this.rects[idx].right,
        InverseLerp(block.start, block.end, time),
      );
    }

    // Interpolate space between blocks
    if (idx === 0) return this.rects[0].left;
    const { left, right } = this.rects[idx - 1];
    if (spaceInterpolation === 'left') {
      return left;
    }
    if (spaceInterpolation === 'right') {
      return right;
    }
    const t = InverseLerp(this.blocks[idx - 1].end, block.start, time);
    const ret = Lerp(left, right, t);
    return ret;
  }
}
