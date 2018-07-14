// cache-to-cache-connection
// © Will Smart 2018. Licence: MIT

// This is an intermediary between the datapoint-cache and the shared-state

const PublicApi = require('../general/public-api');

// other implied dependencies

//const Schema = require('../schema'); // via use of datapoint.fieldIfAny

//const Datapoint = require('../datapoint'); // via datapoints arg to functions
//    uses invalid, fieldIfAny, stopWatching, valueIfAny, invalidate, invalid, setVirtualField

// API is auto-generated at the bottom from the public interface of this class

class CacheToStateConnection {
  // public methods
  static publicMethods() {
    return ['validateDatapoints', 'commitDatapoints'];
  }

  constructor({ sharedState = undefined }) {
    Object.assign(this, {
      sharedState,
    });
  }

  validateDatapoints({ datapoints }) {
    const { sharedState } = this,
      { datapointsById = {} } = sharedState.state,
      newDatapointIds = [];

    datapoints.forEach(datapoint => {
      datapoint = datapoint.__private;

      if (!datapoint.invalid) return;
      const field = datapoint.fieldIfAny;
      if (field && (field.isClient && field.get)) {
        if (!datapoint.invalidDependencyDatapointCount) {
          datapoint.validate({ value: undefined });
        }
        return;
      }

      let value = datapointsById[datapoint.proxyableDatapointId];
      if (!datapointsById.hasOwnProperty(datapoint.proxyableDatapointId)) {
        newDatapointIds.push(datapoint.proxyableDatapointId);
        value = '...';
      }

      datapoint.validate({ value });
    });

    if (newDatapointIds.length) {
      sharedState.withTemporaryState(tempState => {
        const datapointsById = tempState.atPath('datapointsById');
        for (const datapointId of newDatapointIds) {
          datapointsById[datapointId] = datapointsById[datapointId] || '...';
        }
      });
    }
  }

  commitDatapoints({ datapoints }) {
    if (!datapoints.length) return;

    const { sharedState } = this;

    sharedState.withTemporaryState(tempState => {
      const datapointsById = tempState.atPath('datapointsById');

      datapoints.forEach(datapoint => {
        datapoint = datapoint.__private;

        if (!datapoint.updated) return;

        const field = datapoint.fieldIfAny;
        if (!field || (field.isClient && field.get)) {
          datapoint.commit();
          return;
        }

        datapointsById[datapoint.proxyableDatapointId] = datapoint.newValue;
        datapoint.commit();
      });
    });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: CacheToStateConnection,
  hasExposedBackDoor: true,
});
