import { runInAction } from 'mobx';
import { CallsTrack } from './track';
import { Timing } from '../range';
import { CallBlock } from './call';
import { Command } from '../../commands';
import { AnnotationBlock } from './annotation';

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

// TODO: Put developer options to editor config.
declare global {
  const process: Process;
}

interface Process {
  env: {
    NODE_ENV: string;
  };
}

export type ResizableBlock = AnnotationBlock | CallBlock;

export function IsDevelopment() {
  console.log('process.env.NODE_ENV', process.env.NODE_ENV);
  return process.env.NODE_ENV === 'production';
}
