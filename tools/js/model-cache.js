// model_cache
// © Will Smart 2018. Licence: MIT

// This is the central datapoint cache used by nobo
// Datapoints can be marked as 'invalid' via invalidateDatapoint (i.e. need to be reloaded from the db)
//   This should be called in response to a signal from the db
// They can also be marked as updated via updateDatapointValue (i.e. a new valud should be written to the db)

// Datapoints are components of views, which are essentially objects created with datapoints as properties
// Each view stores a sequence of 'versions' that have been assembled from the datapoints
// A new version is created whenever one of the view's datapoints is retrieved from the db resulting in a different value
// use addNewViewVersionCallback to be notified when this happens

const clone = require("./general/clone");
const ConvertIds = require("./convert-ids");
const PublicApi = require("./general/public-api");
const mapValues = require("./general/map-values");
const TemplateLocator = require("./template-locator");

// API is auto-generated at the bottom from the public interface of this class

class ModelCache {
  // public methods
  static publicMethods() {
    return [
      // get the latest version of a view from the cache or database
      // the argument should be the decomposed id for the view (i.e. using ConvertIds.decomposeId)
      // it may also have a "additionalFields" property holding additional fields for the view
      "getLatestViewVersion",
      "getLatestViewVersionIfAny",

      "invalidateDatapoint",
      "updateDatapointValue",
      "validateNewlyInvalidDatapoints",
      "commitNewlyUpdatedDatapoints",
      "addNewViewVersionCallback",
      "ensureViewFields",

      "schema",
      "connection",
      "templateLocator",

      "start",

      "watchDatapoint",
      "stopWatchingDatapoint",
      "uniqueCallbackKey",
      "associateDatapointCallback",
      "getDatapointValue"
    ];
  }

  constructor({ schema, connection }) {
    this._schema = schema;
    this._connection = connection;
    this.viewsById = {};
    this.invalidViewsById = {};
    this.viewIdsWithNewVersions = [];
    this.datapointsById = {};
    this.invalidDatapointsById = {};
    this.newlyInvalidDatapointIds = [];
    this.updatedDatapointsById = {};
    this.newlyUpdatedDatapointIds = [];
    this.newViewVersionCallbacks = {};
    this.newlyValidDatapointsByCallbackKey = {};
    this.datapointCallbacks = {};
    this.nextUniqueCallbackIndex = 1;
    this.spareTempCallbackKeys = [];
    this._templateLocator = new TemplateLocator({ cache: this });
  }

  // public methods

  uniqueCallbackKey({ callbackKeyPrefix = "callback" } = {}) {
    return `prefix___${this.nextUniqueCallbackIndex++}`;
  }

  associateDatapointCallback({ callbackKey, callback }) {
    this.newlyValidDatapointsByCallbackKey[callbackKey] = callback;
  }

  get tempCallbackKey() {
    return this.spareTempCallbackKeys.pop() || this.uniqueCallbackKey("__spare");
  }

  doneWithTempCallbackKey(key) {
    this.spareTempCallbackKeys.push(key);
  }

  async getDatapointValue({ datapointId }) {
    const cache = this;

    const datapoint = cache.getOrCreateDatapoint({ datapointId });
    if (!datapoint.invalid) return datapoint.publicValue;

    const ret = new Promise(resolve => {
      datapoint.watchingOneShotResolvers = datapoint.watchingOneShotResolvers || [];
      datapoint.watchingOneShotResolvers.push(resolve);
    });

    cache.validateNewlyInvalidDatapoints();

    return ret;
  }

  watchDatapoint({ datapointId, callbackKey }) {
    const cache = this;

    const datapoint = cache.getOrCreateDatapoint({ datapointId });

    datapoint.changeCallbacks[callbackKey] = true;
  }

  stopWatchingDatapoint({ datapointId, callbackKey }) {
    const cache = this;

    const datapoint = cache.getOrCreateDatapoint({ datapointId });

    delete datapoint.changeCallbacks[callbackKey];
    if (!Object.keys(datapoint.changeCallbacks).length) delete datapoint.changeCallbacks;
  }

  async start() {
    await this._templateLocator.load();
  }

  get schema() {
    return this._schema;
  }

  get connection() {
    return this._connection;
  }

  get templateLocator() {
    return this._templateLocator;
  }

