import { StandardSourceRegistries_publicInterface } from "../../interfaces/standard-source-registries";
import ValueSourceRegistry from "./source-registry";

export const standardSourceRegistries : StandardSourceRegistries_publicInterface = {
  optStrings: new ValueSourceRegistry<string | undefined>()
  strings: ValueSourceRegistry<string>;
  optNumbers: ValueSourceRegistry<number | undefined>;
  numbers: ValueSourceRegistry<number>;
  htmlElements: ValueSourceRegistry<HTMLElement>;
}
export default standardSourceRegistries