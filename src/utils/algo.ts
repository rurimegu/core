import { ValueError } from './error';
import { ISerializable } from './io';

export function Identity<T>(x: T): T {
  return x;
}

export function UniqueBy<T>(
  arr: T[],
  key: (item: T) => any = Identity<T>,
): T[] {
  return Array.from(
    new Map<string, T>(arr.map((item) => [key(item), item])).values(),
  );
}

export function OrderedDiff(a: number[], b: number[]): [number[], number[]] {
  const added: number[] = [];
  const removed: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (a[i] < b[j]) {
      removed.push(a[i]);
      i++;
    } else {
      added.push(b[j]);
      j++;
    }
  }
  removed.push(...a.slice(i));
  added.push(...b.slice(j));
  return [added, removed];
}

export function Diff<T>(a: T[], b: T[]): [T[], T[]] {
  const setA = new Set(a);
  const setB = new Set(b);
  return [b.filter((i) => !setA.has(i)), a.filter((i) => !setB.has(i))];
}

export function ArrayEquals<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  a = a.slice().sort();
  b = b.slice().sort();
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function Intersect<T>(a: T[], b: T[]): T[] {
  const setA = new Set(a);
  return b.filter((i) => setA.has(i));
}

export class Color implements ISerializable {
  public static WHITE = new Color(255, 255, 255);
  public static BLACK = new Color(0, 0, 0);

  constructor(
    public readonly r: number,
    public readonly g: number,
    public readonly b: number,
  ) {}

  public static FromHex(hex: string) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, function (_, r, g, b) {
      return r + r + g + g + b + b;
    });

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? new Color(
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16),
        )
      : undefined;
  }

  public equals(other: Color): boolean {
    return this.r === other.r && this.g === other.g && this.b === other.b;
  }

  public get hex() {
    return (
      '#' +
      ((1 << 24) | (this.r << 16) | (this.g << 8) | this.b)
        .toString(16)
        .slice(1)
        .toUpperCase()
    );
  }

  public toString() {
    return this.hex;
  }

  public tailwindCss(alpha?: number) {
    if (alpha === undefined)
      return `rgb(${this.r} ${this.g} ${this.b} / var(--tw-bg-opacity))`;
    return `rgba(${this.r}, ${this.g}, ${this.b}, ${alpha})`;
  }

  /** Whether the color is dark, useful when displaying text on top of the color */
  public isDark(opacity = 1) {
    return (this.r + this.g + this.b) * opacity < 255 * 3 * 0.7;
  }

  public foregroundColor(opacity = 1) {
    return this.isDark(opacity) ? Color.WHITE : Color.BLACK;
  }

  //#region ISerializable
  public serialize(): string {
    return this.hex;
  }

  public static Deserialize(data: string): Color {
    const color = Color.FromHex(data);
    if (!color) throw new ValueError('Invalid color');
    return color;
  }
}

export function DeepEquals<T>(a: T, b: T): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;
  if (Object.keys(a).length !== Object.keys(b).length) return false;
  for (const key in a) {
    if (!DeepEquals(a[key], b[key])) return false;
  }
  return true;
}
