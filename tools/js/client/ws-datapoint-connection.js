const PublicApi = require('../general/public-api');

// API is auto-generated at the bottom from the public interface of the StateWsConnection class

const ConvertIds = require('../convert-ids');
const SharedState = require('../general/shared-state');
const { TemporaryState } = SharedState;

class WsDatapointConnection {
  // public methods
  static publicMethods() {
    return ['sendDatapoints', 'retrieveDatapoints'];
  }

  constructor({ wsclient, cache }) {
    const datapointConnecton = this;

    datapointConnecton.wsclient = wsclient;
    datapointConnecton.cache = cache;
    const subscriptions = (datapointConnecton.subscriptions = {});

    datapointConnecton.wsclient.watch({
      callbackKey,
      onpayload: ({ messageIndex, messageType, payloadObject }) => {
        if (payloadObject.diffs) {
          SharedState.requestCommit(state => {
            for (const [proxyableDatapointId, diff] of Object.entries(payloadObject.diffs)) {
              state.atPath('datapointsById')[proxyableDatapointId] = diff;
              const subscription = subscriptions[proxyableDatapointId]
              if (subscription) {
                const datapoint = cache.getExistingDatapoint({datapointId: proxyableDatapointId})
                if (subscription.send) {
                  datapoint.commit()
                }
                if (subscription.send) {
                  datapoint.commit()
                }
          )
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
        const state = SharedState.state,
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
          datapointConnecton.wsclient.sendPayload({
            payloadObject,
          });
        }
      },
    });
  }

  sendDatapoints(serverValuesByProxyableDatapointId) {
    const datapointConnecton = this,
      { sentDatapointIds } = datapointConnecton;

    Object.assign(sentDatapointIds, serverValuesByProxyableDatapointId)
    datapointConnecton.wsclient.sendPayload({
      payloadObject: { diffs: valuesByProxyableDatapointId },
    });
  }

  retrieveDatapoints(serverDatapointIds) {
    const datapointConnecton = this,
    { subscriptions } = datapointConnecton

    if (!proxyableDatapointIds.length) return;
    const datapointsById = {};
    for (const proxyableDatapointId of proxyableDatapointIds) datapointsById[proxyableDatapointId] = 1;
    Object.assign(sentDatapointIds, serverValuesByProxyableDatapointId)

    datapointConnecton.wsclient.sendPayload({
      payloadObject: { datapoints: datapointsById },
    });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WsDatapointConnection,
  hasExposedBackDoor: true,
});
