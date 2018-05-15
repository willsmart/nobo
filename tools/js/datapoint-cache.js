// model_cache
// © Will Smart 2018. Licence: MIT

// This is the central datapoint cache used by nobo
// Datapoints can be marked as 'invalid' via invalidateDatapoint (i.e. need to be reloaded from the db)
//   This should be called in response to a signal from the db
// They can also be marked as updated via updateDatapointValue (i.e. a new valud should be written to the db)

const clone = require("./general/clone");
const ConvertIds = require("./convert-ids");
const PublicApi = require("./general/public-api");
const mapValues = require("./general/map-values");

var g_nextUniqueCallbackIndex = 1;

function uniqueCallbackKey() {
  return `callback__${g_nextUniqueCallbackIndex++}`;
}

// API is auto-generated at the bottom from the public interface of the DatapointCache class

class Datapoint {
  // public methods (not currently enforced via PublicAPI, but this is the public api to use)
  static publicMethods() {
    return ["invalidate", "updateValue", "watch", "stopWatching", "value", "valueIfAny"];
  }

  constructor({
    cache,
    datapointId
  }) {
    const datapoint = this;

    cache.datapointsById[datapointId] = datapoint;

    Object.assign(datapoint, ConvertIds.decomposeId({
      datapointId
    }));
    datapoint.listeners = [];
    datapoint.cache = cache;

    const field = datapoint.fieldIfAny;

    if (field && field.get) {
      datapoint.setupDependencyFields();
    }
    datapoint.invalidate();
  }

  get valueIfAny() {
    return this._value;
  }

  get value() {
    const datapoint = this;

    if (!datapoint.invalid) return Promise.resolve(datapoint.valueIfAny);

    const ret = new Promise(resolve => {
      datapoint.watchingOneShotResolvers = datapoint.watchingOneShotResolvers || [];
      datapoint.watchingOneShotResolvers.push(resolve);
    }).then(theDatapoint => {
      return theDatapoint.value
    });

    datapoint.cache.validateNewlyInvalidDatapoints();

    return ret;
  }

  watch(listener) {
    const datapoint = this;
    if (!listener.callbackKey) listener.callbackKey = uniqueCallbackKey();
    const {
      oninvalid,
      onvalid,
      callbackKey
    } = listener;

    datapoint.listeners.push({
      callbackKey,
      oninvalid,
      onvalid
    });

    return callbackKey;
  }

  stopWatching({
    callbackKey
  }) {
    const datapoint = this;

    let index = 0
    for (const listener of datapoint.listeners) {
      if (listener.callbackKey == callbackKey) {
        datapoint.listeners.splice(index, 1)
        datapoint.deleteIfUnwatched();
        return listener
      }
      index++
    }
  }

  invalidate() {
    const datapoint = this,
      {
        cache
      } = datapoint;

    if (datapoint.invalid) return datapoint;

    datapoint.invalid = true;
    delete datapoint._value
    cache.newlyInvalidDatapointIds.push(datapoint.datapointId);

    if (datapoint.dependentDatapointsById) {
      for (let dependentDatapoint of Object.values(datapoint.dependentDatapointsById)) {
        if (!dependentDatapoint.invalidDependencyDatapointCount++) {
          dependentDatapoint.invalidate();
        }

        if (dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
          for (const dependency of dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
            dependentDatapoint.updateDependencies({
              dependencies: dependency.children
            });
          }
        }
      }
    }

    for (const {
        oninvalid
      } of datapoint.listeners) {
      if (oninvalid) oninvalid({
        datapoint
      });
    }

    return datapoint
  }

  validate({
    value
  } = {}) {
    const datapoint = this,
      {
        cache
      } = datapoint;

    if (!datapoint.invalid) return;

    const field = datapoint.fieldIfAny;
    if (field && field.get) {
      value = Datapoint.valueFromGetter({
        getter: field.get,
        dependencies: datapoint.dependencies
      });
    }

    datapoint._value = clone(value);

    delete datapoint.invalid;
    cache.newlyValidDatapoints.push(datapoint.datapointId);

    if (datapoint.dependentDatapointsById) {
      for (let dependentDatapoint of Object.values(datapoint.dependentDatapointsById)) {
        if (dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
          for (const dependency of dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
            dependentDatapoint.updateDependencies({
              parentRowId: datapoint.valueAsDecomposedRowId,
              dependencies: dependency.children
            });
          }
        }
        if (!--dependentDatapoint.invalidDependencyDatapointCount) {
          dependentDatapoint.validate()
        }
      }
    }

    for (let {
        onvalid
      } of datapoint.listeners) {
      if (onvalid) onvalid({
        datapoint
      });
    }

    if (datapoint.watchingOneShotResolvers) {
      const watchingOneShotResolvers = datapoint.watchingOneShotResolvers;
      delete datapoint.watchingOneShotResolvers;
      for (let resolve of watchingOneShotResolvers) {
        resolve(datapoint);
      }
    }

    datapoint.deleteIfUnwatched();
  }

