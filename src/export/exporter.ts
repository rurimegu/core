import { LyricsStore, LyricsTrack } from '../store';
import { Color, IsFullWidth, OfType } from '../utils';

export interface ExportDataRuby {
  text: string;
  start: number;
  end: number;
}

export interface ExportDataWord {
  text: string;
  start: number;
  end: number;
  ruby: ExportDataRuby[];
  colors: Color[];
}

export interface ExportDataLine {
  words: ExportDataWord[];
}

export class ExportData {
  public readonly lines: ExportDataLine[] = [];

  public constructor(store: LyricsStore) {
    const bpm = store.bpm;
    const blocks = OfType(store.tracks.children, LyricsTrack).flatMap(
      (track) => track.children,
    );
    const words: ExportDataWord[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const word: ExportDataWord = {
        text: block.bottomText,
        start: bpm.barToAudioTime(block.start),
        end: bpm.barToAudioTime(block.end),
        ruby: [],
        colors: block.tags.values.map((tag) => tag.color),
      };
      if (block.children.length > 0) {
        for (const child of block.children) {
          word.ruby.push({
            text: child.text,
            start: bpm.barToAudioTime(child.start),
            end: bpm.barToAudioTime(child.end),
          });
        }
      }
      words.push(word);
      if (block.newline) {
        if (words.length > 0) {
          this.lines.push({ words: words.slice() });
          words.length = 0;
        }
      } else if (block.space) {
        words.push({
          text:
            word.text.length === 0 ||
            IsFullWidth(word.text.charCodeAt(word.text.length - 1))
              ? '　'
              : ' ',
          start: word.end,
          end:
            i === blocks.length - 1
              ? word.end
              : bpm.barToAudioTime(blocks[i + 1].start),
          ruby: [],
          colors: word.colors,
        });
      }
    }
    if (words.length > 0) {
      this.lines.push({ words });
    }
    this.lines.sort((a, b) => a.words[0].start - b.words[0].start);
  }
}
