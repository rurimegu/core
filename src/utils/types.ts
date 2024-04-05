export type IProvider<T> = () => T;
export type IProviderOrValue<T> = T | IProvider<T>;
export function GetValue<T>(provider: IProviderOrValue<T>): T {
  return typeof provider === 'function'
    ? (provider as IProvider<T>)()
    : provider;
}
export function NoopFn() {}
export type Type<T> = new (...args: any[]) => T;
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
