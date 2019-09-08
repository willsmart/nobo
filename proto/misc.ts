export interface Constructable<T> {
  from(v: any): T | undefined;
}

export type Caster<T> = (v: any) => T | undefined;

export interface TypeHelper<T> {
  castFrom(v: any): T;
  describes(v: any): v is T;
  getDefaultValue(): T;
}
