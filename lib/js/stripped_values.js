const mapValues = require("./map_values");

// API
module.exports = strippedValues;

function strippedValues(object) {
  return mapValues(
    object,
    val => (typeof val == "object" && typeof val.stripped == "function" ? val.stripped() : undefined)
  );
}
