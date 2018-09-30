const requirePath = path => require(`../../${path}`);
const { decomposeId } = requirePath('datapoints/convert-ids');
const makeClassWatchable = requirePath('general/watchable');
const isEqual = requirePath('general/is-equal');
const findGetterSetter = requirePath('datapoints/datapoint/getters-setters/all.js');
const addDependencyMethods = require('./dependency-methods');

class Datapoint {
  static publicMethods() {
    return [
      'typeName',
      'type',
      'dbRowId',
      'fieldName',
      'proxyKey',
      'rowId',
      'datapointId',

      'invalidate',
      'validate',
      'valueIfAny',
      'value',
      'setValue',

      'valid',

      'deleteIfUnwatched',
    ];
  }

  constructor({ cache, schema, datapointDbConnection, templates, datapointId }) {
    const datapoint = this,
      datapointInfo = decomposeId({ datapointId }),
      isAnyFieldPlaceholder = datapointInfo.fieldName == '*';

    Object.assign(datapoint, {
      cache,
      datapointInfo,
      state: 'uninitialized',
      cachedValue: isAnyFieldPlaceholder ? true : undefined,
    });

    const { getter, setter } = findGetterSetter({ datapoint, cache, schema, datapointDbConnection, templates });
    if (getter) {
      datapoint.getter = getter;
      if (getter.names) refreshDependencies(getter.names);
    }
    if (setter) {
      datapoint.setter = setter;
      if (setter.names) refreshDependencies(setter.names);
    }

    datapoint.deleteIfUnwatched();
  }

  get typeName() {
    return this.datapointInfo.typeName;
  }
  get type() {
    return this.datapointInfo.type;
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

  get valid() {
    return this.state == 'valid';
  }

  // marks the datapoint as having a possibly incorrect cachedValue
  // i.e. the value that would be obtained from the getter may be different to the cachedValue
  invalidate() {
    const datapoint = this;
    switch (datapoint.state) {
      case 'valid':
        datapoint.state = 'invalid';
        datapoint.notifyDependentsOfMoveToInvalidState();
        break;
      case 'invalid':
      case 'uninitialized':
        datapoint.rerunGetter = true;
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
      { valueIfAny, state } = datapoint;

    datapoint.cachedValue = value;

    if (!isEqual(valueIfAny, newValue, { exact: true })) {
      datapoint.notifyDependentsOfChangeOfValue();
      datapoint.notifyListeners('onchange', datapoint);
    }

    switch (state) {
      case 'invalid':
      case 'uninitialized':
        datapoint.state = 'valid';
        datapoint.notifyDependentsOfMoveToValidState();
        break;
    }

    if (state == 'uninitialized') {
      datapoint.notifyListeners('oninit', datapoint);
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
        return datapoint._valueFromGetter.then(value => {
          datapoint._setCachedValue(value);
          return datapoint.valueIfAny;
        });
    }
  }

  // gets the _actual_ value of the datapoints via the getter method
  get _valueFromGetter() {
    const datapoint = this,
      { getter, getterOneShotResolvers } = datapoint;

    if (getterOneShotResolvers) {
      return new Promise(resolve => {
        getterOneShotResolvers.push(() => {
          resolve(datapoint.valueIfAny);
        });
        datapoint.undeleteIfWatched();
      });
    }

    if (typeof getter != 'function') {
      // if the datapoint has no getter method, then the cached value is correct by default
      return Promise.resolve(datapoint.valueIfAny);
    }

    return new Promise(resolve => {
      const getterOneShotResolvers = (datapoint.getterOneShotResolvers = [resolve]);
      datapoint.undeleteIfWatched();

      runGetter();

      function runGetter() {
        datapoint.rerunGetter = false;
        Promise.resolve(getter.call(datapoint)).then(value => {
          if (datapoint.rerunGetter) runGetter();
          else {
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
      { setter, valueIfAny } = datapoint,
      changed = !isEqual(valueIfAny, newValue, { exact: true });

    if (typeof setter != 'function') {
      // if the datapoint has no setter method, then just set the cached value directly
      datapoint._setCachedValue(newValue);
    } else {
      // to set the value if there is a setter method, the datapoint is marked as invalid,
      // then the setter method is invoked, then as it returns (either sync or async)
      // the datapoint is revalidated using the value returned from the setter
      // This value should be the same as would be obtained from the getter.
      datapoint.invalidate();
      Promise.resolve(setter.call(datapoint, newValue)).then(value => {
        datapoint._setCachedValue(value);
      });
    }
  }

  lastListenerRemoved() {
    this.deleteIfUnwatched();
  }

  firstListenerAdded() {
    this.undeleteIfWatched();
  }

  undeleteIfWatched() {
    const datapoint = this,
      { cache, listeners, getterOneShotResolvers, dependentCount } = datapoint;
    if (!dependentCount && !listeners.length && !getterOneShotResolvers.length) return;

    cache.unforgetDatapoint(datapoint.datapointId);
  }

  deleteIfUnwatched() {
    const datapoint = this,
      { cache, listeners, getterOneShotResolvers, dependentCount } = datapoint;
    if (dependentCount || listeners.length || getterOneShotResolvers.length) return;

    cache.forgetDatapoint(datapoint.datapointId);
  }
}

addDependencyMethods(Datapoint);

makeClassWatchable(Datapoint);

// API is the public facing class
module.exports = PublicApi({
  fromClass: Datapoint,
  hasExposedBackDoor: true, // note that the __private backdoor is used by this class, leave this as true
});
