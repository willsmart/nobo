const all = [require('./template'), require('./schema-code'), require('./db')];

module.exports = function({ datapoint, cache, schema, datapointDbConnection, templates }) {
  const ret = {};
  for (const one of all) {
    const oneRet = one(arguments);
    if (oneRet) {
      if (!ret.getter) ret.getter = oneRet.getter;
      if (!ret.setter) ret.setter = oneRet.setter;
      if (ret.getter && ret.setter) break;
    }
  }
  return ret.getter || ret.setter ? ret : undefined;
};
