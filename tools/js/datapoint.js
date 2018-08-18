// datapoint
// © Will Smart 2018. Licence: MIT

// This is the central datapoint object used by nobo
// Datapoints can be marked as 'invalid' via invalidateDatapoint (i.e. need to be reloaded from the db)
//   This should be called in response to a signal from the db
// They can also be marked as updated via updateDatapointValue (i.e. a new valud should be written to the db)

const ChangeCase = require('change-case');

const clone = require('./general/clone');
const PublicApi = require('./general/public-api');
const mapValues = require('./general/map-values');
const makeClassWatchable = require('./general/watchable');
const CodeSnippet = require('./general/code-snippet');

const ConvertIds = require('./convert-ids');

// other implied dependencies

//const DatapointCache = require('./datapoint-cache'); // via constructor arg: cache
//    uses pretty much the whole public api

//const Templates = require('./templates'); // via constructor arg: templates
//    uses getTemplateReferencingDatapoint

//const Schema = require('./schema'); // via constructor arg: schema
//    uses allTypes and fieldForDatapoint

function log() {
  //console.log.apply(console, arguments);
}

// API is auto-generated at the bottom from the public interface of this class
class Datapoint {
  static publicMethods() {
    return [
      'invalidate',
      'validate',
      'commit',
      'updateValue',
      'watch',
      'stopWatching',
      'value',
      'valueIfAny',
      'setVirtualField',
      'invalid',
      'fieldIfAny',
      'datapointId',
      'datapointId',
      'rowId',
      'rowId',
      'typeName',
      'fieldName',
      'dbRowId',
      'isClient',
      'setIsClient',
    ];
  }

  constructor({ cache, schema, templates, datapointId, isClient }) {
    const datapoint = this;

    log(`creating datapoint ${datapointId}`);

    const datapointInfo = ConvertIds.decomposeId({
      datapointId: datapointId,
    });
    const { rowId, typeName, dbRowId, fieldName, proxyKey } = datapointInfo;
    Object.assign(datapoint, {
      _datapointId: datapointId,
      _rowId: rowId,
      _typeName: typeName,
      _dbRowId: dbRowId,
      _fieldName: fieldName,
      _proxyKey: proxyKey,
    });
    datapoint._isClient = false;

    datapoint.cache = cache;
    datapoint.schema = schema;
    datapoint.templates = templates;

    let type;
    if (typeName && fieldName && schema.allTypes[typeName]) {
      type = schema.allTypes[typeName];
      datapoint._fieldIfAny = type.fields[datapoint._fieldName];
    }
    if (datapoint.getterIfAny) {
      datapoint.setupDependencyFields();
    }
    datapoint.invalidate();

    if (fieldName == 'owner') {
      datapoint._ownerId = false;
    } else if (type && type.protected) {
      datapoint._ownerId = false;
    } else if (type && type.fields['owner']) {
      datapoint._ownerId = false;
      const ownerDatapointId = type.fields['owner'].getDatapointId({ dbRowId, proxyKey });
      datapoint.ownerDatapoint = cache.getOrCreateDatapoint({ datapointId: ownerDatapointId });
      datapoint.ownerDatapoint.watch({
        callbackKey: datapointId,
        onvalid: ({ valueIfAny: value }) => {
          let ownerId;
          if (Array.isArray(value) && value.length == 1) value = value[0];
          if (value === 'id') ownerId = dbRowId;
          if (typeof value == 'number') ownerId = value;
          else if (typeof value == 'string' && ConvertIds.rowRegex.test(value)) {
            const { dbRowId: ownerDbRowId } = ConvertIds.decomposeId({ rowId: value });
            ownerId = ownerDbRowId;
          }
          datapoint.setOwnerId(ownerId);
        },
      });
    }
  }

  get isClient() {
    return this._isClient;
  }

  setIsClient(isClient) {
    this._isClient = isClient === undefined || isClient;
  }

  get valueIfAny() {
    return this._value;
  }

  get invalid() {
    return this._invalid || false;
  }

  get getterIfAny() {
    const field = this.fieldIfAny;
    return field && (!this.cache.isClient || this.isClient || field.isClient) ? field.get : undefined;
  }

  get datapointId() {
    return this._datapointId;
  }

  get datapointId() {
    return this._datapointId;
  }

  get rowId() {
    return this._rowId;
  }

  get rowId() {
    return this._rowId;
  }

  get typeName() {
    return this._typeName;
  }

  get dbRowId() {
    return this._dbRowId;
  }

