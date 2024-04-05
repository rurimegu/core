import { action, computed, makeObservable, observable } from 'mobx';
import { ISerializable } from '../utils/io';
import { DataError, ValueError } from '../utils/error';
import { ApproxLeq, Clamp, EPSILON, Gcd } from '../utils/math';

export const MAX_BAR = 60 * 24;

export class Fraction {
  /** Numerator */
  public readonly n: number;
  /** Denominator */
  public readonly d: number;

  public constructor(n: number, d: number) {
    if (d === 0) {
      throw new DataError(`d must be non-zero, got ${n} ${d}`);
    }
    this.n = n;
    this.d = d;
  }

  public get value(): number {
    return this.n / this.d;
  }

  public compare(rhs: Fraction): number {
    return this.n * rhs.d - rhs.n * this.d;
  }

  public equals(rhs: Fraction): boolean {
    return this.compare(rhs) === 0;
  }

  public reduct(): Fraction {
    const g = Gcd(this.n, this.d);
    return new Fraction(this.n / g, this.d / g);
  }
}

export class Timing extends Fraction implements ISerializable {
  public static readonly EqualityComparer = (lhs: Timing, rhs: Timing) =>
    lhs.equals(rhs);
  public static readonly INVALID = new Timing();
  public static readonly ZERO = new Timing(0, 0, 1);
  public static readonly INFINITY = new Timing(1e9, 0, 1);

  public constructor(bar = 0, beat = NaN, div = 1) {
    if (div === 0) {
      throw new DataError(`div must be non-zero, got ${bar} ${beat} ${div}`);
    }
    beat += div * bar;
    super(beat, div);
  }

  public static FromFraction(fraction: Fraction): Timing {
    return new Timing(0, fraction.n, fraction.d);
  }

  public static Ceil(value: number, div: number): Timing {
    return new Timing(0, Math.ceil(value * div), div);
  }

  public static Floor(value: number, div: number): Timing {
    return new Timing(0, Math.floor(value * div), div);
  }

  public static Round(value: number, div: number): Timing {
    return new Timing(0, Math.round(value * div), div);
  }

  public get bar(): number {
    return Math.floor(this.n / this.d);
  }

  public get beat(): number {
    return this.n % this.d;
  }

  public get div(): number {
    return this.d;
  }

  public get isValid(): boolean {
    return !isNaN(this.beat);
  }

  public lowerBound(div: number): Timing {
    const n = Math.ceil(this.value * div - EPSILON);
    return new Timing(0, n, div);
  }

  public upperBound(div: number): Timing {
    const n = Math.floor(this.value * div + EPSILON) + 1;
    return new Timing(0, n, div);
  }

  public prev(step = 1): Timing {
    return new Timing(0, this.n - step, this.div);
  }

  public next(step = 1): Timing {
    return new Timing(0, this.n + step, this.div);
  }

  public add(d: number): Timing {
    return new Timing(0, this.d + d, this.div);
  }

  //#region ISerializable
  serialize(): string {
    return `${this.bar}:${this.beat}/${this.div}`;
  }

  static Deserialize(data: string): Timing {
    const [bar, beatDiv] = data.split(':');
    const [beat, div] = beatDiv ? beatDiv.split('/') : [];
    const barInt = Math.floor(Number(bar));
    if (isNaN(barInt) || barInt < 0 || barInt > MAX_BAR) {
      throw new ValueError(`Invalid bar: ${bar}`);
    }
    const divInt = Math.floor(Number(div)) || 1;
    if (divInt <= 0 || divInt > 120) {
      throw new ValueError(`Invalid div: ${div}`);
    }
    const beatInt = Math.floor(Number(beat)) || 0;
    if (beatInt < 0 || beatInt > divInt * MAX_BAR) {
      throw new ValueError(`Invalid beat: ${beat}`);
    }
    return new Timing(barInt, beatInt, divInt);
  }
  //#endregion ISerializable
}

