import { anyValue } from "../../interfaces/any";

// Thanks to ssnau! https://github.com/ssnau/xkit/blob/master/util/is-promise.js
export default function(v: anyValue): boolean {
  return (
    !!v &&
    (typeof v === "object" || typeof v === "function") &&
    "then" in v &&
    typeof (<Promise<any>>v).then === "function"
  );
}
