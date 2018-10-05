const { fieldNameRegex, rowRegex, recomposeId } = require('../../datapoints/convert-ids');
const log = require('../../general/log');

module.exports = addDependencyMethods;

let nextStateIndex = 1;
function addDependencyMethods(watchableClass) {
  Object.assign(watchableClass.prototype, {
    refreshDependencies: function(names, type) {
      const datapoint = this,
        { rowId } = datapoint;
      const state =
        datapoint[`${type}State`] ||
        (datapoint[`${type}State`] = {
          children: {},
        });
      datapoint._refreshDependencies(names, rowId, state, 'root');
    },

    clearDependencies() {
      const datapoint = this,
        { rowId } = datapoint,
        state = datapoint[`${type}State`];
      if (!state) return;
      datapoint._refreshDependencies(undefined, rowId, state, 'root');
    },

    _refreshDependencies: function(names, parentRowId, parentState, myFieldName) {
      const datapoint = this,
        { cache } = datapoint;
      let state = parentState.children['.state'];
      if (!state) {
        state = parentState.children['.state'] = {
          index: nextStateIndex++,
          fieldName: myFieldName,
          parentState,
          fields: {},
          children: {},
          sourceDatapointId: undefined,
        };
      }

      if (!names || typeof names != 'object') names = {};

      const sourceDatapointId = names['.datapointId'];
      if (sourceDatapointId) {
        const sourceDatapoint = cache.getOrCreateDatapoint(sourceDatapointId);
        if (sourceDatapointId != state.sourceDatapointId) {
          if (state.sourceDatapointId) {
            datapoint._removeDependency({
              dependencyDatapoint: cache.getOrCreateDatapoint(state.sourceDatapointId),
              type: 'source',
              state,
            });
          }
          if ((state.sourceDatapointId = sourceDatapointId)) {
            datapoint._addDependency({
              dependencyDatapoint: sourceDatapoint,
              type: 'source',
              state,
            });
          }
        }
        parentRowId = sourceDatapoint._valueAsRowId;
      }

      for (const [fieldName, children] of Object.entries(names)) {
        if (!fieldNameRegex.test(fieldName)) continue;

        if (!((children && children['.datapointId']) || state.fields[fieldName])) {
          state.fields[fieldName] = true;
          const fieldDatapointId = recomposeId({ rowId: parentRowId, fieldName }).datapointId,
            fieldDatapoint = cache.getOrCreateDatapoint(fieldDatapointId);
          datapoint._addDependency({ dependencyDatapoint: fieldDatapoint, type: 'field', state });
        }

        if (state.children[fieldName] || (children && typeof children == 'object')) {
          datapoint._refreshDependencies(children, parentRowId, state, fieldName);
        }
      }

      for (const fieldName of Object.keys(state.fields)) {
        if (fieldName in names) continue;

        delete state.fields[fieldName];
        const fieldDatapointId = recomposeId({ rowId: parentRowId, fieldName }).datapointId,
          fieldDatapoint = cache.getOrCreateDatapoint(fieldDatapointId);
        datapoint._removeDependency({ dependencyDatapoint: fieldDatapoint, type: 'field', state });

        if (state.children[fieldName]) {
          datapoint._refreshDependencies(undefined, parentRowId, state, fieldName);
          delete state.children[fieldName];
        }
      }
    },

    _addDependency({ dependencyDatapoint, type, state }) {
      const dependentDatapoint = this,
        { datapointId: dependencyDatapointId, valid: dependencyValid } = dependencyDatapoint,
        { datapointId: dependentDatapointId } = dependentDatapoint,
        dependencyDependents = dependencyDatapoint.dependents || (dependencyDatapoint.dependents = {}),
        dependentDependencies = dependentDatapoint.dependencies || (dependentDatapoint.dependencies = {});
      let dependentInfo = dependencyDependents[dependentDatapointId],
        dependencyInfo = dependentDependencies[dependencyDatapointId],
        stateKey = `${type}:${state.index}`;

      if (!dependentInfo) {
        dependentInfo = dependencyDependents[dependentDatapointId] = {};
        dependencyInfo = dependentDependencies[dependencyDatapointId] = {};

        dependentDatapoint.dependencyCount = (dependentDatapoint.dependencyCount || 0) + 1;
        if (!dependencyDatapoint.dependentCount) {
          dependencyDatapoint.dependentCount = 1;
          dependencyDatapoint.undeleteIfWatched();
        } else {
          dependencyDatapoint.dependentCount++;
        }

        if (!dependencyValid) {
          if (!dependentDatapoint.invalidDependencyCount) {
            dependentDatapoint.invalidDependencyCount = 1;
            dependentDatapoint.invalidate();
          } else dependentDatapoint.invalidDependencyCount++;
        }
      } else if (dependentInfo[stateKey]) return;

      dependentInfo[stateKey] = dependencyInfo[stateKey] = { type, state };
    },

    _removeDependency({ dependencyDatapoint, type, state }) {
      const dependentDatapoint = this,
        { datapointId: dependencyDatapointId, valid: dependencyValid } = dependencyDatapoint,
        { datapointId: dependentDatapointId } = dependentDatapoint,
        dependencyDependents = dependencyDatapoint.dependents || (dependencyDatapoint.dependents = {}),
        dependentDependencies = dependentDatapoint.dependencies || (dependentDatapoint.dependencies = {}),
        dependentInfo = dependencyDependents[dependentDatapointId],
        dependencyInfo = dependentDependencies[dependencyDatapointId],
        stateKey = `${type}:${state.index}`;

      if (!(dependentInfo && dependentInfo[stateKey])) {
        log(
          'err.dp',
          `Expected to find a that ${dependentDatapointId}[${stateKey}] was dependent on ${dependencyDatapointId}[${stateKey}]. The system will by in an unstable state from here on out`
        );
        return;
      }

      delete dependentInfo[stateKey];
      delete dependencyInfo[stateKey];

      if (!Object.keys(dependentInfo).length) {
        delete dependencyDependents[dependentDatapointId];
        delete dependentDependencies[dependencyDatapointId];

        dependentDatapoint.dependencyCount--;
        if (!--dependencyDatapoint.dependentCount) {
          dependencyDatapoint.deleteIfUnwatched();
        }

        if (!dependencyValid && !--dependentDatapoint.invalidDependencyCount) {
          dependentDatapoint.validate();
        }
      }
    },

    get _valueAsRowId() {
      const datapoint = this,
        { valueIfAny: value } = datapoint;
      if (!value) return;
      if (typeof value == 'string' && rowRegex.test(value)) {
        return value;
      }
      if (Array.isArray(value) && value.length == 1 && typeof value[0] == 'string' && rowRegex.test(value[0])) {
        return value[0];
      }
    },

    notifyDependentsOfMoveToInvalidState: function() {
      const datapoint = this,
        { dependents, cache } = datapoint;

      if (!dependents) return;
      for (const dependentDatapointId of Object.keys(dependents)) {
        const dependentDatapoint = cache.getOrCreateDatapoint(dependentDatapointId);

        if (!dependentDatapoint.invalidDependencyCount) {
          dependentDatapoint.invalidDependencyCount = 1;
          dependentDatapoint.invalidate();
        } else dependentDatapoint.invalidDependencyCount++;
      }
    },
    notifyDependentsOfMoveToValidState: function() {
      const datapoint = this,
        { dependents, cache } = datapoint;

      if (!dependents) return;
      for (const dependentDatapointId of Object.keys(dependents)) {
        const dependentDatapoint = cache.getOrCreateDatapoint(dependentDatapointId);

        if (!--dependentDatapoint.invalidDependencyCount) {
          dependentDatapoint.validate();
        }
      }
    },
    notifyDependentsOfChangeOfValue: function() {
      const datapoint = this,
        { dependents, cache } = datapoint;

      if (!dependents) return;
      for (const dependentDatapointId of Object.keys(dependents)) {
        const dependentDatapoint = cache.getOrCreateDatapoint(dependentDatapointId);

        if (!dependentDatapoint.invalidDependencyCount) {
          dependentDatapoint.validate();
        }
      }
    },
  });
}
