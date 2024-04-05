export const EPSILON = 1e-6;

export enum Side {
  LEFT = -1,
  RIGHT = 1,
}

export enum Direction {
  LEFT = -1,
  RIGHT = 1,
}

export function Sign(x: number, epsilon = EPSILON) {
  return x < -epsilon ? -1 : x > epsilon ? 1 : 0;
}

export function ApproxEqual(a: number, b: number, epsilon = EPSILON) {
  return Sign(a - b, epsilon) === 0;
}

export function ApproxGeq(a: number, b: number, epsilon = EPSILON) {
  return Sign(a - b, epsilon) >= 0;
}

export function ApproxGtr(a: number, b: number, epsilon = EPSILON) {
  return Sign(a - b, epsilon) > 0;
}

export function ApproxLeq(a: number, b: number, epsilon = EPSILON) {
  return Sign(a - b, epsilon) <= 0;
}

export function ApproxLess(a: number, b: number, epsilon = EPSILON) {
  return Sign(a - b, epsilon) < 0;
}

/**
 * Binary search for the first element that does not satisfy the given condition.
 * @param arr Array to search.
 * @param isLeft Function to check if the element is on the left side.
 * @returns The index of the first element that does not satisfy the given condition.
 * If all elements satisfy the condition, returns the length of the array.
 * If no elements satisfy the condition, returns 0.
 * @example
 * ```ts
 * Bisect([1, 2, 3, 4, 5], (x) => x < 3); // 2
 * ```
 * @example
 * ```ts
 * Bisect([1, 2, 3, 4, 5], (x) => x < 1); // 0
 * ```
 * @example
 * ```ts
 * Bisect([1, 2, 3, 4, 5], (x) => x < 6); // 5
 * ```
 */
export function Bisect<T>(arr: T[], isLeft: (a: T) => boolean) {
  let l = 0;
  let r = arr.length;
  while (l < r) {
    const m = (l + r) >> 1;
    if (isLeft(arr[m])) {
      l = m + 1;
    } else {
      r = m;
    }
  }
  return l;
}

export function Clamp(x: number, min: number, max: number) {
  return Math.max(min, Math.min(max, x));
}

export function Clamp01(x: number) {
  return Clamp(x, 0, 1);
}

export function Lerp(a: number, b: number, t: number) {
  return LerpUnclamped(a, b, Clamp01(t));
}

export function LerpUnclamped(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Inverse lerp (unclamped)
 */
export function InverseLerp(a: number, b: number, value: number) {
  if (a !== b) {
    return (value - a) / (b - a);
  }
  return 0;
}

export function FloorToMultiple(x: number, multiple: number) {
  return Math.floor(x / multiple) * multiple;
}

export function CeilToMultiple(x: number, multiple: number) {
  return Math.ceil(x / multiple) * multiple;
}

export function RoundToMultiple(x: number, multiple: number) {
  return Math.round(x / multiple) * multiple;
}

export function Gcd(a: number, b: number) {
  while (b !== 0) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

export function HasAnyFlag(x: number, flag: number) {
  return (x & flag) !== 0;
}

export function HasAllFlag(x: number, flag: number) {
  return (x & flag) === flag;
}

/**
 * Checks if the given array is sorted in ascending order.
 *
 * *Note: This function sorts the array in place.*
 * @param arr Array to check.
 * @returns True if the array is sorted in ascending order, false otherwise.
 */
export function IsConsecutive(arr: number[]) {
  arr.sort();
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1] + 1) {
      return false;
    }
  }
  return true;
}

export interface Coord {
  x: number;
  y: number;
}
