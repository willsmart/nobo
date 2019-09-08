export default interface ValueSourceCleaningPolicy {
  queueCleanup(name: string, cleanupCallback: () => Promise<void>): void;
  cancelCleanup(name: string): void;
}
