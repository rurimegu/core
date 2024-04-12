import { action, makeObservable, observable } from 'mobx';
import { IWithId } from '../../utils';

export class RefManager {
  protected readonly refs = new Map<string, MRef<any>[]>();

  public unset(id: string, ref: MRef<any>) {
    const refs = this.refs.get(id);
    if (refs) {
      const index = refs.indexOf(ref);
      if (index >= 0) {
        refs.splice(index, 1);
      }
    }
  }

  public get(id: string): MRef<any>[] | undefined {
    return this.refs.get(id);
  }

  public set(id: string, value: MRef<any>) {
    let refs = this.refs.get(id);
    if (!refs) {
      refs = [];
      this.refs.set(id, refs);
    }
    refs.push(value);
  }

  public delete(id: string) {
    const refs = this.refs.get(id);
    if (refs) {
      for (const ref of refs.slice()) {
        ref.set(undefined);
      }
    }
  }

  public clear() {
    this.refs.clear();
  }

  public recover<T extends IWithId>(target: T, ...values: MRef<any>[]) {
    for (const value of values) {
      value.set(target);
    }
  }
}

export const refManager = new RefManager();

export class MRef<T extends IWithId> {
  @observable
  protected value?: T;

  constructor(
    public readonly manager: RefManager,
    value?: T,
  ) {
    this.set(value);
    makeObservable(this);
  }

  public get(): T | undefined {
    return this.value;
  }

  @action
  public set(value: T | undefined) {
    if (this.value) {
      this.manager.unset(this.value.id, this);
    }
    this.value = value;
    if (value) {
      this.manager.set(value.id, this);
    }
  }
}