  async getLatestViewVersion({ viewId }, { outputKeyProvider } = {}) {
    const cache = this;

    const idInfo = ConvertIds.ensureDecomposed(arguments[0]);

    this.ensureViewFields(idInfo, { outputKeyProvider });

    let ret = this.getLatestViewVersionIfAny(idInfo);
    if (ret) return ret;

    await this.validateNewlyInvalidDatapoints();

    ret = this.getLatestViewVersionIfAny(idInfo);
    if (ret) return ret;

    throw new Error("Expected to have a view version by now");
  }

  invalidateDatapoint({ datapointId }) {
    const cache = this;

    const datapoint = cache.datapointsById[datapointId];
    if (!datapoint || datapoint.invalid) return;

    cache.invalidDatapointsById[datapointId] = datapoint;
    datapoint.invalid = true;

    cache.newlyInvalidDatapointIds.push(datapointId);

    Object.keys(datapoint.viewsById).forEach(viewId => {
      const view = datapoint.viewsById[viewId];
      if (!view.invalidDatapointCount++) {
        cache.invalidViewsById[viewId] = datapoint.viewsById[viewId];
      }
    });
    if (datapoint.dependentDatapointsById) {
      for (let dependentDatapoint of Object.values(datapoint.dependentDatapointsById)) {
        if (!dependentDatapoint.invalidDependencyDatapointCount++) {
          this.invalidateDatapoint(dependentDatapoint);
        }
        if (dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
          for (const dependency of dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
            cache.updateDependencies({
              datapoint: dependentDatapoint,
              dependencies: dependency.children
            });
          }
        }
      }
    }
  }

  updateDatapointValue({ datapointId, newValue }) {
    const cache = this;

    const datapoint = cache.datapointsById[datapointId];
    if (!datapoint) return;

    cache.updatedDatapointsById[datapointId] = datapoint;
    datapoint.newValue = clone(newValue);

    cache.newlyUpdatedDatapointIds.push(datapointId);
  }

  validateNewlyInvalidDatapoints() {
    const cache = this;

    const datapoints = this.newlyInvalidDatapointIds
      .map(datapointId => cache.datapointsById[datapointId])
      .filter(datapoint => datapoint);
    this.newlyInvalidDatapointIds = [];
    return this.validateDatapoints(datapoints);
  }

  commitNewlyUpdatedDatapoints() {
    const cache = this;

    const datapoints = this.newlyUpdatedDatapointIds
      .map(datapointId => cache.datapointsById[datapointId])
      .filter(datapoint => datapoint);
    cache.newlyUpdatedDatapointIds = [];
    return cache.commitDatapoints(datapoints);
  }

  addNewViewVersionCallback({ key, callback }) {
    this.newViewVersionCallbacks[key] = callback;
  }

  // private methods

  getLatestViewVersionIfAny({ viewId }) {
    const view = this.viewsById[viewId];
    if (!(view && view.versions.length)) return;
    return view.versions[view.versions.length - 1];
  }

  getOrCreateDatapoint({ datapointId }) {
    const cache = this;

    let datapoint = this.datapointsById[datapointId];
    if (!datapoint) {
      datapoint = this.datapointsById[datapointId] = Object.assign(
        ConvertIds.decomposeId({ datapointId: datapointId }),
        {
          viewCount: 0,
          viewsById: {}
        }
      );
      const field = cache.schema.fieldForDatapoint(datapoint);
      if (field && field.get) {
        const type = field.enclosingType;

        function dependenciesFromNames(names) {
          return mapValues(names, subNames => {
            const children = dependenciesFromNames(subNames);
            return Object.keys(children).length ? { children } : {};
          });
        }

        datapoint.dependencies = dependenciesFromNames(field.get.names);
        datapoint.dependenciesByDatapointId = {};
        datapoint.dependencyDatapointCountsById = {};
        datapoint.invalidDependencyDatapointCount = 0;
        cache.updateDependencies({
          datapoint,
          parentRowId: datapoint,
          dependencies: datapoint.dependencies
        });
        if (datapoint.invalidDependencyDatapointCount) {
          this.invalidateDatapoint(arguments[0]);
        }
      } else {
        this.invalidateDatapoint(arguments[0]);
      }
    }
    return datapoint;
  }

