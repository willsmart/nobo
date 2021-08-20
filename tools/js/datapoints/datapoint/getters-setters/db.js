const ConvertIds = require('../../../datapoints/convert-ids');

module.exports = function({ datapoint, schema, datapointDbConnection }) {
  if (!datapointDbConnection) return;

  const { typeName, rowId, fieldName } = datapoint,
    type = schema.allTypes[typeName];

  if (!type) return;

  let { dbRowId } = datapoint;

  if (fieldName == '?') {
    return {
      getter: {
        fn: () =>
          new Promise(resolve => {
            allocateDBRowId(() => {
              datapointDbConnection.queueGetExists({ typeName, dbRowId, resolve });
            });
          }),
      },
      setter: {
        fn: newValue =>
          new Promise(resolve => {
            allocateDBRowId(() => {
              datapointDbConnection.queueSetExists({
                typeName,
                dbRowId,
                newValue,
                resolve: () => {
                  resolve(newValue);
                },
              });
            });
          }),
      },
    };
  }

  const field = type.fields[fieldName];
  if (!field || !dbRowId) return;

  const ret = {};
  if (!field.get) {
    ret.getter = {
      fn: () =>
        new Promise(resolve => {
          allocateDBRowId(() => {
            datapointDbConnection.queueGet({ field, dbRowId, resolve });
          });
        }),
    };
  }
  if (!field.set) {
    ret.setter = {
      fn: newValue =>
        new Promise(resolve => {
          allocateDBRowId(() => {
            datapointDbConnection.queueSet({ field, dbRowId, newValue, resolve });
          });
        }),
    };
  }
  return ret;

  async function allocateDBRowId(resolve) {
    if (dbRowId === undefined) {
      dbRowId = await g_allocateDBRowId(typeName, rowId);
    }
    resolve();
  }
};

const keyInfos = {};

async function g_allocateDBRowId(typeName, rowId) {
  const keyInfo = keyInfos[rowId] || (keyInfos[rowId] = { resolves: undefined, dbRowId: undefined });
  let { resolves, dbRowId } = keyInfo;
  if (dbRowId !== undefined) return dbRowId;
  if (resolves) {
    return new Promise(resolve => {
      resolves.push(resolve);
    });
  }
  resolves = keyInfo.resolves = [];
  dbInfo = keyInfo.dbRowId = await allocateDbRowId({ typeName });
  keyInfo.resolves = undefined;
  for (const resolve of resolves) {
    resolve(dbRowId);
  }
  return dbRowId;
}
