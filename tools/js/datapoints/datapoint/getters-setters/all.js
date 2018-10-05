const all = [
  require('./page-state'),
  require('./state'),
  require('./template'),
  require('./schema-code'),
  require('./db'),
];

module.exports = function({ datapoint, cache, schema, datapointDbConnection, stateVar, templates }) {
  const ret = {};
  for (const one of all) {
    const oneRet = one(arguments[0]);
    if (oneRet) {
      if (!ret.getter) ret.getter = oneRet.getter;
      if (!ret.setter) ret.setter = oneRet.setter;
      if (ret.getter && ret.setter) break;
    }
  }
  return ret;
};
