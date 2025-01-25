import { LyricsStore } from '../store';
import { ApproxEqual } from '../utils';
import { ExportData, ExportDataLine, ExportDataWord } from './exporter';

const VTT_HEADER = `WEBVTT

STYLE
::cue:past {
  color: gray;
}
::cue:future {
  color: lightblue;
}`;

function FormatVttTime(time: number) {
  const hours = Math.floor(time / 3600)
    .toString()
    .padStart(2, '0');
  const minutes = Math.floor((time % 3600) / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(time % 60)
    .toString()
    .padStart(2, '0');
  const milliseconds = Math.floor((time % 1) * 1000)
    .toString()
    .padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function GenerateVttWord(word: ExportDataWord): string {
  if (word.ruby.length === 0) return word.text;
  return word.text;
}

function GenerateVttLines(line: ExportDataLine): string[] {
  const ret: string[] = [];
  const words = line.words;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (i && !ApproxEqual(words[i - 1].start, word.start)) {
      ret.push(`<${FormatVttTime(word.start)}>`);
    }
    ret.push(GenerateVttWord(word));
  }
  return [
    `${FormatVttTime(words[0].start)} --> ${FormatVttTime(
      words[words.length - 1].end,
    )}\n${ret.join('')}`,
  ];
}

export function ExportToVtt(lyrics: LyricsStore): string {
  const exportData = new ExportData(lyrics);
  const vttLines = exportData.lines
    .flatMap(GenerateVttLines)
    .map((str, i) => `${i + 1}\n${str}\n`)
    .join('\n');
  return `${VTT_HEADER}\n\n${vttLines}`;
}
