import { HandlePromise } from '../PromiseHandler';

export default ({ handlePromise }: { handlePromise: HandlePromise }) => ({
  queueCleanup(_name: string, cleanupCallback: () => Promise<void>) {
    handlePromise(cleanupCallback());
  },
  cancelCleanup(_name: string): void {},
});
