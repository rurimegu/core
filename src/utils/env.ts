import { action, computed, makeObservable, observable } from 'mobx';

export enum RuntimeEnv {
  Production,
  Development,
}

export class MeguEnv {
  @observable
  public env = RuntimeEnv.Production;

  @computed
  public get isDevelopment() {
    return this.env === RuntimeEnv.Development;
  }

  @action
  public setEnv(env: RuntimeEnv) {
    this.env = env;
  }

  public constructor() {
    makeObservable(this);
  }
}

export const meguEnv = new MeguEnv();