export class TimingRange implements ISerializable {
  public static readonly INVALID = new TimingRange();
  public static readonly EqualityComparer = (
    lhs: TimingRange,
    rhs: TimingRange,
  ) => lhs.equals(rhs);

  @observable start: Timing;
  @observable end: Timing;

  constructor(start: Timing = Timing.INVALID, end: Timing = Timing.INVALID) {
    makeObservable(this);
    this.start = start;
    this.end = end;
  }

  @computed
  public get isValid(): boolean {
    return this.start.isValid && this.end.isValid;
  }

  public toFloatRange(): FloatRange {
    return new FloatRange(this.start.value, this.end.value);
  }

  public clamp(time: Timing): Timing {
    if (ApproxLeq(time.value, this.start.value)) {
      return this.start;
    }
    if (ApproxLeq(this.end.value, time.value)) {
      return this.end;
    }
    return time;
  }

  public contains(timing: Timing | TimingRange): boolean {
    if (timing instanceof TimingRange) {
      return this.toFloatRange().contains(timing.toFloatRange());
    } else {
      return this.toFloatRange().contains(timing.value);
    }
  }

  public equals(range: TimingRange): boolean {
    return this.start.equals(range.start) && this.end.equals(range.end);
  }

  public overlaps(range: TimingRange): boolean {
    return this.toFloatRange().overlaps(range.toFloatRange());
  }

  //#region ISerializable
  serialize() {
    return [this.start.serialize(), this.end.serialize()];
  }

  static Deserialize(data: Timing[]): TimingRange {
    if (data.length !== 2) {
      throw new DataError(`data must be of length 2, got ${data.length}`);
    }
    const [start, end] = data;
    return new TimingRange(start, end);
  }
  //#endregion ISerializable
}

export class FloatRange implements ISerializable {
  public static readonly INVALID = new FloatRange();
  public static readonly FULL = new FloatRange(-Infinity, Infinity);
  public static readonly EqualityComparer = (a: FloatRange, b: FloatRange) => {
    return ApproxLeq(a.start, b.start) && ApproxLeq(a.end, b.end);
  };

  @observable start: number;
  @observable end: number;

  constructor(start = NaN, end = NaN) {
    makeObservable(this);
    this.start = start;
    this.end = end;
  }

  public get isValid(): boolean {
    return !isNaN(this.start) && !isNaN(this.end);
  }

  public contains(value: FloatRange | number): boolean {
    if (value instanceof FloatRange) {
      return (
        ApproxLeq(this.start, value.start) && ApproxLeq(value.end, this.end)
      );
    }
    return ApproxLeq(this.start, value) && ApproxLeq(value, this.end);
  }

  public clamp(value: number): number {
    return Clamp(value, this.start, this.end);
  }

  public overlaps(range: FloatRange | TimingRange): boolean {
    const start =
      range instanceof TimingRange ? range.start.value : range.start;
    const end = range instanceof TimingRange ? range.end.value : range.end;
    return ApproxLeq(this.start, end) && ApproxLeq(start, this.end);
  }

  @computed
  public get length(): number {
    return this.end - this.start;
  }

  @action
  public set(start: number, end: number) {
    this.start = start;
    this.end = end;
  }

  @action
  public expand(
    size: number,
    limit: FloatRange | undefined = undefined,
    anchor = 0.5,
  ) {
    let start = this.start - size * anchor;
    let end = this.end + size * (1 - anchor);
    if (limit) {
      start = Math.max(start, limit.start);
      end = Math.min(end, limit.end);
    }
    this.start = start;
    this.end = end;
  }

  //#region ISerializable
  serialize() {
    return `${this.start},${this.end}`;
  }

  static Deserialize(data: string): FloatRange {
    const [start, end] = data.split(',');
    return new FloatRange(parseFloat(start), parseFloat(end));
  }
  //#endregion ISerializable
}
