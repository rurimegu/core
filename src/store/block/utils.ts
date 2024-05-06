import { runInAction } from 'mobx';
import { CallsTrack } from './track';
import { Timing } from '../range';
import { CallBlock } from './call';
import { Command } from '../../commands';

export function insertCallBlock(
  track: CallsTrack,
  text: string,
  start: Timing,
  alignDiv: number,
): Command {
  return runInAction(() => {
    const end = start.lowerBound(alignDiv).upperBound(alignDiv);
    const block = new CallBlock();
    block.text = text;
    block.start = start;
    block.end = end;
    return track.insertCmd(alignDiv, block);
  });
}