  get fieldName() {
    return this._fieldName;
  }

  get value() {
    const datapoint = this;

    if (!datapoint._invalid) return Promise.resolve(datapoint.valueIfAny);

    const ret = new Promise(resolve => {
      datapoint.watchingOneShotResolvers = datapoint.watchingOneShotResolvers || [];
      datapoint.watchingOneShotResolvers.push(resolve);
    }).then(theDatapoint => {
      return theDatapoint.value;
    });

    datapoint.cache.queueValidationJob();

    return ret;
  }

  commit({ updateIndex }) {
    const datapoint = this;

    if (datapoint.updateIndex == updateIndex) {
      delete datapoint.updated;
      delete datapoint.newValue;
    }
  }

  invalidate({ queueValidationJob = true } = {}) {
    const datapoint = this,
      { cache } = datapoint;

    if (datapoint._invalid) return datapoint.publicApi;

    datapoint._invalid = true;
    delete datapoint._value;
    cache.newlyInvalidDatapointIds.push(datapoint.datapointId);

    if (datapoint.dependentDatapointsById) {
      for (let dependentDatapoint of Object.values(datapoint.dependentDatapointsById)) {
        if (!dependentDatapoint.invalidDependencyDatapointCount++) {
          dependentDatapoint.invalidate({ queueValidationJob });
        }

        if (dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
          for (const dependency of dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
            dependentDatapoint.updateDependencies({
              dependencies: dependency.children,
            });
          }
        }
      }
    }

    datapoint.notifyListeners('oninvalid', datapoint);

    if (queueValidationJob) cache.queueValidationJob();
    return datapoint.publicApi;
  }

  validate({ value, evenIfValid } = {}) {
    const datapoint = this,
      { cache } = datapoint;

    if ((!evenIfValid && !datapoint._invalid) || datapoint.invalidDependencyDatapointCount) return;

    const getter = datapoint.getterIfAny;
    if (getter) {
      value = Datapoint.valueFromGetter({
        getter,
        dependencies: datapoint.dependencies,
      });
    }

    log(`Datapoint ${datapoint.datapointId} -> ${value}`);

    datapoint._value = clone(value);

    delete datapoint._invalid;
    cache.newlyValidDatapoints.push(datapoint.datapointId);

    if (datapoint.dependentDatapointsById) {
      for (let dependentDatapoint of Object.values(datapoint.dependentDatapointsById)) {
        if (dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
          for (const dependency of dependentDatapoint.dependenciesByDatapointId[datapoint.datapointId]) {
            dependentDatapoint.updateDependencies({
              parentRowId: datapoint.valueAsDecomposedRowId,
              dependencies: dependency.children,
            });
          }
        }
        if (!--dependentDatapoint.invalidDependencyDatapointCount) {
          dependentDatapoint.validate();
        }
      }
    }

    datapoint.notifyListeners('onvalid_prioritized', datapoint);
    datapoint.notifyListeners('onvalid', datapoint);

    if (datapoint.watchingOneShotResolvers) {
      const watchingOneShotResolvers = datapoint.watchingOneShotResolvers;
      delete datapoint.watchingOneShotResolvers;
      for (let resolve of watchingOneShotResolvers) {
        resolve(datapoint);
      }
    }

    datapoint.deleteIfUnwatched();
  }

  get ownerId() {
    return this._ownerId;
  }

  setOwnerId(ownerId) {
    const datapoint = this,
      { _unauthorizedUpdateArguments: updateArguments } = datapoint;

    datapoint._ownerId = ownerId;
    if (updateArguments) {
      delete datapoint._unauthorizedUpdateArguments;
      datapoint.updateValue(updateArguments);
    }
  }

  updateValue({ newValue, userId }) {
    const datapoint = this,
      { cache, ownerId } = datapoint;

    if (ownerId !== undefined) {
      if (ownerId === false || ownerId !== userId) {
        datapoint._unauthorizedUpdateArguments = { newValue: clone(newValue), userId };
        return;
      }
    }
    delete datapoint._unauthorizedUpdateArguments;

    datapoint.newValue = clone(newValue);
    datapoint.updated = true;
    datapoint.updateIndex = (datapoint.updateIndex || 0) + 1;

    cache.newlyUpdatedDatapointIds.push(datapoint.datapointId);

    cache.queueUpdateJob();

    return datapoint.publicApi;
  }