  updateValue({
    newValue
  }) {
    const datapoint = this,
      {
        cache
      } = datapoint;

    datapoint.newValue = clone(newValue);
    datapoint.updated = true;

    cache.newlyUpdatedDatapointIds.push(datapoint.datapointId);

    return datapoint
  }

  get fieldIfAny() {
    try {
      return this.cache.schema.fieldForDatapoint(this);
    } catch (err) {}
  }

  get valueAsRowId() {
    const datapoint = this;

    const field = datapoint.fieldIfAny,
      value = datapoint.valueIfAny;
    if (!field ||
      !field.isId ||
      field.isMultiple ||
      datapoint.invalid ||
      !Array.isArray(value) ||
      value.length != 1
    )
      return;

    return value[0];
  }

  get valueAsDecomposedRowId() {
    const rowId = this.valueAsRowId
    if (!rowId) return
    try {
      return ConvertIds.decomposeId({
        rowId
      });
    } catch (err) {
      console.log(err);
    }
  }

  setupDependencyFields() {
    const datapoint = this;

    const field = datapoint.fieldIfAny;
    Object.assign(this, {
      dependenciesByDatapointId: {},
      dependencyDatapointCountsById: {},
      invalidDependencyDatapointCount: 0,
      dependencies: !field ? {} : (function dependencyTreeFromNames(names) {
        return mapValues(names, subNames => {
          const children = dependencyTreeFromNames(subNames);
          return Object.keys(children).length ? {
            children
          } : {};
        });
      })(field.get.names)
    });

    datapoint.updateDependencies({
      parentRowId: datapoint,
      dependencies: datapoint.dependencies
    });
  }

  updateDependencies({
    parentRowId,
    dependencies
  }) {
    const datapoint = this,
      {
        cache
      } = datapoint;

    if (!dependencies) return;

    const parentType = parentRowId ? cache.schema.allTypes[parentRowId.typeName] : undefined;

    for (const [name, dependency] of Object.entries(dependencies)) {
      datapoint.updateDependency({
        name,
        dependency,
        parentRowId,
        parentType
      });
    }
  }

  updateDependency({
    name,
    dependency,
    parentRowId,
    parentType
  }) {
    const datapoint = this,
      {
        cache
      } = datapoint;

    const dependencyField = parentType ? parentType.fields[name] : undefined;
    let valueRowId, dependencyDatapoint;
    if (dependencyField) {
      dependencyDatapoint = cache.getOrCreateDatapoint({
        datapointId: dependencyField.getDatapointId(parentRowId)
      });
    }

    if (dependency.datapoint) {
      if (!dependencyDatapoint || dependency.datapoint.datapointId != dependencyDatapoint.datapointId) {
        const oldDependencyDatapoint = dependency.datapoint;
        delete oldDependencyDatapoint.dependentDatapointsById[datapoint.datapointId];
        datapoint.dependenciesByDatapointId[oldDependencyDatapoint.datapointId] = datapoint.dependenciesByDatapointId[
          oldDependencyDatapoint.datapointId
        ].filter(dependency2 => {
          dependency !== dependency2;
        });
        if (!datapoint.dependenciesByDatapointId[oldDependencyDatapoint.datapointId].length) {
          delete datapoint.dependenciesByDatapointId[oldDependencyDatapoint.datapointId];
        }
        if (!--datapoint.dependencyDatapointCountsById[oldDependencyDatapoint.datapointId]) {
          delete datapoint.dependencyDatapointCountsById[oldDependencyDatapoint.datapointId];
        }
        if (oldDependencyDatapoint.invalid) datapoint.invalidDependencyDatapointCount--;
        delete dependency.datapoint;

        oldDependencyDatapoint.deleteIfUnwatched();
      }
    }

    if (dependencyDatapoint && !dependency.datapoint) {
      dependency.datapoint = dependencyDatapoint;
      dependencyDatapoint.dependentDatapointsById = dependencyDatapoint.dependentDatapointsById || {};
      dependencyDatapoint.dependentDatapointsById[datapoint.datapointId] = datapoint;
      datapoint.dependenciesByDatapointId[dependencyDatapoint.datapointId] =
        datapoint.dependenciesByDatapointId[dependencyDatapoint.datapointId] || [];
      datapoint.dependenciesByDatapointId[dependencyDatapoint.datapointId].push(dependency);
      datapoint.dependencyDatapointCountsById[dependencyDatapoint.datapointId] =
        (datapoint.dependencyDatapointCountsById[dependencyDatapoint.datapointId] || 0) + 1;
      if (dependencyDatapoint.invalid) datapoint.invalidDependencyDatapointCount++;
    }

    if (dependency.children) {
      datapoint.updateDependencies({
        parentRowId: dependencyDatapoint.valueAsDecomposedRowId,
        dependencies: dependency.children
      });
    }
  }

