const { decomposeId } = require('../../datapoints/convert-ids');
const makeClassWatchable = require('../../general/watchable');
const isEqual = require('../../general/is-equal');
const addDependencyMethods = require('./dependency-methods');
const PublicApi = require('../../general/public-api');
const log = require('../../general/log');

class DatapointProxy {}
class Datapoint {
  static publicMethods() {
    return [
      'typeName',
      'type',
      'field',
      'dbRowId',
      'fieldName',
      'proxyKey',
      'rowId',
      'datapointId',

      'isId',
      'isMultiple',

      'invalidate',
      'validate',
      'valueIfAny',
      'value',
      'setValue',

      'initialized',
      'valid',

      'deleteIfUnwatched',
      'undeleteIfWatched',

      'watch',
      'stopWatching',
      'ondeletion',

      'ondeletion',
      'deletionCallbacks',
    ];
  }

  constructor({ cache, schema, datapointDbConnection, templates, stateVar, findGetterSetter, datapointId }) {
    const datapoint = this,
      datapointInfo = decomposeId({ datapointId }),
      isAnyFieldPlaceholder = datapointInfo.fieldName == '*';

    datapointInfo.type = schema.allTypes[datapointInfo.typeName];
    if (datapointInfo.type) {
      datapointInfo.field = datapointInfo.type.fields[datapointInfo.fieldName];
    }

    Object.assign(datapoint, {
      cache,
      datapointInfo,
      _isId: datapointInfo.field ? datapointInfo.field.isId : false,
      _isMultiple: datapointInfo.field ? datapointInfo.field.isMultiple : false,
      state: 'uninitialized',
      cachedValue: isAnyFieldPlaceholder ? true : undefined,
    });

    const { getter, setter } = findGetterSetter({
      datapoint,
      cache,
      schema,
      datapointDbConnection,
      templates,
      stateVar,
    });
    if (getter) {
      datapoint.getter = getter;
    }
    if (setter) {
      datapoint.setter = setter;
    }

    if (datapoint._isId && datapoint._isMultiple) {
      datapoint.cachedValue = [];
    }

    datapoint.deleteIfUnwatched();
  }

  get typeName() {
    return this.datapointInfo.typeName;
  }
  get type() {
    return this.datapointInfo.type;
  }
  get field() {
    return this.datapointInfo.field;
  }
  get dbRowId() {
    return this.datapointInfo.dbRowId;
  }
  get proxyKey() {
    return this.datapointInfo.proxyKey;
  }
  get fieldName() {
    return this.datapointInfo.fieldName;
  }
  get rowId() {
    return this.datapointInfo.rowId;
  }
  get datapointId() {
    return this.datapointInfo.datapointId;
  }

  get isId() {
    return this._isId;
  }
  get isMultiple() {
    return this._isMultiple;
  }

  get valid() {
    return this.state == 'valid';
  }

  get initialized() {
    return this.state != 'uninitialized';
  }

  // marks the datapoint as having a possibly incorrect cachedValue
  // i.e. the value that would be obtained from the getter may be different to the cachedValue
  invalidate() {
    const datapoint = this,
      { listeners, getterOneShotResolvers } = datapoint;
    switch (datapoint.state) {
      case 'valid':
        datapoint.state = 'invalid';
        datapoint.notifyDependentsOfMoveToInvalidState();
        break;
      case 'invalid':
      case 'uninitialized':
        datapoint.rerunGetter = true;
    }

    if ((listeners && listeners.length) || (getterOneShotResolvers && getterOneShotResolvers.length)) {
      datapoint.validate();
    }
  }

  // refresh the cachedValue using the getter
  validate() {
    const datapoint = this;
    switch (datapoint.state) {
      case 'invalid':
      case 'uninitialized':
        datapoint.value;
        break;
    }
  }

  // sets the cached value to a trusted value, as would be obtained by the getter
  _setCachedValue(value) {
    const datapoint = this,
      { valueIfAny, state, cache } = datapoint;

    if (datapoint.isId) {
      // TODO id regex
      if (datapoint.isMultiple) {
        if (!Array.isArray(value)) value = [];
      }
    }

    datapoint.cachedValue = value;

    log('dp', () => `Datapoint ${datapoint.datapointId} -> ${JSON.stringify(value)}`);

    switch (state) {
      case 'invalid':
      case 'uninitialized':
        datapoint.state = 'valid';
        datapoint.notifyListeners('onvalid', datapoint);
        cache.notifyListeners('onvalid', datapoint);
        datapoint.notifyDependentsOfMoveToValidState();
        break;
    }

    if (!isEqual(valueIfAny, value, { exact: true })) {
      datapoint.notifyDependentsOfChangeOfValue();
      datapoint.notifyListeners('onchange', datapoint);
      cache.notifyListeners('onchange', datapoint);
    }

    if (state == 'uninitialized') {
      datapoint.notifyListeners('oninit', datapoint);
      cache.notifyListeners('oninit', datapoint);
    }
  }