  updateDependencies({ datapoint, parentRowId, parentDatapointWithRowAsValue, dependencies }) {
    const cache = this;

    if (!dependencies) return;

    if (!parentRowId && parentDatapointWithRowAsValue) {
      let field = cache.schema.fieldForDatapoint(parentDatapointWithRowAsValue);
      if (
        field.isId &&
        !field.isMultiple &&
        !parentDatapointWithRowAsValue.invalid &&
        Array.isArray(parentDatapointWithRowAsValue.value) &&
        parentDatapointWithRowAsValue.value.length == 1
      ) {
        try {
          parentRowId = ConvertIds.decomposeId({ rowId: parentDatapointWithRowAsValue.value[0] });
        } catch (err) {
          console.log(err);
        }
      }
    }

    const parentType = parentRowId ? cache.schema.allTypes[parentRowId.typeName] : undefined;

    for (const [name, dependency] of Object.entries(dependencies)) {
      const dependencyField = parentType ? parentType.fields[name] : undefined;
      let valueRowId, dependencyDatapoint;
      if (dependencyField) {
        dependencyDatapoint = cache.getOrCreateDatapoint({ datapointId: dependencyField.getDatapointId(parentRowId) });
      }

      if (dependency.datapoint) {
        if (!dependencyDatapoint || dependency.datapoint.datapointId != dependencyDatapoint.datapointId) {
          delete dependency.datapoint.dependentDatapointsById[datapoint.datapointId];
          datapoint.dependenciesByDatapointId[dependency.datapoint.datapointId] = datapoint.dependenciesByDatapointId[
            dependency.datapoint.datapointId
          ].filter(dependency2 => {
            dependency !== dependency2;
          });
          if (!datapoint.dependenciesByDatapointId[dependency.datapoint.datapointId].length) {
            delete datapoint.dependenciesByDatapointId[dependency.datapoint.datapointId];
          }
          if (!--datapoint.dependencyDatapointCountsById[dependency.datapoint.datapointId]) {
            delete datapoint.dependencyDatapointCountsById[dependency.datapoint.datapointId];
          }
          if (dependency.datapoint.invalid) datapoint.invalidDependencyDatapointCount--;
          delete dependency.datapoint;
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
        cache.updateDependencies({
          datapoint,
          parentDatapointWithRowAsValue: dependencyDatapoint,
          dependencies: dependency.children
        });
      }
    }
  }

  getOrCreateView({ viewId }) {
    return (
      this.viewsById[viewId] ||
      (this.viewsById[viewId] = Object.assign(ConvertIds.decomposeId({ viewId: viewId }), {
        versions: [], // each is a mapping of output key to value, with me and version keys also set
        outputKeysByDatapointId: {}, // each is an array of output keys
        datapointsByOutputKey: {}, // each has a datapointId and variant
        valuesByOutputKey: {},
        invalidDatapointCount: 0
      }))
    );
  }

  ensureViewFields({ viewId }, { outputKeyProvider } = {}) {
    if (this.viewsById[viewId]) return;

    const idInfo = arguments[0];

    outputKeyProvider = outputKeyProvider || (idInfo => cache.templateLocator.outputKeysForView(idInfo));

    const outputKeys = outputKeyProvider(idInfo);
    this.setViewFields(idInfo, outputKeys);
  }

  setViewFields({ viewId }, outputKeys) {
    const cache = this;
    const idInfo = arguments[0];

    const view = cache.getOrCreateView(idInfo);

    const datapointsByOutputKey = {};
    const valuesByOutputKey = {};
    const outputKeysByDatapointId = {};
    let invalidDatapointCount = 0;

    Object.keys(outputKeys).forEach(outputKey => {
      let val = outputKeys[outputKey];
      if (typeof val != "object") val = {};
      if (val.value !== undefined) {
        valuesByOutputKey[outputKey] = clone(val.value);
        return;
      }

      const datapointId = val.datapointId;
      if (!datapointId) return;

      const variant = val.variant;
      const datapoint = cache.getOrCreateDatapoint(val);

      datapointsByOutputKey[outputKey] = {
        datapoint: datapoint,
        variant: val.variant
      };

      let datapointOutputKeys = outputKeysByDatapointId[datapointId];
      if (datapointOutputKeys) {
        datapointOutputKeys.push(outputKey);
        return;
      }

      datapointOutputKeys = outputKeysByDatapointId[datapointId] = [outputKey];

      if (datapoint.invalid) invalidDatapointCount++;

      if (!datapoint.viewsById[viewId]) datapoint.viewCount++;
      datapoint.viewsById[viewId] = view;
    });

    Object.keys(view.outputKeysByDatapointId).forEach(datapointId => {
      if (outputKeysByDatapointId[datapointId]) return;

      const datapoint = cache.getOrCreateDatapoint({ datapointId: datapointId });
      if (datapoint.viewsById[viewId] === view) {
        delete datapoint.viewsById[viewId];
        if (!--datapoint.viewCount) {
          delete cache.datapointsById[datapoint.datapointId];
          delete cache.invalidDatapointsById[datapoint.datapointId];
        }
      }
    });

    view.outputKeysByDatapointId = outputKeysByDatapointId;
    view.datapointsByOutputKey = datapointsByOutputKey;
    view.valuesByOutputKey = valuesByOutputKey;
    if ((view.invalidDatapointCount = invalidDatapointCount)) {
      cache.invalidViewsById[viewId] = view;
    } else {
      cache.addVersionForNewlyValidatedView(view);
    }
  }

  committedDatapoint({ datapointId }) {
    const cache = this;

    const datapoint = cache.datapointsById[datapointId];
    if (!datapoint) return;

    delete cache.updatedDatapointsById[datapointId];
    delete datapoint.newValue;
  }

  validateDatapoint({ datapointId, value, useGetter }) {
    const cache = this;

    const datapoint = cache.datapointsById[datapointId];
    if (!datapoint || !datapoint.invalid) return;

    const getter = cache.schema.fieldForDatapoint(datapoint).get;
    if (useGetter && value === undefined && !getter) {
      console.log(`Datapoint ${datapoint.datapointId} has dependencies so should have a getter`);
      value = "?";
    }
    if (getter) {
      const sandbox = {};
      sandbox[getter.resultKey] = "?";

      if (datapoint.dependencies) {
        function addDependencyValues(dependencies, to) {
          for (let [name, dependency] of Object.entries(dependencies)) {
            if (dependency.children) {
              to[name] = {};
              addDependencyValues(dependency.children, to[name]);
            } else if (dependency.datapoint && !dependency.datapoint.invalid) {
              to[name] = dependency.datapoint.value;
            } else {
              to[name] = "...";
            }
          }
        }
        addDependencyValues(datapoint.dependencies, sandbox);
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
      value = sandbox[getter.resultKey];
    }
    delete datapoint.invalid;
    delete cache.invalidDatapointsById[datapointId];
    datapoint.value = clone(value);
    datapoint.publicValue = clone(datapoint.value);

    const ret = [];
    Object.keys(datapoint.viewsById).forEach(viewId => {
      const view = datapoint.viewsById[viewId];
      if (!--view.invalidDatapointCount) {
        delete cache.invalidViewsById[viewId];

        cache.addVersionForNewlyValidatedView(view);

        ret.push(view);
      }
    });
    if (datapoint.dependentDatapointsById) {
      for (let dependentDatapoint of Object.values(datapoint.dependentDatapointsById)) {
        if (dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
          for (const dependency of dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
            cache.updateDependencies({
              datapoint: dependentDatapoint,
              parentDatapointWithRowAsValue: datapoint,
              dependencies: dependency.children
            });
          }
        }
        if (!--dependentDatapoint.invalidDependencyDatapointCount) {
          cache.validateDatapoint({ datapointId: dependentDatapoint.datapointId, useGetter: true });
        }
      }
    }
    if (datapoint.changeCallbacks) {
      for (let key of Object.keys(datapoint.changeCallbacks)) {
        cache.newlyValidDatapointsByCallbackKey[key] = cache.newlyValidDatapointsByCallbackKey[key] || {};
        cache.newlyValidDatapointsByCallbackKey[key][datapoint.datapointId] = datapoint.publicValue;
      }
    }
    if (datapoint.watchingOneShotResolvers) {
      const watchingOneShotResolvers = datapoint.watchingOneShotResolvers;
      delete datapoint.watchingOneShotResolvers;
      for (let resolve of watchingOneShotResolvers) {
        resolve(datapoint.publicValue);
      }
    }

    return ret;
  }

  addVersionForNewlyValidatedView(view) {
    const cache = this;

    if (view.invalidDatapointCount) return;

    const version = {
      me: view.viewId,
      version: view.versions.length ? view.versions[view.versions.length - 1].version + 1 : 1
    };

    function addVariantToRowId(value, variant) {
      if (Array.isArray(value)) {
        for (let index = value.length - 1; index >= 0; index--) {
          const viewId = addVariantToRowId(value[index], variant);
          if (viewId) value[index] = viewId;
        }
      } else if (typeof value == "string" && ConvertIds.rowRegex.test(value)) {
        value = ConvertIds.recomposeId(Object.assign(ConvertIds.decomposeId({ rowId: value }), { variant })).viewId;
      }
      return value;
    }

    Object.keys(view.datapointsByOutputKey).forEach(outputKey => {
      if (version[outputKey]) return;
      const datapointAndVariant = view.datapointsByOutputKey[outputKey];

      const datapoint = datapointAndVariant.datapoint;
      const variant = datapointAndVariant.variant;

      if (datapoint.invalid) throw new Error("Datapoint is strangly invalid");

      let value = datapoint.value;
      if (value === undefined || value === null || (Array.isArray(value) && !value.length)) return;

      value = clone(value);
      if (variant) value = addVariantToRowId(value, variant);
      version[outputKey] = value;
    });

    Object.keys(view.valuesByOutputKey).forEach(outputKey => {
      const value = view.valuesByOutputKey[outputKey];

      if (value === undefined || value === null || (Array.isArray(value) && !value.length)) {
        delete version[outputKey];
      } else {
        version[outputKey] = value;
      }
    });

    view.versions.push(version);
    //console.log(`New view version out: -- ${JSON.stringify(version, null, 2)}`);
    cache.viewIdsWithNewVersions.push(view.viewId);
  }

  validateDatapoints(datapoints) {
    if (!datapoints.length) return;
    const cache = this;
    const schema = cache.schema;
    const connection = cache.connection;

    const fieldsByRowByType = {};
    datapoints.forEach(datapoint => {
      if (!cache.invalidDatapointsById[datapoint.datapointId]) return;

      let field;
      try {
        field = schema.fieldForDatapoint(datapoint);
      } catch (err) {
        console.log(err);
        cache.validateDatapoint(datapoint);
        return;
      }

      if (field.get) {
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
            .getViewFields({
              type: type,
              id: dbRowId,
              fields: fields
            })
            .then(view => {
              fields.forEach(field => {
                cache.validateDatapoint({
                  datapointId: field.getDatapointId({ dbRowId: dbRowId }),
                  value: view[field.name]
                });
              });
            })
        );
      });
    });

    return Promise.all(promises).then(() => {
      const newlyValidDatapointsByCallbackKey = cache.newlyValidDatapointsByCallbackKey;
      cache.newlyValidDatapointsByCallbackKey = {};
      for (let [key, valuesById] of Object.entries(newlyValidDatapointsByCallbackKey)) {
        const callback = this.datapointCallbacks[key];
        if (callback) callback(valuesById);
      }

      const viewIdsWithNewVersions = cache.viewIdsWithNewVersions;
      cache.viewIdsWithNewVersions = [];
      Object.keys(cache.newViewVersionCallbacks).forEach(key => {
        cache.newViewVersionCallbacks[key](viewIdsWithNewVersions);
      });
    });
  }

  commitDatapoints(datapoints) {
    if (!datapoints.length) return;

    const cache = this;
    const schema = cache.schema;
    const connection = cache.connection;

    const fieldsByRowByType = {};
    datapoints.forEach(datapoint => {
      if (!cache.updatedDatapointsById[datapoint.datapointId]) return;

      let field;
      try {
        field = schema.fieldForDatapoint(datapoint);
      } catch (err) {
        console.log(err);
        cache.committedDatapoint(datapoint);
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
            .updateViewFields({
              type: type,
              id: dbRowId,
              fields: fieldInfos
            })
            .then(() => {
              fieldInfos.forEach(fieldInfo => {
                cache.committedDatapoint(fieldInfo);
              });
            })
        );
      });
    });

    return Promise.all(promises);
  }
}

// API is the public facing class
module.exports = PublicApi({ fromClass: ModelCache, hasExposedBackDoor: true });
