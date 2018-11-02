const log = require('../../general/log');

module.exports = addDependencyMethods;

function addDependencyMethods(theClass) {
  Object.assign(theClass.prototype, {
    clearDependencies() {
      const datapoint = this,
        { dependenciesByType } = datapoint;
      if (!dependenciesByType) return;
      for (const type of Object.keys(dependenciesByType)) {
        this.setDependenciesOfType(type, {});
      }
    },

    dependenciesOfType(type) {
      const datapoint = this;
      const dependenciesByType = datapoint.dependenciesByType || (datapoint.dependenciesByType = {});
      return dependenciesByType[type] || (dependenciesByType[type] = {});
    },

    dependentsOfType(type) {
      const datapoint = this;
      const dependentsByType = datapoint.dependentsByType || (datapoint.dependentsByType = {});
      return dependentsByType[type] || (dependentsByType[type] = {});
    },

    setDependenciesOfType(type, newDependencies) {
      const datapoint = this,
        { cache } = datapoint,
        dependencies = datapoint.dependenciesOfType(type);

      let changed;
      for (const dependencyDatapointId of Object.keys(dependencies)) {
        if (!(newDependencies && newDependencies[dependencyDatapointId])) {
          const dependencyDatapoint = cache.getExistingDatapoint(dependencyDatapointId);
          if (dependencyDatapoint) {
            datapoint._removeDependency(dependencyDatapoint.__private, type);
          }
          changed = true;
        }
      }
      if (newDependencies) {
        for (const dependencyDatapointId of Object.keys(newDependencies)) {
          if (!dependencies[dependencyDatapointId]) {
            const dependencyDatapoint = cache.getOrCreateDatapoint(dependencyDatapointId).__private;
            datapoint._addDependency(dependencyDatapoint, type);
            changed = true;
          }
        }
      }
      if (changed) {
        datapoint.dependenciesByType[type] = newDependencies ? Object.assign({}, newDependencies) : {};
      }
    },

    _addDependency(dependencyDatapoint, type) {
      const dependentDatapoint = this,
        { datapointId: dependencyDatapointId, valid: dependencyValid } = dependencyDatapoint,
        { datapointId: dependentDatapointId } = dependentDatapoint,
        dependencyDependents = dependencyDatapoint.dependents || (dependencyDatapoint.dependents = {}),
        dependentDependencies = dependentDatapoint.dependencies || (dependentDatapoint.dependencies = {}),
        dependencyDependentInfo =
          dependencyDependents[dependentDatapointId] || (dependencyDependents[dependentDatapointId] = {}),
        dependentDependencyInfo =
          dependentDependencies[dependencyDatapointId] || (dependentDependencies[dependencyDatapointId] = {});

      if (!Object.keys(dependencyDependentInfo).length) {
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
      }

      dependentDependencyInfo[type] = dependencyDependentInfo[type] = type;
    },

    _removeDependency(dependencyDatapoint, type) {
      const dependentDatapoint = this,
        { datapointId: dependencyDatapointId, valid: dependencyValid } = dependencyDatapoint,
        { datapointId: dependentDatapointId } = dependentDatapoint,
        dependencyDependents = dependencyDatapoint.dependents || (dependencyDatapoint.dependents = {}),
        dependentDependencies = dependentDatapoint.dependencies || (dependentDatapoint.dependencies = {}),
        dependencyDependentInfo = dependencyDependents[dependentDatapointId],
        dependentDependencyInfo = dependentDependencies[dependencyDatapointId];

      if (!(dependencyDependentInfo && dependencyDependentInfo[type])) {
        log(
          'err.dp',
          `Expected to find a that ${dependentDatapointId}[${type}] was dependent on ${dependencyDatapointId}[${type}]. The system will by in an unstable state from here on out`
        );
        return;
      }

      delete dependencyDependentInfo[type];
      delete dependentDependencyInfo[type];

      if (Object.keys(dependencyDependentInfo).length) return;

      delete dependencyDependents[dependentDatapointId];
      delete dependentDependencies[dependencyDatapointId];

      dependentDatapoint.dependencyCount--;
      if (!--dependencyDatapoint.dependentCount) {
        dependencyDatapoint.deleteIfUnwatched();
      }

      if (!dependencyValid && !--dependentDatapoint.invalidDependencyCount) {
        dependentDatapoint.validate();
      }
    },

    notifyDependentsOfMoveToInvalidState: function() {
      const datapoint = this,
        { dependents, cache } = datapoint;

      if (!dependents) return;
      for (const dependentDatapointId of Object.keys(dependents)) {
        const dependentDatapoint = cache.getOrCreateDatapoint(dependentDatapointId).__private;

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
        const dependentDatapoint = cache.getOrCreateDatapoint(dependentDatapointId).__private;

        if (!--dependentDatapoint.invalidDependencyCount) {
          dependentDatapoint.validate(true);
        }
      }
    },
    notifyDependentsOfChangeOfValue: function() {
      const datapoint = this,
        { dependents, cache } = datapoint;

      if (!dependents) return;
      for (const dependentDatapointId of Object.keys(dependents)) {
        const dependentDatapoint = cache.getOrCreateDatapoint(dependentDatapointId).__private;

        if (!dependentDatapoint.invalidDependencyCount) {
          dependentDatapoint.validate(true);
        }
      }
    },
  });
}
