/**
 * A double-ended queue that auto resizes.
 */
export class Deque<T> {
  protected static MIN_HALF_CAPACITY = 16;
  protected items: T[] = [];
  protected frontIdx = Deque.MIN_HALF_CAPACITY;
  protected backIdx = Deque.MIN_HALF_CAPACITY;

  protected resize(newHalfCap: number) {
    if (newHalfCap < Deque.MIN_HALF_CAPACITY) {
      console.warn(
        `Deque is too small while resizing to ${newHalfCap}, expect at least ${Deque.MIN_HALF_CAPACITY}`,
      );
      return;
    }

    const items = this.items.slice(this.frontIdx, this.backIdx);
    this.items = [];
    this.frontIdx = newHalfCap;
    this.backIdx = newHalfCap + items.length;
    for (let i = 0; i < items.length; i++) {
      this.items[this.frontIdx + i] = items[i];
    }
  }

  protected maybeResize() {
    const length = this.backIdx - this.frontIdx;
    if (this.frontIdx === 0) {
      // No empty slots in front
      this.resize(Math.max(Deque.MIN_HALF_CAPACITY, length));
    } else if (this.frontIdx > length * 3) {
      // Too many empty slots in front
      this.resize(Math.max(Deque.MIN_HALF_CAPACITY, length));
    }
  }

  public get length() {
    return this.backIdx - this.frontIdx;
  }

  public get empty() {
    return this.backIdx === this.frontIdx;
  }

  public get front() {
    if (this.empty) return undefined;
    return this.items[this.frontIdx];
  }

  public get back() {
    if (this.empty) return undefined;
    return this.items[this.backIdx - 1];
  }

  public pushBack(item: T) {
    this.maybeResize();
    this.items[this.backIdx++] = item;
  }

  public pushFront(item: T) {
    this.maybeResize();
    this.items[--this.frontIdx] = item;
  }

  public popFront() {
    if (this.empty) {
      console.warn('Deque is empty while popping front');
      return undefined;
    }
    return this.items[this.frontIdx++];
  }

  public popBack() {
    if (this.empty) {
      console.warn('Deque is empty while popping back');
      return undefined;
    }
    return this.items[--this.backIdx];
  }

  public clear() {
    this.frontIdx = this.backIdx = Deque.MIN_HALF_CAPACITY;
    this.items = [];
  }
}

export class RedoQueue<T> extends Deque<T> {
  private undoneSteps = 0;

  protected get headIdx() {
    return this.backIdx - this.undoneSteps;
  }

  public get canRecover() {
    return this.undoneSteps > 0;
  }

  public override get empty() {
    return this.frontIdx === this.headIdx;
  }

  public override get back() {
    if (this.empty) return undefined;
    return this.items[this.headIdx - 1];
  }

  public override pushBack(item: T) {
    this.backIdx = this.headIdx;
    super.pushBack(item);
    this.undoneSteps = 0;
  }

  public override popBack() {
    if (this.empty) {
      console.warn('RedoQueue is empty while popping back');
      return undefined;
    }
    this.undoneSteps++;
    return this.items[this.headIdx];
  }

  public override clear() {
    super.clear();
    this.undoneSteps = 0;
  }

  public recoverBack() {
    if (!this.canRecover) {
      console.warn('RedoQueue has nothing to recover');
      return undefined;
    }
    this.undoneSteps--;
    return this.back;
  }
}

export function RangeArray(end: number): number[];
export function RangeArray(start: number, end: number, step?: number): number[];

export function RangeArray(startOrEnd: number, end = NaN, step = 1): number[] {
  let start = 0;
  if (!isNaN(end)) {
    start = startOrEnd;
  } else {
    end = startOrEnd;
  }

  const length = Math.max(0, Math.ceil((end - start) / step));
  return Array.from({ length }, (_, i) => start + i * step);
}

export type FutureExecutor = (obj: any) => any;
export class FutureMap {
  protected readonly map = new Map<string, any>();
  protected readonly futureMap = new Map<string, FutureExecutor[]>();

  public set(key: string, value: any) {
    this.map.set(key, value);
    const future = this.futureMap.get(key);
    if (future) {
      for (const executor of future) {
        executor(value);
      }
      this.futureMap.delete(key);
    }
  }

  public get(key: string) {
    return this.map.get(key);
  }

  public getOrCreate<T>(key: string, creator: () => T): T {
    let value = this.map.get(key);
    if (value === undefined) {
      value = creator();
      this.set(key, value);
    }
    return value;
  }

  public runWhenReady(key: string, executor: FutureExecutor) {
    const value = this.map.get(key);
    if (value !== undefined) {
      executor(value);
    } else {
      let future = this.futureMap.get(key);
      if (!future) {
        future = [];
        this.futureMap.set(key, future);
      }
      future.push(executor);
    }
  }

  public getAsync(key: string) {
    return new Promise<any>((resolve) => {
      this.runWhenReady(key, resolve);
    });
  }

  public get unresolvedCount() {
    return this.futureMap.size;
  }
}
