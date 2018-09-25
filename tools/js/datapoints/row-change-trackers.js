// row-change-trackers
// © Will Smart 2018. Licence: MIT

const PublicApi = require('../general/public-api');
const ConvertIds = require('./convert-ids');
const changeDetectorObject = require('../general/change-detector-object');

class RowChangeTrackers {
  // public methods
  static publicMethods() {
    return ['rowObject', 'commit'];
  }

  constructor({ cache, schema }) {
    const rowChangeTrackers = this;
    Object.assign(rowChangeTrackers, {
      cache,
      schema,
      rowProxies: {},
      rowCDOs: {},
    });
  }

  rowObject(rowId) {
    const rowChangeTrackers = this,
      { rowCDOs } = rowChangeTrackers;
    if (rowCDOs[rowId]) return rowCDOs[rowId].useObject;
    rowChangeTrackers.queueCommitJob();
    return (rowCDOs[rowId] = changeDetectorObject(rowChangeTrackers.rowProxy(rowId))).useObject;
  }

  rowProxy(rowId) {
    const rowChangeTrackers = this,
      { rowProxies } = rowChangeTrackers;
    return (
      rowProxies[rowId] ||
      (rowProxies[rowId] = new Proxy(
        {},
        {
          getOwnPropertyDescriptor: (_obj, prop) => {
            const o = { v: rowChangeTrackers.getDatapointValue(rowId, prop) };
            return Object.getOwnPropertyDescriptor(o, 'v');
          },
          has: (_obj, key) => {
            return rowChangeTrackers.getDatapointValue(rowId, key) !== undefined;
          },
          get: (_obj, key) => {
            return rowChangeTrackers.getDatapointValue(rowId, key);
          },
          ownKeys: () => {
            return rowChangeTrackers.getRowFieldNames(rowId);
          },
        }
      ))
    );
  }

  queueCommitJob({ delay = 10 } = {}) {
    const rowChangeTrackers = this;

    if (delay <= 0) {
      rowChangeTrackers.commit();
      return;
    }

    if (rowChangeTrackers._commitTimeout) return;
    rowChangeTrackers._commitTimeout = setTimeout(() => {
      delete rowChangeTrackers._commitTimeout;
      rowChangeTrackers.commit();
    }, delay);
  }

  commit() {
    const rowChangeTrackers = this;

    if (rowChangeTrackers._commitTimeout) {
      clearTimeout(rowChangeTrackers._commitTimeout);
      delete rowChangeTrackers._commitTimeout;
    }

    while (Object.keys(rowChangeTrackers.rowCDOs).length) {
      const rowCDOs = Object.assign({}, rowChangeTrackers.rowCDOs);

      Object.assign(rowChangeTrackers, { rowCDOs: {}, rowProxies: {} });

      for (const [rowId, cdo] of Object.entries(rowCDOs)) {
        const { deletionsObject, changeObject, modified } = cdo;
        if (!modified[0]) continue;
        if (deletionsObject) {
          for (const fieldName of Object.keys(deletionsObject)) {
            rowChangeTrackers.setDatapointValue(rowId, fieldName, undefined);
          }
        }
        if (changeObject) {
          for (const [fieldName, value] of Object.entries(changeObject)) {
            rowChangeTrackers.setDatapointValue(rowId, fieldName, value);
          }
        }
      }
    }
  }

  setDatapointValue(rowId, fieldName, value) {
    if (fieldName == 'id') return;

    const rowChangeTrackers = this,
      { cache } = rowChangeTrackers,
      datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId,
      datapoint = cache.getOrCreateDatapoint({ datapointId });

    if (datapoint) datapoint.setValue(value);
  }

  getDatapointValue(rowId, fieldName) {
    if (fieldName == 'id') return rowId;

    const rowChangeTrackers = this,
      { cache } = rowChangeTrackers,
      datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId;
    const datapoint = cache.getExistingDatapoint({ datapointId });
    return datapoint && datapoint.valueIfAny;
  }

  getRowFieldNames(rowId) {
    const rowChangeTrackers = this,
      { schema } = rowChangeTrackers,
      typeName = ConvertIds.decomposeId({ rowId }).typeName,
      type = schema.allTypes[typeName],
      fieldNames = Object.keys(type.fields);
    return fieldNames.filter(fieldName => rowChangeTrackers(rowId, fieldName) !== undefined);
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: RowChangeTrackers,
  hasExposedBackDoor: true,
});