  deleteIfUnwatched() {
    const datapoint = this;

    if (datapoint.listeners.length ||
      datapoint.watchingOneShotResolvers ||
      (datapoint.dependentDatapointsById && Object.keys(datapoint.dependentDatapointsById).length)
    ) {
      return;
    }

    datapoint.forget()
  }

  forget() {
    const datapoint = this,
      {
        cache
      } = datapoint;

    if (datapoint.dependenciesByDatapointId) {
      for (const dependencyDatapointId of Object.keys(datapoint.dependenciesByDatapointId)) {
        const dependencyDatapoint = cache.getExistingDatapoint({
          datapointId: dependencyDatapointId
        })
        delete dependencyDatapoint.dependentDatapointsById[datapoint.datapointId]
        if (!Object.keys(dependencyDatapoint.dependentDatapointsById).length) {
          delete dependencyDatapoint.dependentDatapointsById
          dependencyDatapoint.deleteIfUnwatched()
        }
      }
    }

    delete datapoint.dependenciesByDatapointId
    delete datapoint.dependencyDatapointCountsById
    delete datapoint.invalidDependencyDatapointCount
    delete datapoint.dependencies

    cache.forgetDatapoint(datapoint);
  }

  static valueFromGetter({
    getter,
    dependencies
  }) {
    const sandbox = {};
    sandbox[getter.resultKey] = "?";

    if (dependencies) {
      (function addDependencyValues(dependencies, to) {
        for (let [name, dependency] of Object.entries(dependencies)) {
          if (dependency.children) {
            to[name] = {};
            addDependencyValues(dependency.children, to[name]);
          } else if (dependency.datapoint && !dependency.datapoint.invalid) {
            to[name] = dependency.datapoint.valueIfAny;
          } else {
            to[name] = "...";
          }
        }
      })(dependencies, sandbox);
    }

    try {
      getter.script.runInNewContext(sandbox, {
        displayErrors: true,
        timeout: 1000
      });
    } catch (err) {
      console.log(`Failed to run getter:
      ${err}
`);
    }
    return sandbox[getter.resultKey];
  }
}

class DatapointCache {
  // public methods
  static publicMethods() {
    return [
      "getExistingDatapoint",
      "getOrCreateDatapoint",
      "validateNewlyInvalidDatapoints",
      "commitNewlyUpdatedDatapoints",

      "watch", "stopWatching",

      "schema", "connection",
    ];
  }

  constructor({
    schema,
    connection
  }) {
    this._schema = schema;
    this._connection = connection;
    this.datapointsById = {};
    this.newlyInvalidDatapointIds = [];
    this.newlyUpdatedDatapointIds = [];
    this.newlyValidDatapoints = [];
  }

  get schema() {
    return this._schema;
  }

  get connection() {
    return this._connection;
  }

  forgetDatapoint({
    datapointId
  }) {
    const cache = this;

    delete cache.datapointsById[datapointId];
  }

  validateNewlyInvalidDatapoints() {
    const cache = this;

    const datapoints = cache.newlyInvalidDatapointIds
      .map(datapointId => cache.datapointsById[datapointId])
      .filter(datapoint => datapoint);

    cache.newlyInvalidDatapointIds = [];

    return cache.validateDatapoints(datapoints);
  }

  commitNewlyUpdatedDatapoints() {
    const cache = this;

    const datapoints = cache.newlyUpdatedDatapointIds
      .map(datapointId => cache.datapointsById[datapointId])
      .filter(datapoint => datapoint);

    cache.newlyUpdatedDatapointIds = [];

    return cache.commitDatapoints(datapoints);
  }

