import { eastAsianWidth } from 'get-east-asian-width';
import { LYRICS_SEP } from './constants';

const LEFT_PARENTHESIS = ['(', '[', '{', '（', '［', '｛'];
const JPN_SMALL = 'ぁぃぅぇぉっゃゅょァィゥェォッャュョ';

export function FormatTime(time: number, precision = 0) {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  let str = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  if (precision > 0) {
    const ms = Math.floor((time % 1) * Math.pow(10, precision));
    str += `.${ms.toString().padStart(precision, '0')}`;
  }
  return str;
}

export function IsFullWidth(code: number) {
  return eastAsianWidth(code) > 1;
}

export function IsHalfWidth(code: number) {
  return eastAsianWidth(code) === 1;
}

export function IsAlnum(code: number) {
  return (
    (code > 47 && code < 58) ||
    (code > 64 && code < 91) ||
    (code > 96 && code < 123)
  );
}

export function IsAlpha(code: number) {
  return (code > 64 && code < 91) || (code > 96 && code < 123);
}

export function IsDigit(code: number) {
  return code > 47 && code < 58;
}

export function IsPunctuation(char: string) {
  return /^\p{P}$/u.test(char);
}

export function IsLeftParenthesis(char: string) {
  return LEFT_PARENTHESIS.includes(char);
}

export function IsSmallKana(char: string) {
  return JPN_SMALL.includes(char);
}

export function IsKana(char: string) {
  return /^[ぁ-ゔァ-ヴ々〆〤]$/.test(char);
}

/**
 * Split a string into words.
 * East Asian characters are treated as a single word.
 */
export function SplitWords(text: string): string[] {
  text = text.replace(/[ 　]+/g, ' ');
  let word = '';
  const words: string[] = [];
  // Push current word to the list and reset the word buffer
  function pushWord() {
    if (word.length > 0) {
      words.push(word);
      word = '';
    }
  }
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const c = text[i];
    if (c === ' ' || c === '\n') {
      // Push the current word and add a space
      pushWord();
      if (words.length === 0 || words[words.length - 1] !== c) {
        words.push(c);
      }
      continue;
    }
    // TODO: Split small kana
    if (IsHalfWidth(code) || (IsPunctuation(c) && !IsLeftParenthesis(c))) {
      // Continue the current word
      word += c;
      continue;
    }
    // East Asian character or left parenthesis
    pushWord();
    word += c;
  }
  pushWord();
  console.log('Split words:', words);
  return words;
}

export function SplitLyrics(text: string): string {
  return text
    .split(/[\r\n]/g)
    .map((line) =>
      line
        .split(LYRICS_SEP)
        .map((s) => SplitWords(s).join(LYRICS_SEP))
        .join(LYRICS_SEP),
    )
    .join('\n');
}

export function SplitLyricsArray(text: string): string[] {
  return text
    .split(/[\r\n]/g)
    .map((line) => line.split(LYRICS_SEP).filter((s) => s))
    .reduce((cur, words) => [...cur, '\n', ...words], []);
}
