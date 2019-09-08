/**
 * Nobo is ruled by "Values", which are just base level variable values, like say
 * the string "foo" or the number 1.5
 *
 * A "ValueSource" is an object that owns the value. It is able to produce the value on request
 * and is in charge of ensuring that value changes don't go unnoticed
 *
 * A "ValueSink" is an object that needs to read the value. Anything that could need to know the exact
 * value of the "Value" is a "ValueSink".
 *
 * Each "Value" in any one process has one "ValueSource", which may have any number of "ValueSinks"
 *
 * A core concept is that a value cannot change without all sinks being made aware that there was a change
 *
 *  and being able to obtain the new value.
 * An example would be a database cell value would be associated with a "ValueSource". A DOM text node that
 * displays is would be associated with a "ValueSink"
 */

// The source interface presented to attached sinks or anyone who has a reference to the source
//  (note that only attached sinks and registries and the like should have a reference to a source object)
export interface ValueSource_sinkInterface<T> {
  readonly valid: Boolean; //    Is the cachedValue up to date?
  readonly cachedValue: T; //    Sync call to get the best guess value. This value may be out of date
  readonly value: Promise<T>; // Async call to get the canonical value
  setValue(v: T): Promise<T>; // Request that the value be changed
  //                             The promise will succeed when the value has been changed
  //                             (note that the actual value may end up slightly different to the one given)
  //                             The promise will reject when we know the value will not change
  //                             If two change requests are made, the last one wins.
}

export enum ValueSource_stateForOwner {
  hasNoSinks = 0,
  hasSinks,
}

// The source interface presented to the source registry or whatever object created the source
export interface ValueSource_ownerInterface<T> {
  addSink(sink: ValueSink_publicInterface<T>): ValueSink_publicInterface<T>; //       Add a sink
  removeSink(sink: ValueSink_publicInterface<T>): ValueSource_stateForOwner; // Remove a sink.
  //                                                          Return state info after the sink was removed
  cleanup(): Promise<void>; //                                Release all resources held by this source
  //                                                          as it is about to be freed by its owner
  sinkInterface: ValueSource_sinkInterface<T>;
}

// the source interface presented to subclasses
export interface ValueSource_subclassInterface<T> {
  subclassValueWasInvalidated(): Promise<void>; //      Called when the source becomes invalid
  subclassHasNewValue(v: T): Promise<T>; //             Called when the source gets a new value
  valueFromSubclass(): Promise<T>; //                   Called to get the canonical value of the source from the subclass
  setValueInSubclass(v: T): Promise<T>; //              Called to request that the value be changed
}

// The sink interface presented to the world
export interface ValueSink_publicInterface<T> {
  sourceHasNewValue(v: T): Promise<void> | undefined; // Called by the subclass when it gets a new value
  sourceWasInvalidated?(): Promise<void> | undefined; //  Called by the subclass when it becomes invalid
  detachFromSource?(): void;
}

// The registry interface presented to sinks
export interface SourceRegistry_sinkInterface<T> {}

// The sink interface presented to sources
export type ValueSink_sourceLink<T> = {
  sourceRegistry: SourceRegistry_sinkInterface<T>; //  The registry for the source that this sink gets its value from
  sourceName: string; //                        The name for the source that this sink gets its value from
};

// The sink interface presented to sources
export interface ValueSink_registryInterface<T> extends ValueSink_publicInterface<T> {}
