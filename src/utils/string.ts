import { eastAsianWidth } from 'get-east-asian-width';
import { LYRICS_SEP } from './constants';

const PUNCTUATIONS = ['ー'];
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
  return /^\p{P}$/u.test(char) || PUNCTUATIONS.includes(char);
}

export function IsLeftParenthesis(char: string) {
  return /^\p{Ps}$/u.test(char);
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

  // Split words with furigana
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
    const c = text[i];

    // Handle left parenthesis.
    if (IsLeftParenthesis(c)) {
      // Left parenthesis can be used to start a new word
      pushWord();
      word = c;
      continue;
    }

    // Other punctuations.
    if (IsPunctuation(c)) {
      pushWord();
      if (words.length > 0) {
        words[words.length - 1] += c;
      } else {
        words.push(c);
      }
      continue;
    }

    // Handle spaces.
    let j = i;
    while (/^\s$/u.test(text[j])) j++;
    if (j !== i) {
      // Push the current word and add a space
      pushWord();
      words.push(' ');
      i = j - 1;
      continue;
    }

    // English words.
    j = i;
    while (
      j < text.length &&
      !/^\s$/u.test(text[j]) &&
      IsHalfWidth(text.charCodeAt(j))
    )
      j++;
    if (j !== i) {
      word += text.slice(i, j);
      pushWord();
      i = j - 1;
      continue;
    }

    // Kana.
    if (IsKana(c)) {
      j = i + 1;
      while (IsSmallKana(text[j]) || text[j] === 'ー') j++;
      word += text.slice(i, j);
      pushWord();
      i = j - 1;
      continue;
    }

    word += c;
    pushWord();
  }
  pushWord();
  return words;
}

export function SplitLyrics(text: string): string {
  const lines = text.split(/[\r\n]/g).map((line) => {
    return line
      .split(LYRICS_SEP)
      .map((s) => SplitWords(s).join(LYRICS_SEP))
      .join(LYRICS_SEP);
  });
  return lines.join('\n');
}

export function SplitLyricsArray(text: string): string[] {
  return text
    .split(/[\r\n]/g)
    .map((line) => line.split(LYRICS_SEP).filter((s) => s))
    .reduce((cur, words) => [...cur, '\n', ...words]);
}

export function ClipString(str: string, length: number) {
  return str.length > length ? str.slice(0, length) + '...' : str;
}

export function RemoveTrailing0(numStr: string): string {
  if (!numStr.includes('.')) {
    return numStr;
  }
  for (let i = numStr.length - 1; i >= 0; i--) {
    if (numStr[i] !== '0') {
      return numStr.slice(0, numStr[i] === '.' ? i : i + 1);
    }
  }
  return '0';
}
