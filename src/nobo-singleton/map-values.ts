import { anyValue } from "../../interfaces/any";

export default function<T extends { [k: string]: I; [Symbol.iterator]: Iterator<anyValue, any, undefined> }, I, O>(
  object: T,
  fn: (i: I) => O
): { [k: string]: O } {
  const ret: { [k: string]: O } = {};
  for (const [k, v] of object) {
    ret[k] = fn(v);
  }
  return ret;
}
