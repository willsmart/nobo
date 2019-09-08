export default {
  queueCleanup(_name: string, cleanupCallback: () => Promise<void>) {},
  cancelCleanup(_name: string): void {},
};
