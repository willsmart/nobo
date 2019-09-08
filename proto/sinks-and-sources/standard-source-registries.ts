import { SourceName } from './interfaces';
import ValueSourceRegistry from './source-registry';

export type StringName = SourceName<string>;
export type OptStringName = SourceName<string | undefined>;
export type NumberName = SourceName<number>;
export type OptNumberName = SourceName<number | undefined>;
export type HTMLElementName = SourceName<HTMLElement>;
export let optStrings: ValueSourceRegistry<string | undefined>;
export let strings: ValueSourceRegistry<string>;
export let optNumbers: ValueSourceRegistry<number | undefined>;
export let numbers: ValueSourceRegistry<number>;
export let htmlElements: ValueSourceRegistry<HTMLElement>;
