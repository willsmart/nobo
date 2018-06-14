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

  constructor({ wsclient, schema, sharedState = nil }) {
    const stateWsConnection = this;
    sharedState = sharedState || SharedState.global;

    Object.assign(this, {
      sharedState,
      wsclient,
      schema,
    });

    sharedState.watch({
      callbackKey,
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject;

        forEachChangedKeyPath((keyPath, change) => {
          switch (keyPath.length) {
            case 0:
              return true;
            case 1:
              return keyPath[0] == 'datapointsById';
            case 2:
              break;
            default:
              return false;
          }

          if (change.type != 'delete' && change.type != 'insert') return;

          const proxyableDatapointId = keyPath[1];
          if (!stateWsConnection.isServerDatapoint(proxyableDatapointId)) return;

          if (!payloadObject) payloadObject = {};
          if (!payloadObject.datapoints) payloadObject.datapoints = {};
          payloadObject.datapoints[proxyableDatapointId] = change.type == 'insert' ? 1 : 0;
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

        for (const [proxyableDatapointId, value] of Object.entries(datapointsById)) {
          if (value === undefined || !stateWsConnection.isServerDatapoint(proxyableDatapointId)) continue;

          if (!payloadObject) payloadObject = {};
          if (!payloadObject.datapoints) payloadObject.datapoints = {};
          payloadObject.datapoints[proxyableDatapointId] = 1;
        }

        if (payloadObject) {
          wsclient.sendPayload({
            payloadObject,
          });
        }
      },
    });
  }

  isServerDatapoint(proxyableDatapointId) {
    const stateWsConnection = this;

    if (!ConvertIds.proxyableDatapointRegex.test(proxyableDatapointId)) return false;

    const datapointInfo = ConvertIds.decomposeId({ proxyableDatapointId }),
      type = stateWsConnection.schema.allTypes[datapointInfo.typeName];

    if (!type) return false;
    const field = type.fields[datapointInfo.fieldName];
    return !field || !field.isClient;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: StateWsConnection,
  hasExposedBackDoor: true,
});
