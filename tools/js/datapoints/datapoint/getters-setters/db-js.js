module.exports = function({ datapoint, schema, datapointDbConnection }) {
  const { typeName, fieldName, rowId, isClient } = datapoint,
    type = schema.allTypes[typeName];

  const deb = typeName == 'User' && fieldName == 'posts';

  if (!type || !(isClient || datapointDbConnection)) return;
  const field = type.fields[fieldName];
  if (!field) return;

  const ret = {};
  if (field.get) {
    ret.getter = {
      fn: ({ getDatapointValue, getRowObject }) => {
        return field.get.safeEvaluate({
          getDatapointValue,
          getRowObject,
          rowId,
        }).result;
      },
    };
  }
  if (field.set) {
    ret.setter = {
      fn: (newValue, { getDatapointValue, getRowObject }) => {
        return field.get.safeEvaluate({
          getDatapointValue,
          getRowObject,
          rowId,
          event: { newValue },
        }).result;
      },
    };
  }
  return ret;
};
