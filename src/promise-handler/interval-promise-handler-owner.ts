import { PromiseHandlerOwner_promiseHandlerInterface as PromiseHandlerOwner } from "../../interfaces/promise-handler";
import { PromiseHandler } from "./promise-handler";

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
