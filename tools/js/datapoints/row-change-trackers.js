// row-change-trackers
// © Will Smart 2018. Licence: MIT

const PublicApi = require('../general/public-api');
const ConvertIds = require('./convert-ids');
const changeDetectorObject = require('../general/change-detector-object');
const mapValues = require('../general/map-values');
const log = require('../general/log');

class RowChangeTrackers {
  // public methods
  static publicMethods() {
    return ['rowObject', 'commit', 'execute', 'executeAfterValidatingDatapoints'];
  }

  constructor({ cache, schema, readOnly = true }) {
    const rowChangeTrackers = this;
    Object.assign(rowChangeTrackers, {
      cache,
      schema,
      readOnly,
      _executor: undefined,
      rowProxies: {},
      rowCDOs: {},
    });
  }

  async executeAfterValidatingDatapoints({ thisArg, fn, eventContext }, ...args) {
    const rowChangeTrackers = this;
    while (true) {
      const ret = await rowChangeTrackers.execute({ thisArg, fn, eventContext }, ...args);
      if (!ret.retryAfterPromises.length) return ret;
      await Promise.all(ret.retryAfterPromises);
    }
  }

  async execute({ thisArg, fn, eventContext }, ...args) {
    const rowChangeTrackers = this,
      executor = {
        rowChangeTrackers,
        retryAfterPromises: [],
        usesDatapoints: {},
      };

    const optionsArg = {
      getRowObject: rowChangeTrackers.rowObject.bind(rowChangeTrackers),
      getDatapointValue: rowChangeTrackers.getDatapointValue.bind(rowChangeTrackers),
      setDatapointValue: rowChangeTrackers.setDatapointValue.bind(rowChangeTrackers),
      willRetry: () => executor.retryAfterPromises.length > 0,
      eventContext,
    };

    const useThisArg =
      typeof thisArg == 'string' && ConvertIds.rowRegex.test(thisArg) ? rowChangeTrackers.rowObject(thisArg) : thisArg;

    try {
      const executorWas = rowChangeTrackers._executor;
      rowChangeTrackers._executor = executor;
      const result = fn.apply(useThisArg, args.concat([optionsArg]));
      rowChangeTrackers.commit();
      rowChangeTrackers._executor = executorWas;
      executor.result = RowChangeTrackers.sanitizeCDOs(await result);
    } catch (error) {
      if (error.message == 'Cannot mutate in non-mutating CDO') {
        // TODO type check instead
        const { cache, schema } = rowChangeTrackers,
          mutatingRowChangeTrackers = new RowChangeTrackers({ cache, schema, readOnly: false });
        return mutatingRowChangeTrackers.execute({ thisArg, fn, eventContext }, ...args);
      }
      log('err.eval', `While executing code: ${error.message}`);
      executor.error = error;
    }

    executor.modified = rowChangeTrackers.modifiedRowIds.length > 0;
    if (executor.modified) {
      executor.commit = rowChangeTrackers.commit.bind(rowChangeTrackers);
      executor.queueCommitJob = rowChangeTrackers.queueCommitJob.bind(rowChangeTrackers);
    }
    return executor;
  }

  get executor() {
    return this._executor;
  }

  rowObject(rowId) {
    const rowChangeTrackers = this,
      { rowCDOs, readOnly } = rowChangeTrackers;
    if (rowCDOs[rowId]) return rowCDOs[rowId].useObject;
    return (rowCDOs[rowId] = changeDetectorObject(rowChangeTrackers.rowProxy(rowId), readOnly)).useObject;
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

  get modifiedRowIds() {
    const rowChangeTrackers = this,
      ret = [];
    for (const [rowId, cdo] of Object.entries(rowChangeTrackers.rowCDOs)) {
      if (cdo.modified[0]) {
        ret.push(rowId);
      }
    }
    return ret;
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

  static sanitizeCDOs(value) {
    if (changeDetectorObject.isCDO(value)) {
      return value.id;
    }
    if (Array.isArray(value)) {
      return value.map(item => RowChangeTrackers.sanitizeCDOs(item));
    }
    if (value && typeof value == 'object' && value.constructor === Object) {
      return mapValues(value, item => RowChangeTrackers.sanitizeCDOs(item));
    }
    return value;
  }

  setDatapointValue(rowId, fieldName, value) {
    let embeddedDatapointId;
    if (ConvertIds.datapointRegex.test(rowId)) {
      value = fieldName;
      ({ rowId, fieldName, embeddedDatapointId } = ConvertIds.decomposeId({ datapointId: rowId }));
    }

    if (fieldName == 'id') return;

    const rowChangeTrackers = this,
      { cache } = rowChangeTrackers,
      { typeName } = ConvertIds.decomposeId({ rowId }),
      datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId,
      datapoint = cache.getOrCreateDatapoint(datapointId);

    if (datapoint.isId) {
      if (typeof value == 'string' && ConvertIds.rowRegex.test(value)) {
        value = [value];
      } else if (Array.isArray(value)) {
        value = value
          .map(item => {
            if (typeof item == 'string' && ConvertIds.rowRegex.test(item)) {
              return item;
            }
            if (item && typeof item == 'object') item = item.id;
            if (typeof item == 'string' && ConvertIds.rowRegex.test(item)) {
              return item;
            }
          })
          .filter(item => item);
        if (!datapoint.isMultiple && value.length > 1) value = [];
      } else value = undefined;
    }

    if (datapoint) datapoint.setValue(value);
  }

  getDatapointValue(rowId, fieldName, embeddedDatapointId, convertIdsToCDOs = true) {
    if (ConvertIds.datapointRegex.test(rowId)) {
      if (fieldName !== undefined) convertIdsToCDOs = fieldName;
      ({ rowId, fieldName, embeddedDatapointId } = ConvertIds.decomposeId({ datapointId: rowId }));
    }

    if (fieldName == 'id') return rowId;

    const rowChangeTrackers = this,
      { cache, schema, executor } = rowChangeTrackers,
      { typeName } = ConvertIds.decomposeId({ rowId }),
      datapointId = ConvertIds.recomposeId({ rowId, fieldName, embeddedDatapointId }).datapointId,
      datapoint = cache.getOrCreateDatapoint(datapointId);

    if (executor) executor.usesDatapoints[datapointId] = true;

    let value = datapoint && datapoint.valueIfAny;
    if (!datapoint.valid) {
      const promise = datapoint.value;
      if (executor) executor.retryAfterPromises.push(promise);
    }
    if (datapoint.isId && convertIdsToCDOs) {
      if (typeof value == 'string' && ConvertIds.rowRegex.test(value)) {
        value = [rowChangeTrackers.rowObject(value)];
      } else if (Array.isArray(value) && (datapoint.isMultiple || value.length <= 1)) {
        value = value
          .map(item => {
            if (typeof item == 'string' && ConvertIds.rowRegex.test(item)) {
              return rowChangeTrackers.rowObject(item);
            }
          })
          .filter(item => item);
      } else value = undefined;
    }
    return value;
  }

  getRowFieldNames(rowId) {
    const rowChangeTrackers = this,
      { schema } = rowChangeTrackers,
      typeName = ConvertIds.decomposeId({ rowId }).typeName,
      type = schema.allTypes[typeName],
      fieldNames = Object.keys(type.fields);
    fieldNames.push('id');
    return fieldNames;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: RowChangeTrackers,
  hasExposedBackDoor: true,
});
