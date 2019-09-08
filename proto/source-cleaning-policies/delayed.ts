import { HandlePromise } from '../PromiseHandler';
import DelayedCaller from '../misc/delayedCaller';

export default ({
  handlePromise,
  delayMs = 1000,
  sliceMs = 100,
}: {
  handlePromise: HandlePromise;
  delayMs: number;
  sliceMs: number;
}) => ({
  delayedCaller: new DelayedCaller({ delayMs, sliceMs }),
  queueCleanup(_name: string, cleanupCallback: () => Promise<void>) {
    this.delayedCaller.enqueue(name, () => handlePromise(cleanupCallback()));
  },
  cancelCleanup(_name: string): void {
    this.delayedCaller.cancel(name);
  },
});
