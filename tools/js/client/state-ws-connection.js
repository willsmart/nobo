// state-ws-connection
// © Will Smart 2018. Licence: MIT

// This is an intermediary between the web-socket-client and the shared-state

const PublicApi = require('../general/public-api');
const ConvertIds = require('../convert-ids');
const SharedState = require('../general/shared-state');

const callbackKey = 'state-ws-connection';

class StateWsConnection {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({ wsclient, sharedState = nil }) {
    const clientDatapoints = this;
    sharedState = sharedState || SharedState.global;

    sharedState.watch({
      callbackKey,
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject;

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
          wsclient.sendPayload({
            payloadObject,
          });
        }
      },
    });

    wsclient.watch({
      callbackKey,
      onpayload: ({ messageIndex, messageType, payloadObject }) => {
        if (payloadObject.diffs) {
          sharedState.requestCommit(state => {
            for (const [proxyableDatapointId, diff] of Object.entries(payloadObject.diffs)) {
              state.atPath('datapointsById')[proxyableDatapointId] = diff;
              // TODO...
              // const datapoint = state.atPath('datapointsById', proxyableDatapointId)
              // applyDiffToDatapoint({
              //   from: datapoint,
              //   diff
              // })
            }
          });
        }
      },
      onopen: () => {
        const state = sharedState.state,
          datapointsById = state.datapointsById;
        if (!datapointsById) return;

        let payloadObject;

        for (const proxyableDatapointId of Object.keys(datapointsById)) {
          if (ConvertIds.proxyableDatapointRegex.test(proxyableDatapointId)) {
            if (!payloadObject) payloadObject = {};
            if (!payloadObject.datapoints) payloadObject.datapoints = {};
            payloadObject.datapoints[proxyableDatapointId] = 1;
          }
        }

        if (payloadObject) {
          wsclient.sendPayload({
            payloadObject,
          });
        }
      },
    });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: StateWsConnection,
  hasExposedBackDoor: true,
});
