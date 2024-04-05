import { runInAction } from 'mobx';
import { RedoQueue } from '../utils/ds';
import { Command } from './command';
import { ValueError } from '../utils/error';
import { IProviderOrValue } from '../utils/types';

export class CommandManager {
  private commands = new RedoQueue<Command>();
  protected lockObj_?: any;
  protected maxUndoSteps_ = 100;

  public execute(command: Command): void {
    if (this.locked) {
      console.warn('CommandManager is locked');
      return;
    }
    runInAction(() => {
      command.execute();
    });
    this.push(command);
  }

  public push(command: Command): void {
    this.commands.pushBack(command);
    while (this.commands.length > this.maxUndoSteps) {
      this.commands.popFront();
    }
  }

  public undo(): void {
    if (this.locked) {
      console.warn('CommandManager is locked');
      return;
    }
    const command = this.commands.popBack();
    if (command) {
      runInAction(() => {
        command.undo();
      });
      while (this.commands.length > this.maxUndoSteps) {
        this.commands.popFront();
      }
    }
  }

  public redo(): void {
    if (this.locked) {
      console.warn('CommandManager is locked');
      return;
    }
    const command = this.commands.recoverBack();
    if (command) {
      runInAction(() => {
        command.execute();
      });
    }
  }

  public lock(obj: any): boolean {
    if (!obj || this.locked) return false;
    this.lockObj_ = obj;
    return true;
  }

  public unlock(obj: any): void {
    if (this.lockObj === obj) this.lockObj_ = undefined;
    else throw new ValueError('Unlocking an object that is not locked');
  }

  public get locked(): boolean {
    return this.lockObj !== undefined;
  }

  public get lockObj(): any {
    return this.lockObj_;
  }

  public get maxUndoSteps(): number {
    return this.maxUndoSteps_;
  }

  public set maxUndoSteps(value: number) {
    this.maxUndoSteps_ = value;
  }
}

export class OngoingCommand {
  protected command?: Command;

  public constructor(protected cmdManager_: IProviderOrValue<CommandManager>) {}

  protected get cmdManager(): CommandManager {
    if (this.cmdManager_ instanceof CommandManager) return this.cmdManager_;
    this.cmdManager_ = this.cmdManager_();
    return this.cmdManager_;
  }

  public execute(command: Command | undefined): void {
    if (this.executed) this.undo();
    else if (this.cmdManager.locked) return;
    if (command) {
      this.cmdManager.execute(command);
      console.assert(this.cmdManager.lock(this), 'Failed to lock:', this);
    }
    this.command = command;
  }

  public clear(): void {
    this.execute(undefined);
  }

  public redo(): void {
    if (!this.command || this.executed) return;
    this.cmdManager.execute(this.command);
    console.assert(this.cmdManager.lock(this), 'Failed to lock:', this);
  }

  public undo(): void {
    if (!this.executed) return;
    this.cmdManager.unlock(this);
    this.cmdManager.undo();
  }

  public commit() {
    if (!this.command) return;
    if (this.cmdManager.locked && !this.executed) return;
    this.redo();
    this.cmdManager.unlock(this);
    this.command = undefined;
  }

  public get cmd(): Command | undefined {
    return this.command;
  }

  public get hasCmd(): boolean {
    return this.command !== undefined;
  }

  public get executed(): boolean {
    return this.cmdManager.lockObj === this;
  }
}
