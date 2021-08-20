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
      'embeddedDatapointId',

      'isId',
      'isMultiple',

      'invalidate',
      'validate',
      'validateIfWatched',
      'valueIfAny',
      'value',
      'setValue',
      'fireEvent',

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
      isExistenceFieldPlaceholder = datapointInfo.fieldName == '?';

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
      cachedValue: isExistenceFieldPlaceholder ? true : undefined,
      autovalidates: false,
      isEvent: false,
      autovalidatesForListener: false,
    });

    log('dp', () => `DP>C> Created datapoint ${datapointId}`);

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

    datapoint.validateIfWatched();
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
  get embeddedDatapointId() {
    return this.datapointInfo.embeddedDatapointId;
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
    const datapoint = this;
    switch (datapoint.state) {
      case 'valid':
        datapoint._setState('invalid');
        break;
      case 'invalid':
      case 'uninitialized':
        datapoint.rerunGetter = true;
    }
    datapoint.validateIfWatched();
  }

  validateIfWatched() {
    const datapoint = this,
      { isEvent, waitingEventResolvers, autovalidates, autovalidatesForListener } = datapoint;
    if (
      !isEvent &&
      ((waitingEventResolvers && waitingEventResolvers.length) || autovalidates || autovalidatesForListener)
    ) {
      datapoint.validate();
    }
  }

  // refresh the cachedValue using the getter
  validate({ eventContext } = {}) {
    const datapoint = this;
    switch (datapoint.state) {
      case 'invalid':
      case 'uninitialized':
        datapoint._value(eventContext);
        break;
      case 'valid':
        break;
    }
  }

  _setState(state) {
    const datapoint = this,
      { state: stateWas, cache } = datapoint;
    if (stateWas == state) return;
    datapoint.state = state;
    log('dp', () => `DP>S> Datapoint ${datapoint.datapointId} is now ${state} (was ${stateWas})`);
    switch (state) {
      case 'valid':
        datapoint.notifyListeners('onvalid', datapoint);
        cache.notifyListeners('onvalid', datapoint);
        datapoint.notifyDependentsOfMoveToValidState();
        break;
      case 'invalid':
        datapoint.notifyDependentsOfMoveToInvalidState();
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

    log('dp', () => `DP>V> Datapoint ${datapoint.datapointId} -> ${JSON.stringify(value)}`);

    datapoint._setState('valid');

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
    return this._value();
  }
  _value(eventContext) {
    const datapoint = this;
    //console.log(datapoint.datapointId, datapoint.state);
    switch (datapoint.state) {
      case 'valid':
        return Promise.resolve(datapoint.valueIfAny);
      case 'invalid':
      case 'uninitialized':
        if (datapoint.isEvent) {
          return datapoint.fireEvent(eventContext);
        } else {
          return datapoint._valueFromGetter();
        }
    }
  }

  // gets the _actual_ value of the datapoints via the getter method
  fireEvent(eventContext) {
    const datapoint = this,
      { getter, cache, rowId, isEvent } = datapoint,
      { rowChangeTrackers } = cache,
      waitingEventResolvers = datapoint.waitingEventResolvers || (datapoint.waitingEventResolvers = []);

    if (!isEvent) return;

    if (waitingEventResolvers.length) {
      return new Promise(resolve => {
        waitingEventResolvers.push(resolve);
        log(
          'dp.event',
          `Queueing fire for event ${datapoint.datapointId} (${waitingEventResolvers.length} remaining events to fire)`
        );
        datapoint.undeleteIfWatched();
      });
    }

    if (!getter || typeof getter != 'object' || !getter.fn) {
      // TODO codesnippet
      // if the datapoint has no getter method, then the cached value is correct by default
      log('err.dp', `DP>!> Datapoint ${datapoint.datapointId} has no associated getter`);

      datapoint._setCachedValue(datapoint.valueIfAny);
      datapoint.invalidate();

      return Promise.resolve(datapoint.valueIfAny);
    }

    return new Promise(resolve => {
      log('dp.event', `First fire for event ${datapoint.datapointId}`);
      waitingEventResolvers.push(resolve);

      datapoint.undeleteIfWatched();

      fire();

      function fire() {
        log('dp.event', `Firing event ${datapoint.datapointId}`);
        rowChangeTrackers
          .executeAfterValidatingDatapoints({
            thisArg: rowId,
            fn: getter.fn,
            eventContext,
            debug: `${datapoint.datapointId}(event)`,
          })
          .then(({ result, usesDatapoints, referencesDatapoints }) => {
            log('dp.event', `Fired event ${datapoint.datapointId}`);
            datapoint.setDependenciesOfType('getter', usesDatapoints);
            datapoint.setDependenciesOfType('~getter', referencesDatapoints);

            if (result && typeof result == 'object' && result.then) {
              Promise.resolve(result).then(dealWithValue);
            } else dealWithValue(result);

            function dealWithValue(value) {
              const resolve = waitingEventResolvers.shift();

              log(
                'dp.event',
                `Fired event ${datapoint.datapointId} -> ${value} (${
                  waitingEventResolvers.length
                } remaining events to fire)`
              );

              datapoint._setCachedValue(value);
              datapoint.invalidate();

              datapoint.deleteIfUnwatched();

              if (resolve) resolve(value);

              if (waitingEventResolvers.length) fire();
            }
          });
      }
    });
  }

  // gets the _actual_ value of the datapoints via the getter method
  _valueFromGetter() {
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
      log('err.dp', `DP>!> Datapoint ${datapoint.datapointId} has no associated getter`);
      datapoint._setCachedValue(datapoint.valueIfAny);

      return Promise.resolve(datapoint.valueIfAny);
    }

    return new Promise(resolve => {
      const getterOneShotResolvers = (datapoint.getterOneShotResolvers = [resolve]);
      datapoint.undeleteIfWatched();

      runGetter();

      function runGetter() {
        datapoint.rerunGetter = false;
        rowChangeTrackers
          .executeAfterValidatingDatapoints({ thisArg: rowId, fn: getter.fn, debug: `${datapoint.datapointId}(get)` })
          .then(({ result, usesDatapoints, referencesDatapoints }) => {
            datapoint.setDependenciesOfType('getter', usesDatapoints);
            datapoint.setDependenciesOfType('~getter', referencesDatapoints);
            if (datapoint.rerunGetter) return runGetter();

            if (result && typeof result == 'object' && result.then) {
              Promise.resolve(result).then(dealWithValue);
            } else dealWithValue(result);
            function dealWithValue(value) {
              datapoint._setCachedValue(value);

              datapoint.getterOneShotResolvers = undefined;
              datapoint.deleteIfUnwatched();

              for (const resolve of getterOneShotResolvers) {
                resolve(value);
              }
            }
          });
      }
    });
  }

  // sets the value by invoking the setter method if any
  setValue(newValue) {
    const datapoint = this,
      { setter, valueIfAny, cache, rowId, valid, isEvent } = datapoint;
    if (isEvent) return datapoint.fireEvent(newValue);

    const { rowChangeTrackers } = cache,
      changed = !valid || !isEqual(valueIfAny, newValue, { exact: true });

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
        .executeAfterValidatingDatapoints(
          { thisArg: rowId, fn: setter.fn, debug: `${datapoint.datapointId}(set)` },
          newValue
        )
        .then(({ result, usesDatapoints, referencesDatapoints, commit }) => {
          datapoint.setDependenciesOfType('setter', usesDatapoints);
          datapoint.setDependenciesOfType('~setter', referencesDatapoints);

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

  listenersChanged() {
    const datapoint = this,
      { listeners } = datapoint;
    datapoint.autovalidatesForListener = Boolean(
      listeners && listeners.find(listener => listener.onvalid || listener.onchange)
    );
  }

  firstListenerAdded() {
    this.undeleteIfWatched();
    this.validate();
  }

  undeleteIfWatched() {
    const datapoint = this,
      { cache, listeners, waitingEventResolvers, getterOneShotResolvers, dependentCount } = datapoint;
    if (
      !dependentCount &&
      !(listeners && listeners.length) &&
      !(getterOneShotResolvers && getterOneShotResolvers.length) &&
      !(waitingEventResolvers && waitingEventResolvers.length)
    )
      return;

    cache.unforgetDatapoint(datapoint.datapointId);
  }

  deleteIfUnwatched() {
    const datapoint = this,
      { cache, listeners, waitingEventResolvers, getterOneShotResolvers, dependentCount } = datapoint;
    if (
      dependentCount ||
      (listeners && listeners.length) ||
      (getterOneShotResolvers && getterOneShotResolvers.length) ||
      (waitingEventResolvers && waitingEventResolvers.length)
    )
      return;

    cache.forgetDatapoint(datapoint.datapointId);
  }

  get deletionCallbacks() {
    return this._deletionCallbacks || (this._deletionCallbacks = []);
  }

  ondeletion() {
    const datapoint = this,
      { _deletionCallbacks } = datapoint;

    log('dp', `DP>F> Forgetting datapoint ${datapoint.datapointId}`);

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
