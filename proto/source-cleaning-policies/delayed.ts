import { HandlePromise } from "../../interfaces/promise-handler";
import { noboSingleton } from "../../interfaces/nobo-singleton";

export default ({
  handlePromise,
  delayMs = 1000,
  sliceMs = 100,
}: {
  handlePromise: HandlePromise;
  delayMs: number;
  sliceMs: number;
}) => ({
  delayedCaller: noboSingleton.createDelayedCaller({ delayMs, sliceMs }),
  queueCleanup(_name: string, cleanupCallback: () => Promise<void>) {
    this.delayedCaller.enqueue(name, () => handlePromise(cleanupCallback()));
  },
  cancelCleanup(_name: string): void {
    this.delayedCaller.cancel(name);
  },
});
