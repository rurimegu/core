export type IProvider<T> = () => T;
export type IProviderOrValue<T> = T | IProvider<T>;
export function GetValue<T>(provider: IProviderOrValue<T>): T {
  return typeof provider === 'function'
    ? (provider as IProvider<T>)()
    : provider;
}
export function NoopFn() {
  return;
}
/** Allows cloning the object completely, including ID info. */
export interface IClonable<T> {
  clone(): T;
}
/** Allows creating a copy of the object, possibly without preserving ID info. */
export interface ICopyable<T> {
  newCopy(): T;
}

export interface IWithId {
  get id(): string;
}
export type Constructor<T> = new (...args: any[]) => T;
export interface IWithText {
  get text(): string;
  set text(value: string);
}
export interface IWithBottomText {
  get bottomText(): string;
}
export interface IWithSpacing {
  get newline(): boolean;
  set newline(value: boolean);
  get space(): boolean;
  set space(value: boolean);
}
export interface IDisposable {
  dispose(): void;
}
export function OfType<U>(arr: any[], type: Constructor<U>): U[] {
  return arr.filter((x) => x instanceof type) as U[];
}
export function RemoveUndefined<T extends object>(
  obj: T,
  removeFalse = false,
): T {
  for (const key in obj) {
    if (obj[key] === undefined || (removeFalse && obj[key] === false)) {
      delete obj[key];
    }
  }
  return obj;
}
export function EnumValues(obj: any): string[] {
  return Object.keys(obj).map((key) => obj[key]);
}

export type SimpleFunc = () => void;
export type UndoFunc = () => void;

export type Handler<T> = (data: T) => void;

export type Predicate<T> = (value: T) => boolean;
