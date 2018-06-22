// state-cache-connection
// © Will Smart 2018. Licence: MIT

// This is an intermediary between the datapoint-cache and the shared-state

const PublicApi = require('../general/public-api');
const SharedState = require('../general/shared-state');
const clone = require('../general/clone');
const { TemporaryState } = SharedState;

const callbackKey = 'state-cache-connection';

// other implied dependencies

//const Schema = require('../schema'); // via use of datapoint.fieldIfAny

//const Datapoint = require('../datapoint'); // via datapoints arg to functions
//    uses invalid, fieldIfAny, stopWatching, valueIfAny, invalidate, invalid, setVirtualField

// API is auto-generated at the bottom from the public interface of this class

class StateCacheConnection {
  // public methods
  static publicMethods() {
    return ['validateDatapoints', 'commitDatapoints'];
  }

  constructor({ sharedState = undefined, defaultValue = undefined }) {
    Object.assign(this, {
      sharedState,
      defaultValue,
    });

    SharedState.global.watch({
      callbackKey,
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject;

        if (!datapointConnecton.wsclient) return;

        forEachChangedKeyPath((keyPath, change) => {
          if (keyPath.length == 1 && keyPath[0] == 'datapointsById') return true;

          if (
            keyPath.length == 2 &&
            keyPath[0] == 'datapointsById' &&
            ConvertIds.proxyableDatapointRegex.test(keyPath[1])
          ) {
            if (!payloadObject) payloadObject = {};
            if (!payloadObject.datapoints) payloadObject.datapoints = {};
            switch (change.type) {
              case 'delete':
                payloadObject.datapoints[keyPath[1]] = 0;
                break;
              case 'insert':
                payloadObject.datapoints[keyPath[1]] = 1;
                break;
            }
          }
        });

        if (payloadObject) {
          datapointConnecton.wsclient.sendPayload({
            payloadObject,
          });
        }
      },
    });
  }

  validateDatapoints({ datapoints }) {
    const datapointConnection = this,
      { sharedState, defaultValue } = datapointConnection,
      { datapointsById = {} } = sharedState.state;
    const subscriptions = (sharedState.state.subscriptions = sharedState.state.subscriptions || {});

    datapoints.forEach(datapoint => {
      datapoint = datapoint.__private;

      if (!datapoint.invalid) return;
      const field = datapoint.fieldIfAny;
      if (!field || (field.isClient && field.get)) {
        if (!datapoint.invalidDependencyDatapointCount) {
          datapoint.validate();
        }
        return;
      }

      if (!field.isClient) {
        subscriptions = sharedState.state.subscriptions = sharedState.state.subscriptions || {};
        serverDatapointIds.push(datapoint.proxyableDatapointId);
        return;
      }

      const value = datapointsById[datapoint.proxyableDatapointId] || defaultValue;
      datapoint.validate(value);
    });

    if (serverDatapointIds.length) {
      sharedState.withTemporaryState(tempState => {
        const subscriptions = tempState.atPath('subscriptions');
        for (const datapointId of serverDatapointIds) {
          const state = (subscriptions[datapointId] = subscriptions[datapointId]
            ? clone(subscriptions[datapointId])
            : []);
          state.push('get');
        }
      });
    }
  }

  commitDatapoints({ datapoints }) {
    if (!datapoints.length) return;

    const datapointConnection = this,
      { sharedState } = datapointConnection;

    const fieldsByRowByType = {},
      committers = {};

    sharedState.withTemporaryState(tempState => {
      const datapointsById = tempState.atPath('datapointsById'),
        subscriptions = tempState.atPath('subscriptions');

      datapoints.forEach(datapoint => {
        datapoint = datapoint.__private;

        if (!datapoint.updated) return;

        const field = datapoint.fieldIfAny;
        if (!field || (field.isClient && field.get)) {
          datapoint.commit();
          return;
        }

        datapointsById[datapoint.proxyableDatapointId] = datapoint.newValue;

        if (!field.isClient) {
          const state = (subscriptions[datapoint.proxyableDatapointId] = subscriptions[datapoint.proxyableDatapointId]
            ? clone(subscriptions[datapoint.proxyableDatapointId])
            : []);
          state.push({ value });
          return;
        }

        datapoint.commit();
      });
    });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: StateCacheConnection,
  hasExposedBackDoor: true,
});
