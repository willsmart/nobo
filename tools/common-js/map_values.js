// API
module.exports = mapValues;

function mapValues(object, fn) {
  const ret = {};
  Object.keys(object).forEach(key => {
    const val = fn(object[key]);
    if (val != undefined) ret[key] = val;
  });
  return ret;
}
