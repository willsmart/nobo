import { NoboSingleton_publicInterface } from "../../interfaces/nobo-singleton";
import DelayedCaller from "./delayedCaller";
import isPromise from "./is-promise";
import delayedSourceCleaningPolicy from "../source-cleaning-policies/delayed";
import mapValues from "./map-values";
import standardSourceRegistries from "../sinks-and-sources/standard-source-registries";
import { ValueSourceRegistry_publicInterface, SourceGenerator } from "../../interfaces/sinks-and-sources";
import ValueSourceRegistry from "../sinks-and-sources/source-registry";
import ValueSourceCleaningPolicy from "../../interfaces/source-cleaning-policies";
import {
  PromiseOrPromiseGenerator,
  PromiseHandlerOwner_promiseHandlerInterface,
  HandlePromise,
} from "../../interfaces/promise-handler";
import { PromiseHandler } from "../promise-handler/promise-handler";
import { IntervalPromiseHandlerOwner } from "../promise-handler/interval-promise-handler-owner";
import ValueSourceCleaningPolicy_publicInterface from "../../interfaces/source-cleaning-policies";

class NoboSingleton implements NoboSingleton_publicInterface {
  createValueSourceRegistry<T>({
    sourceGenerator,
    valueSourceCleaningPolicy,
  }: {
    sourceGenerator: SourceGenerator<T>;
    valueSourceCleaningPolicy: ValueSourceCleaningPolicy;
  }): ValueSourceRegistry_publicInterface<T> {
    return new ValueSourceRegistry<T>({ sourceGenerator, valueSourceCleaningPolicy });
  }
  createDelayedCaller({ delayMs, sliceMs }: { delayMs: number; sliceMs: number }): DelayedCaller {
    return new DelayedCaller({ delayMs, sliceMs });
  }

  delayedSourceCleaningPolicy({
    handlePromise,
    delayMs,
    sliceMs,
  }: {
    handlePromise: HandlePromise;
    delayMs: number;
    sliceMs: number;
  }): ValueSourceCleaningPolicy_publicInterface {
    return delayedSourceCleaningPolicy({ handlePromise: handlePromise || this.handlePromise, delayMs, sliceMs });
  }
  isPromise = isPromise;
  mapValues = mapValues;
  standardSourceRegistries = standardSourceRegistries;

  private _promiseHandler?: PromiseHandler;
  get promiseHandler() {
    return this._promiseHandler || (this._promiseHandler = new PromiseHandler(this.promiseOwner));
  }

  handlePromise(promise: PromiseOrPromiseGenerator): Promise<void> {
    return this.promiseHandler.handle(promise);
  }

  private _promiseOwner?: PromiseHandlerOwner_promiseHandlerInterface;
  get promiseOwner() {
    return this._promiseOwner || (this._promiseOwner = new IntervalPromiseHandlerOwner());
  }

  set promiseOwner(promiseOwner) {
    this._promiseOwner = promiseOwner;
    this._promiseHandler = undefined;
  }
}

export var noboSingleton = new NoboSingleton();
