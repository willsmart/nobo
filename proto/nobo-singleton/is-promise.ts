// Thanks to ssnau! https://github.com/ssnau/xkit/blob/master/util/is-promise.js
export default function(v: any): boolean {
  return v && (typeof v === "object" || typeof v === "function") && typeof v.then === "function";
}
