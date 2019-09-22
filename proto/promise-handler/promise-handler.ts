import {
  PromiseHandlerOwner_promiseHandlerInterface as PromiseHandlerOwner,
  HandlePromise,
  PromiseOrPromiseGenerator,
} from "../../interfaces/promise-handler";
import { anyValue } from "../../interfaces/any";

export class PromiseHandler {
  promises: Promise<anyValue>[] = [];
  generators: Array<(handlePromise: HandlePromise) => PromiseOrPromiseGenerator | undefined> = [];

  owner: PromiseHandlerOwner;
  currentClearRequest?: Promise<void>;

  constructor(owner: PromiseHandlerOwner) {
    this.owner = owner;
  }

  requestClearPromises(): Promise<void> {
    if (this.currentClearRequest) return this.currentClearRequest;
    return (this.currentClearRequest = this.owner.clearPromises(() => this.clearPromises(), this));
  }

  handle(promise: PromiseOrPromiseGenerator): Promise<void> {
    this._handle(promise);
    return this.requestClearPromises();
  }

  private _handle(promise: PromiseOrPromiseGenerator) {
    if (typeof promise == "function") {
      this.generators.push(promise);
    } else {
      this.promises.push(promise);
    }
  }

  clearPromises(): Promise<void> {
    let currentClearRequest = this.currentClearRequest;
    if (!currentClearRequest)
      throw new Error(
        "Invalid state: the promise handler has an undefined currentClearRequest on entry to clearPromises"
      );
    this.currentClearRequest = undefined;
    const localHandle = (promise: PromiseOrPromiseGenerator) => {
      if (!currentClearRequest) return this.handle(promise);

      this._handle(promise);
      return currentClearRequest;
    };

    return new Promise<void>(async resolve => {
      while (this.promises.length || this.generators.length) {
        while (this.generators.length) {
          const generators = this.generators;
          this.generators = [];
          generators.forEach(fn => {
            const promise = fn(localHandle);
            if (promise) this._handle(promise);
          });
        }
        while (this.promises.length) {
          const promises = this.promises;
          this.promises = [];
          await Promise.all(promises);
        }
      }
      currentClearRequest = undefined;
      resolve();
    });
  }
}
