import {
  ValueSource_ownerInterface,
  ValueSink_registryInterface,
  ValueSource_stateForOwner as ValueSourceState,
  SourceName,
} from './interfaces';
import ValueSourceCleaningPolicy from '../source-cleaning-policies/interface';

type SourceGenerator<T> = (name: SourceName<T>) => ValueSource_ownerInterface<T>;

export default class ValueSourceRegistry<T> {
  constructor({
    sourceGenerator,
    valueSourceCleaningPolicy,
  }: {
    sourceGenerator: SourceGenerator<T>;
    valueSourceCleaningPolicy: ValueSourceCleaningPolicy;
  }) {
    this.sourceGenerator = sourceGenerator;
    this.valueSourceCleaningPolicy = valueSourceCleaningPolicy;
  }

  has(name: SourceName<T>): boolean {
    return name.toString() in this.sources;
  }

  attachSinkToSource(sourceName: SourceName<T>, sink: ValueSink_registryInterface<T>): ValueSink_registryInterface<T> {
    const name = sourceName.toString(),
      { sources } = this,
      source = sources[name] || (sources[name] = this.sourceGenerator(sourceName));
    if (sink.detachFromSource) {
      sink.detachFromSource();
      sink.detachFromSource = undefined;
    }
    if (this.zombieNames.has(name)) {
      this.valueSourceCleaningPolicy.cancelCleanup(name);
      this.zombieNames.delete(name);
    }
    source.addSink(sink);
    sink.detachFromSource = () => {
      this.dettachSinkFromSource(sourceName, sink);
    };
    return sink;
  }

  private dettachSinkFromSource(sourceName: SourceName<T>, sink: ValueSink_registryInterface<T>) {
    const name = sourceName.toString(),
      { sources } = this,
      source = sources[name];
    if (!source) return;
    if (source.removeSink(sink) === ValueSourceState.hasNoSinks) {
      if (this.zombieNames.has(name)) return;
      this.zombieNames.add(name);
      this.valueSourceCleaningPolicy.queueCleanup(name, () => this.delete(sourceName));
    }
  }

  // Private parts
  private sources: { [name: string]: ValueSource_ownerInterface<T> } = {};
  private zombieNames = new Set<string>();
  private sourceGenerator: SourceGenerator<T>;
  private valueSourceCleaningPolicy: ValueSourceCleaningPolicy;

  private delete(sourceName: SourceName<T>): Promise<void> {
    const name = sourceName.toString(),
      { sources, zombieNames } = this,
      source = sources[name];
    zombieNames.delete(name);
    if (!source) return Promise.resolve();
    delete sources[name];
    return source.cleanup();
  }
}
