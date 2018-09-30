module.exports = function({ datapoint, schema, datapointDbConnection }) {
  if (!datapointDbConnection) return;

  const { typeName, dbRowId, fieldName } = datapoint,
    type = schema.allTypes[typeName];

  if (!type) return;

  const field = type.getField(fieldName);
  if (!field || !dbRowId || !(field.get || field.set)) return;

  const ret = {};
  if (!field.get) {
    ret.getter = {
      fn: () =>
        new Promise(resolve => {
          datapointDbConnection.queueGet({ field, dbRowId, resolve });
        }),
    };
  }
  if (!field.set) {
    ret.setter = {
      fn: newValue =>
        new Promise(resolve => {
          datapointDbConnection.queueSet({ field, dbRowId, newValue, resolve });
        }),
    };
  }
  return ret;
};
