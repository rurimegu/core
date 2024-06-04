import { Handler } from './types';

export class MeguEvent<T = void> {
  private handlers: Handler<T>[] = [];

  public add(handler: Handler<T>) {
    this.handlers.push(handler);
  }

  public remove(handler: Handler<T>) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  public emit(data: T) {
    this.handlers.forEach((h) => h(data));
  }
}