  // return the cached value
  get valueIfAny() {
    return this.cachedValue;
  }

  // async method that returns the cached value if valid, otherwise get the correct value via the getter
  get value() {
    const datapoint = this;
    switch (datapoint.state) {
      case 'valid':
        return Promise.resolve(datapoint.valueIfAny);
      case 'invalid':
      case 'uninitialized':
        return datapoint._valueFromGetter;
    }
  }

  // gets the _actual_ value of the datapoints via the getter method
  get _valueFromGetter() {
    const datapoint = this,
      { getter, getterOneShotResolvers, cache, rowId } = datapoint,
      { rowChangeTrackers } = cache;

    if (getterOneShotResolvers) {
      return new Promise(resolve => {
        getterOneShotResolvers.push(resolve);
        datapoint.undeleteIfWatched();
      });
    }

    if (!getter || typeof getter != 'object' || !getter.fn) {
      // TODO codesnippet
      // if the datapoint has no getter method, then the cached value is correct by default
      log('err.dp', `Datapoint ${datapoint.datapointId} has no associated getter`);
      datapoint._setCachedValue(datapoint.valueIfAny);
      return Promise.resolve(datapoint.valueIfAny);
    }

    return new Promise(resolve => {
      const getterOneShotResolvers = (datapoint.getterOneShotResolvers = [resolve]);
      datapoint.undeleteIfWatched();

      runGetter();

      function runGetter() {
        datapoint.rerunGetter = false;
        rowChangeTrackers.executeAfterValidatingDatapoints(rowId, getter.fn).then(({ result, usesDatapoints }) => {
          datapoint.setDependenciesOfType('getter', usesDatapoints);
          if (datapoint.rerunGetter) return runGetter();

          Promise.resolve(result).then(value => {
            datapoint._setCachedValue(value);

            datapoint.getterOneShotResolvers = undefined;
            datapoint.deleteIfUnwatched();
            for (const resolve of getterOneShotResolvers) {
              resolve(value);
            }
          });
        });
      }
    });
  }

  // sets the value by invoking the setter method if any
  setValue(newValue) {
    const datapoint = this,
      { setter, valueIfAny } = datapoint,
      changed = !isEqual(valueIfAny, newValue, { exact: true });

    if (!changed) return;

    if (!setter || typeof setter != 'object' || !setter.fn) {
      // if the datapoint has no setter method, then just set the cached value directly
      datapoint._setCachedValue(newValue);
    } else {
      // to set the value if there is a setter method, the datapoint is marked as invalid,
      // then the setter method is invoked, then as it returns (either sync or async)
      // the datapoint is revalidated using the value returned from the setter
      // This value should be the same as would be obtained from the getter.
      datapoint.invalidate();

      rowChangeTrackers
        .executeAfterValidatingDatapoints(rowId, getter.fn, newValue)
        .then(({ result, usesDatapoints, commit }) => {
          datapoint.setDependenciesOfType('setter', usesDatapoints);

          if (commit) commit();

          Promise.resolve(result).then(value => {
            datapoint._setCachedValue(value);
          });
        });
    }
  }

  lastListenerRemoved() {
    this.deleteIfUnwatched();
  }

  firstListenerAdded() {
    this.undeleteIfWatched();
    this.validate();
  }

  undeleteIfWatched() {
    const datapoint = this,
      { cache, listeners, getterOneShotResolvers, dependentCount } = datapoint;
    if (
      !dependentCount &&
      !(listeners && listeners.length) &&
      !(getterOneShotResolvers && getterOneShotResolvers.length)
    )
      return;

    cache.unforgetDatapoint(datapoint.datapointId);
  }

  deleteIfUnwatched() {
    const datapoint = this,
      { cache, listeners, getterOneShotResolvers, dependentCount } = datapoint;
    if (dependentCount || (listeners && listeners.length) || (getterOneShotResolvers && getterOneShotResolvers.length))
      return;

    cache.forgetDatapoint(datapoint.datapointId);
  }

  get deletionCallbacks() {
    return this._deletionCallbacks || (this._deletionCallbacks = []);
  }

  ondeletion() {
    const datapoint = this,
      { _deletionCallbacks } = datapoint;
    if (_deletionCallbacks) {
      for (const callback of _deletionCallbacks) {
        callback(datapoint);
      }
      datapoint._deletionCallbacks = undefined;
    }
    datapoint.clearDependencies();
  }
}

addDependencyMethods(Datapoint);

makeClassWatchable(Datapoint);

// API is the public facing class
module.exports = PublicApi({
  fromClass: Datapoint,
  hasExposedBackDoor: true, // note that the __private backdoor is used by this class, leave this as true
});