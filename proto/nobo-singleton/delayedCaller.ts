import { DelayedCaller_publicInterface } from "../../interfaces/nobo-singleton";

type Callback = () => Promise<void>;

export default class DelayedCaller implements DelayedCaller_publicInterface {
  constructor({ delayMs = 1000, sliceMs = 100 }: { delayMs: number; sliceMs: number }) {
    if (sliceMs < 10)
      throw new Error(
        `DelayedCaller must be constructed with a slice interval value that's at least 10ms (${sliceMs} was passed)`
      );
    if (delayMs <= 0)
      throw new Error(`DelayedCaller must be constructed with a positive delay value (${delayMs} was passed)`);

    this.sliceMs = Math.ceil(sliceMs);
    this.delaySlices = Math.max(1, Math.ceil(delayMs / this.sliceMs));
  }

  delaySlices: number;
  sliceMs: number;
  queue: { [time: string]: { [name: string]: Callback } } = {};
  nameToTickIndex: { [name: string]: number } = {};
  queueLength = 0;
  tickIndex = 0;
  intervalHandle?: number;

  enqueue(name: string, cleanupCallback: Callback) {
    const { nameToTickIndex, tickIndex, queue } = this,
      queuedInTickIndex = nameToTickIndex[name],
      shouldQueueInTickIndex = tickIndex + this.delaySlices;
    if (queuedInTickIndex === shouldQueueInTickIndex) return;
    if (queuedInTickIndex >= tickIndex) this.cancel(name);

    let callbacks = queue[shouldQueueInTickIndex];
    if (!callbacks) {
      callbacks = queue[shouldQueueInTickIndex] = {};
      this.queueLength++;
    }
    callbacks[name] = cleanupCallback;
    nameToTickIndex[name] = shouldQueueInTickIndex;
    this.startTicking();
  }

  cancel(_name: string) {
    const { nameToTickIndex, tickIndex, queue } = this,
      queuedInTickIndex = nameToTickIndex[name];
    if (queuedInTickIndex < tickIndex) return;
    const callbacks = queue[queuedInTickIndex];
    delete callbacks[name];
    delete nameToTickIndex[name];
  }

  startTicking() {
    if (this.intervalHandle) return;
    this.intervalHandle = setInterval(this.tick, this.sliceMs);
  }

  tick() {
    const { tickIndex, queue, nameToTickIndex, sliceMs } = this;
    const callbacks = queue[tickIndex];
    if (callbacks) {
      delete queue[tickIndex];
      this.queueLength--;
      Object.values(callbacks).forEach(callback => callback());
      Object.keys(callbacks).forEach(name => delete nameToTickIndex[name]);
    }
    this.tickIndex++;
    this.intervalHandle = undefined;
    if (this.queueLength) this.startTicking();
  }
}
