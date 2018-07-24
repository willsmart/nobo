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
            for (const [datapointId, diff] of Object.entries(payloadObject.diffs)) {
              state.atPath('datapointsById')[datapointId] = diff;
              const subscription = subscriptions[datapointId]
              if (subscription) {
                const datapoint = cache.getExistingDatapoint({datapointId})
                if (subscription.send) {
                  datapoint.commit()
                }
                if (subscription.send) {
                  datapoint.commit()
                }
          )
              // TODO...
              // const datapoint = state.atPath('datapointsById', datapointId)
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

        for (const datapointId of Object.keys(datapointsById)) {
          if (ConvertIds.datapointRegex.test(datapointId)) {
            if (!payloadObject) payloadObject = {};
            if (!payloadObject.datapoints) payloadObject.datapoints = {};
            payloadObject.datapoints[datapointId] = 1;
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

  sendDatapoints(serverValuesByDatapointId) {
    const datapointConnecton = this,
      { sentDatapointIds } = datapointConnecton;

    Object.assign(sentDatapointIds, serverValuesByDatapointId)
    datapointConnecton.wsclient.sendPayload({
      payloadObject: { diffs: valuesByDatapointId },
    });
  }

  retrieveDatapoints(serverDatapointIds) {
    const datapointConnecton = this,
    { subscriptions } = datapointConnecton

    if (!datapointIds.length) return;
    const datapointsById = {};
    for (const datapointId of datapointIds) datapointsById[datapointId] = 1;
    Object.assign(sentDatapointIds, serverValuesByDatapointId)

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
