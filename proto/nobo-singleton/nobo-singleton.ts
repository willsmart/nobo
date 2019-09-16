import { NoboSingleton_publicInterface } from "../../interfaces/nobo-singleton";
import DelayedCaller from "./delayedCaller";
import isPromise from "./is-promise";
import mapValues from "./map-values";
import standardSourceRegistries from "../sinks-and-sources/standard-source-registries";

export default class NoboSingleton implements NoboSingleton_publicInterface {
  createDelayedCaller({ delayMs, sliceMs }: { delayMs: number; sliceMs: number }): DelayedCaller {
    return new DelayedCaller({ delayMs, sliceMs });
  }
  isPromise = isPromise;
  mapValues = mapValues;
  standardSourceRegistries = standardSourceRegistries;
}
