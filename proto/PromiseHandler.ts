export interface PromiseHandlerOwner {
  clearPromises(
    clearPromises: () => Promise<void>,
    handler: PromiseHandler
  ): Promise<void>;
}

// TODO godawful name
export class IntervalPromiseHandlerOwner implements PromiseHandlerOwner {
  delayMillis: number;
  currentTimeout?: number;
  handler: PromiseHandler;
  clearPromisesRequested = true;
  resolvers?: Set<() => void>;

  constructor(handler?: PromiseHandler, delayMillis: number = 0.05) {
    this.delayMillis = delayMillis;
    this.handler = handler || new PromiseHandler(this);
    this.requestClearPromises();
  }

  requestClearPromises() {
    const me = this;
    this.clearPromisesRequested = true;
    if (this.currentTimeout !== undefined) return;

    this.currentTimeout = setTimeout(tick, this.delayMillis);

    async function tick(): Promise<void> {
      if (!me.clearPromisesRequested) {
        me.currentTimeout = undefined;
        return;
      }
      me.clearPromisesRequested = false;

      await me.handler.clearPromises();

      if (me.resolvers !== undefined) {
        const resolvers = me.resolvers;
        me.resolvers = undefined;
        resolvers.forEach(resolve => resolve());
      }

      me.currentTimeout = setTimeout(tick, me.delayMillis);
    }
  }

  async clearPromises(): Promise<void> {
    return new Promise<void>(resolve => {
      (this.resolvers || (this.resolvers = new Set())).add(resolve);
      this.requestClearPromises();
    });
  }
}

export type HandlePromise = (
  promise: PromiseOrPromiseGenerator
) => Promise<void>;
export type PromiseOrPromiseGenerator =
  | Promise<any>
  | ((handlePromise: HandlePromise) => PromiseOrPromiseGenerator | undefined);

export class PromiseHandler {
  promises: Promise<any>[] = [];
  generators: Array<
    (handlePromise: HandlePromise) => PromiseOrPromiseGenerator | undefined
  > = [];

  owner: PromiseHandlerOwner;
  currentClearRequest?: Promise<void>;

  constructor(owner: PromiseHandlerOwner) {
    this.owner = owner;
  }

  requestClearPromises(): Promise<void> {
    if (this.currentClearRequest) return this.currentClearRequest;
    return (this.currentClearRequest = this.owner.clearPromises(
      () => this.clearPromises(),
      this
    ));
  }

  handle(promise: PromiseOrPromiseGenerator): Promise<void> {
    this._handle(promise);
    return this.requestClearPromises();
  }

  _handle(promise: PromiseOrPromiseGenerator) {
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