  get fieldIfAny() {
    const datapoint = this;

    if (datapoint._fieldIfAny) return datapoint._fieldIfAny;
    try {
      datapoint._fieldIfAny = datapoint.schema.fieldForDatapoint(datapoint);
    } catch (err) {}
    if (datapoint._fieldIfAny) return datapoint._fieldIfAny;

    return (datapoint._fieldIfAny = datapoint.virtualFieldIfAny);
  }

  get virtualFieldIfAny() {
    const datapoint = this,
      { templates, cache, schema } = datapoint;

    let match = /^dom(\w*)$/.exec(datapoint.fieldName);
    if (templates && match) {
      const variant = ChangeCase.camelCase(match[1]);
      return datapoint.makeVirtualField({
        isId: false,
        isMultiple: false,
        names: {
          template: {
            datapointId: templates.getTemplateReferencingDatapoint({
              variant,
              classFilter: datapoint.typeName,
              ownerOnly: false,
            }).datapointId,
            dom: {},
          },
        },
        getterFunction: args => {
          return args.template.dom;
        },
      });
    }
    match = /^template(\w*)$/.exec(datapoint.fieldName);
    if (templates && match) {
      const variant = ChangeCase.camelCase(match[1]);

      const type = schema.allTypes[datapoint.typeName],
        ownerField = type ? type.fields['owner'] : undefined;
      if (!ownerField) {
        return datapoint.makeVirtualField({
          isId: true,
          isMultiple: false,
          names: {
            template: {
              datapointId: templates.getTemplateReferencingDatapoint({
                variant,
                classFilter: datapoint.typeName,
                ownerOnly: false,
              }).datapointId,
            },
          },
          getterFunction: args => {
            return { public: args.template };
          },
        });
      }
      return datapoint.makeVirtualField({
        isId: true,
        isMultiple: false,
        names: {
          public: {
            datapointId: templates.getTemplateReferencingDatapoint({
              variant,
              classFilter: datapoint.typeName,
              ownerOnly: false,
            }).datapointId,
          },
          private: {
            datapointId: templates.getTemplateReferencingDatapoint({
              variant,
              classFilter: datapoint.typeName,
              ownerOnly: true,
            }).datapointId,
          },
          owner: {
            datapointId: ownerField.getDatapointId({ dbRowId: datapoint.dbRowId, proxyKey: datapoint.proxyKey }),
          },
        },
        getterFunction: args => {
          if (args.owner) {
            let ownerId;
            if (args.owner == 'id') {
              ownerId = datapoint.dbRowId;
            } else {
              const ownerRowId = Array.isArray(args.owner) && args.owner.length == 1 ? args.owner[0] : undefined,
                ownerInfo = ownerRowId ? ConvertIds.decomposeId({ rowId: ownerRowId }) : {};
              ownerId = ownerInfo.dbRowId || 0;
            }
            return {
              public: args.public,
              private: args.private,
              ownerId: ownerId,
            };
          }
          return {
            public: args.public,
          };
        },
      });
    }
  }

  setVirtualField({ getterFunction, names = {}, isId, isMultiple }) {
    this._fieldIfAny = this.makeVirtualField(arguments[0]);
  }

  makeVirtualField({ getterFunction, names = {}, isId, isMultiple }) {
    const datapoint = this,
      field = {
        isClient: true, // force this field to evaluate locally
        isId,
        isMultiple,
        name: datapoint.fieldName,
        getDatapointId: ({ dbRowId, proxyKey }) =>
          ConvertIds.recomposeId({
            typeName: datapoint.typeName,
            dbRowId,
            proxyKey,
            fieldName: datapoint.fieldName,
          }),
      };
    if (getterFunction) {
      field.get = new CodeSnippet({
        func: getterFunction,
        names,
        ignoreNames: { datapointId: true },
      });
    }
    return field;
  }

  get valueAsRowId() {
    const datapoint = this;

    const field = datapoint.fieldIfAny,
      value = datapoint.valueIfAny;
    if (!field || !field.isId || field.isMultiple || datapoint._invalid || !Array.isArray(value) || value.length != 1)
      return;

    return value[0];
  }

  get valueAsDecomposedRowId() {
    const rowId = this.valueAsRowId;
    if (!rowId) return;
    try {
      return ConvertIds.decomposeId({
        rowId,
      });
    } catch (err) {
      console.log(err);
    }
  }

