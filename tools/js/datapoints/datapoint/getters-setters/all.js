const finders = [
  [require('./page-state'), 'page-state'],
  [require('./state'), 'state'],
  [require('./db'), 'db'],
  [require('./db-js'), 'db-js'],
  [require('./template'), 'template'],
];

module.exports = {
  finders,
  findGetterSetter: function({ datapoint, cache, schema, datapointDbConnection, stateVar, templates }) {
    const ret = {};
    for (const finder of finders) {
      const oneRet = finder[0](arguments[0]);
      if (oneRet) {
        if (!ret.getter) ret.getter = oneRet.getter;
        if (!ret.setter) ret.setter = oneRet.setter;
        if (ret.getter && ret.setter) break;
      }
    }
    return ret;
  },
};