  getExistingDatapoint({
    datapointId
  }) {
    return this.datapointsById[datapointId];
  }

  getOrCreateDatapoint({
    datapointId
  }) {
    const cache = this;

    let datapoint = cache.datapointsById[datapointId];
    if (datapoint) return datapoint;

    return (cache.datapointsById[datapointId] = new Datapoint({
      cache,
      datapointId
    }));
  }

  validateDatapoints(datapoints) {
    const cache = this;

    if (!datapoints.length) return;

    const schema = cache.schema;
    const connection = cache.connection;

    const fieldsByRowByType = {};
    datapoints.forEach(datapoint => {
      if (!datapoint.invalid) return;
      const field = datapoint.fieldIfAny;
      if (!field || field.get) {
        if (!datapoint.invalidDependencyDatapointCount) {
          datapoint.validate()
        }
        return;
      }

      const fieldsByRow = fieldsByRowByType[datapoint.typeName] || (fieldsByRowByType[datapoint.typeName] = {});
      const fields = fieldsByRow[datapoint.dbRowId] || (fieldsByRow[datapoint.dbRowId] = []);
      fields.push(field);
    });

    const promises = [];
    Object.keys(fieldsByRowByType).forEach(typeName => {
      const type = schema.allTypes[typeName];
      const fieldsByRow = fieldsByRowByType[typeName];

      Object.keys(fieldsByRow).forEach(dbRowId => {
        const fields = fieldsByRow[dbRowId];

        promises.push(
          connection
          .getRowFields({
            type,
            dbRowId,
            fields
          })
          .then(row => {
            fields.forEach(field => {
              const datapoint = cache.getExistingDatapoint({
                datapointId: field.getDatapointId({
                  dbRowId
                })
              })
              if (datapoint) datapoint.validate({
                value: row[field.name]
              });
            });
          }));
      });
    });

    return Promise.all(promises).then(() => {
      const newlyValidDatapoints = cache.newlyValidDatapoints;
      cache.newlyValidDatapoints = [];
      if (cache.listeners) {
        for (let {
            onvalid
          } of cache.listeners) {
          if (onvalid) onvalid(newlyValidDatapoints);
        }
      }
    });
  }

  commitDatapoints(datapoints) {
    if (!datapoints.length) return;

    const cache = this;
    const schema = cache.schema;
    const connection = cache.connection;

    const fieldsByRowByType = {};
    datapoints.forEach(datapoint => {
      if (!datapoint.updated) return;

      let field;
      try {
        field = schema.fieldForDatapoint(datapoint);
      } catch (err) {
        console.log(err);

        delete datapoint.updated;
        delete datapoint.newValue;
        return;
      }

      const fieldsByRow = fieldsByRowByType[datapoint.typeName] || (fieldsByRowByType[datapoint.typeName] = {});
      const fields = fieldsByRow[datapoint.dbRowId] || (fieldsByRow[datapoint.dbRowId] = []);
      fields.push({
        name: field.name,
        value: datapoint.newValue,
        field: field,
        datapointId: datapoint.datapointId
      });
    });

    const promises = [];
    Object.keys(fieldsByRowByType).forEach(typeName => {
      const type = schema.allTypes[typeName];
      const fieldsByRow = fieldsByRowByType[typeName];
      Object.keys(fieldsByRow).forEach(dbRowId => {
        const fieldInfos = fieldsByRow[dbRowId];

        promises.push(
          connection
          .updateRowFields({
            type: type,
            dbRowId,
            fields: fieldInfos
          })
          .then(() => {
            fieldInfos.forEach(fieldInfo => {
              const datapoint = cache.datapointsById[fieldInfo.datapointId];
              delete datapoint.updated;
              delete datapoint.newValue;
            });
          })
        );
      });
    });

    return Promise.all(promises);
  }

  watch(listener) {
    const cache = this;
    if (!listener.callbackKey) listener.callbackKey = uniqueCallbackKey();
    const {
      oninvalid,
      onvalid,
      callbackKey
    } = listener;

    cache.listeners.push({
      callbackKey,
      oninvalid,
      onvalid
    });

    return callbackKey;
  }

  stopWatching({
    callbackKey
  }) {
    const cache = this;

    let index = 0
    for (const listener of cache.listeners) {
      if (listener.callbackKey == callbackKey) {
        cache.listeners.splice(index, 1)
        return listener
      }
      index++
    }
  }

}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DatapointCache,
  hasExposedBackDoor: true
});