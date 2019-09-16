import {
  ValueSource_sinkInterface,
  ValueSource_ownerInterface,
  ValueSource_subclassInterface,
  ValueSink_publicInterface as ValueSink,
  ValueSource_stateForOwner,
} from "../../interfaces/sinks-and-sources";

interface PrivateData<T> {
  valueGetterPromise?: Promise<T>;
  cachedValue: T;
  valid: Boolean;
  sinks: Set<ValueSink<T>>;
}

export type ValueSourceInterfacePassback<T> = {
  owner?: ValueSource_ownerInterface<T>;
};

export abstract class ValueSource_abstract<T> implements ValueSource_sinkInterface<T> {
  constructor({
    interfacePassback,
    value,
    valid,
  }: {
    interfacePassback: ValueSourceInterfacePassback<T>;
    value: T;
    valid: boolean;
  }) {
    this.privateData = {
      cachedValue: value,
      valid,
      sinks: new Set(),
    };
    interfacePassback.owner = {
      addSink: this.addSink.bind(this),
      removeSink: this.removeSink.bind(this),
      cleanup: this.cleanup.bind(this),
      sinkInterface: this,
    };
    const _verifyThatThisImplementsTheSubclassInterface: ValueSource_subclassInterface<T> = {
      valueFromSubclass: this.valueFromSubclass,
      subclassValueWasInvalidated: this.subclassValueWasInvalidated,
      subclassHasNewValue: this.subclassHasNewValue,
      setValueInSubclass: this.setValueInSubclass,
    };
  }
  // ValueSource_sinkInterface
  // The interface presented to attached sinks or anyone who has a reference to the source
  setValue(v: T): Promise<T> {
    throw new Error("Method not implemented.");
  }
  get valid() {
    return this.privateData.valid;
  }
  get cachedValue(): T {
    return this.privateData.cachedValue;
  }
  get value(): Promise<T> {
    if (this.privateData.valid) return Promise.resolve(this.privateData.cachedValue);
    return this.valueFromSource;
  }

  // ValueSource_ownerInterface
  // The interface presented to the source registry or whatever object created the source
  private addSink(sink: ValueSink<T>): ValueSink<T> {
    const {
      privateData: { valid, sinks },
    } = this;

    sinks.add(sink);

    if (!valid && sink.sourceWasInvalidated) sink.sourceWasInvalidated();
    else sink.sourceHasNewValue(this.privateData.cachedValue);

    return sink;
  }
  private removeSink(sink: ValueSink<T>): ValueSource_stateForOwner {
    const {
      privateData: { valid, sinks },
    } = this;
    if (valid && sink.sourceWasInvalidated) sink.sourceWasInvalidated();
    sinks.delete(sink);
    return sinks.size ? ValueSource_stateForOwner.hasSinks : ValueSource_stateForOwner.hasNoSinks;
  }
  private async cleanup(): Promise<void> {
    const { privateData } = this;
    privateData.valid = false;
    await this.notifySinks();
    privateData.sinks.clear();
  }

  // ValueSource_subclassInterface
  // the interface presented to subclasses
  protected abstract async valueFromSubclass(): Promise<T>;
  protected abstract setValueInSubclass(v: T): Promise<T>;
  protected subclassValueWasInvalidated(): Promise<void> {
    this.privateData.valid = false;
    return this.notifySinks();
  }
  protected subclassHasNewValue(v: T): Promise<T> {
    const { privateData } = this;
    privateData.cachedValue = v;
    privateData.valid = true;
    return this.notifySinks().then(() => privateData.cachedValue);
  }

  // Private parts
  private privateData: PrivateData<T>;

  // Get the value from the source
  private get valueFromSource(): Promise<T> {
    const { privateData } = this;
    return (
      privateData.valueGetterPromise ||
      (privateData.valueGetterPromise = this.valueFromSubclass().then(async v => {
        this.subclassHasNewValue(v);
        privateData.valueGetterPromise = undefined;
        return v;
      }))
    );
  }

  // Notify the sinks that the value has changed
  private async notifySinks(): Promise<void> {
    const {
      privateData: { valid, sinks },
    } = this;
    const promises = Array<Promise<void> | undefined>();
    if (valid) {
      const newValue = this.cachedValue;
      sinks.forEach(sink => {
        promises.push(sink.sourceHasNewValue(newValue));
      });
    } else {
      sinks.forEach(sink => {
        if (sink.sourceWasInvalidated) promises.push(sink.sourceWasInvalidated());
      });
    }
    await Promise.all(promises);
  }
}
