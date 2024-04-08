export class MeguEvent<T = void> {
  private handlers: ((data: T) => void)[] = [];

  public add(handler: (data: T) => void) {
    this.handlers.push(handler);
  }

  public remove(handler: (data: T) => void) {
    this.handlers = this.handlers.filter((h) => h !== handler);
  }

  public emit(data: T) {
    this.handlers.forEach((h) => h(data));
  }
}
