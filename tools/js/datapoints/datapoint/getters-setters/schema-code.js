module.exports = function({ datapoint, schema }) {
  const { typeName, fieldName } = datapoint,
    type = schema.allTypes[typeName];

  if (!type) return;

  const field = type.fields[fieldName];
  if (!field || !(field.get || field.set)) return;

  const ret = {};
  if (field.get) {
    ret.getter = { codeSnippet: field.get };
  }
  if (field.set) {
    ret.setter = { codeSnippet: field.set };
  }
  return ret;
};
