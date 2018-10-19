const finders = [
  require('./page-state'),
  require('./state'),
  require('./schema-code'),
  require('./db'),
  require('./template'),
];

module.exports = {
  finders,
  findGetterSetter: function({ datapoint, cache, schema, datapointDbConnection, stateVar, templates }) {
    const ret = {};
    for (const one of finders) {
      const oneRet = one(arguments[0]);
      if (oneRet) {
        if (!ret.getter) ret.getter = oneRet.getter;
        if (!ret.setter) ret.setter = oneRet.setter;
        if (ret.getter && ret.setter) break;
      }
    }
    return ret;
  },
};
