export function Identity<T>(x: T): T {
  return x;
}

export function UniqueBy<T>(
  arr: T[],
  key: (item: T) => any = Identity<T>,
): T[] {
  const map = new Map<string, T>();
  for (const item of arr) {
    map.set(key(item), item);
  }
  return Array.from(map.values());
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