  setupDependencyFields() {
    const datapoint = this;

    const field = datapoint.fieldIfAny;
    Object.assign(datapoint, {
      dependenciesByDatapointId: {},
      dependencyDatapointCountsById: {},
      invalidDependencyDatapointCount: 0,
      dependencies: !field
        ? {}
        : (function dependencyTreeFromNames(names) {
            return mapValues(names, (subNames, name) => {
              if (name == 'datapointId') return undefined;
              const ret = {};
              if (subNames.datapointId && typeof subNames.datapointId == 'string') {
                ret.datapointId = subNames.datapointId;
              }
              const children = dependencyTreeFromNames(subNames);
              delete children.datapointId;
              if (Object.keys(children).length) ret.children = children;
              return ret;
            });
          })(field.get.names),
    });

    datapoint.updateDependencies({
      parentRowId: datapoint,
      dependencies: datapoint.dependencies,
    });
  }

  updateDependencies({ parentRowId, dependencies }) {
    const datapoint = this;

    if (!dependencies) return;

    const parentType = parentRowId ? datapoint.schema.allTypes[parentRowId.typeName] : undefined;

    for (const [name, dependency] of Object.entries(dependencies)) {
      datapoint.updateDependency({
        name,
        dependency,
        parentRowId,
        parentType,
      });
    }
  }

  updateDependency({ name, dependency, parentRowId, parentType }) {
    const datapoint = this,
      { cache } = datapoint;

    let dependencyDatapoint;
    if (dependency.datapointId) {
      dependencyDatapoint = cache.getOrCreateDatapoint({
        datapointId: dependency.datapointId,
      }).__private;
    } else {
      const dependencyField = parentType ? parentType.fields[name] : undefined;
      if (dependencyField) {
        dependencyDatapoint = cache.getOrCreateDatapoint({
          datapointId: dependencyField.getDatapointId(parentRowId),
        }).__private;
      }
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
        if (oldDependencyDatapoint._invalid) datapoint.invalidDependencyDatapointCount--;
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
      if (dependencyDatapoint._invalid) datapoint.invalidDependencyDatapointCount++;
    }

    if (dependency.children && dependencyDatapoint) {
      datapoint.updateDependencies({
        parentRowId: dependencyDatapoint.valueAsDecomposedRowId,
        dependencies: dependency.children,
      });
    }
  }

  lastListenerRemoved() {
    this.deleteIfUnwatched();
  }

  deleteIfUnwatched() {
    const datapoint = this;

    if (
      (datapoint.listeners && datapoint.listeners.length) ||
      datapoint.watchingOneShotResolvers ||
      (datapoint.dependentDatapointsById && Object.keys(datapoint.dependentDatapointsById).length)
    ) {
      return;
    }

    datapoint.forget();
  }

  forget() {
    log(`forgetting datapoint ${this.datapointId}`);
    const datapoint = this,
      { cache, datapointId } = datapoint;

    if (datapoint.ownerDatapoint) {
      datapoint.ownerDatapoint.stopWatching({
        callbackKey: datapointId,
      });
    }

    if (datapoint.dependenciesByDatapointId) {
      for (const dependencyDatapointId of Object.keys(datapoint.dependenciesByDatapointId)) {
        const dependencyDatapoint = cache.getExistingDatapoint({
          datapointId: dependencyDatapointId,
        }).__private;
        delete dependencyDatapoint.dependentDatapointsById[datapoint.datapointId];
        if (!Object.keys(dependencyDatapoint.dependentDatapointsById).length) {
          delete dependencyDatapoint.dependentDatapointsById;
          dependencyDatapoint.deleteIfUnwatched();
        }
      }
    }

    delete datapoint.dependenciesByDatapointId;
    delete datapoint.dependencyDatapointCountsById;
    delete datapoint.invalidDependencyDatapointCount;
    delete datapoint.dependencies;

    cache.forgetDatapoint(datapoint);
  }

  static valueFromGetter({ getter, dependencies }) {
    const dependencyValues = {};

    if (dependencies) {
      (function addDependencyValues(dependencies, to) {
        for (let [name, dependency] of Object.entries(dependencies)) {
          if (dependency.children) {
            to[name] = {};
            addDependencyValues(dependency.children, to[name]);
          } else if (dependency.datapoint && !dependency.datapoint._invalid) {
            to[name] = dependency.datapoint.valueIfAny;
          }
        }
      })(dependencies, dependencyValues);
    }

    return getter.evaluate({ valuesByName: dependencyValues });
  }
}

makeClassWatchable(Datapoint);

// API is the public facing class
module.exports = PublicApi({
  fromClass: Datapoint,
  hasExposedBackDoor: true, // note that the __private backdoor is used by this class, leave this as true
});
