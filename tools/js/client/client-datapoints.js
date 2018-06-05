const PublicApi = require("../general/public-api");

// API is auto-generated at the bottom from the public interface of the WSClientDatapoints class

const ConvertIds = require("../convert-ids");
const SharedState = require("../general/shared-state");
const { TemporaryState } = SharedState;

const callbackKey = "ClientDatapoints";

let globalClientDatapoints;

class WSClientDatapoints {
  // public methods
  static publicMethods() {
    return ["subscribe", "getDatapoint"];
  }

  constructor({ wsclient }) {
    const clientDatapoints = this;

    clientDatapoints.wsclient = wsclient;

    SharedState.global.watch({
      callbackKey: "manage-subscriptions",
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject;

        if (!clientDatapoints.wsclient) return;

        forEachChangedKeyPath((keyPath, change) => {
          if (keyPath.length == 1 && keyPath[0] == "datapointsById") return true;

          if (
            keyPath.length == 2 &&
            keyPath[0] == "datapointsById" &&
            ConvertIds.proxyableDatapointRegex.test(keyPath[1])
          ) {
            if (!payloadObject) payloadObject = {};
            if (!payloadObject.datapoints) payloadObject.datapoints = {};
            switch (change.type) {
              case "delete":
                payloadObject.datapoints[keyPath[1]] = 0;
                break;
              case "insert":
                payloadObject.datapoints[keyPath[1]] = 1;
                break;
            }
          }
        });

        if (payloadObject) {
          clientDatapoints.wsclient.sendPayload({
            payloadObject
          });
        }
      }
    });

    clientDatapoints.wsclient.watch({
      callbackKey,
      onpayload: ({ messageIndex, messageType, payloadObject }) => {
        if (payloadObject.diffs) {
          SharedState.requestCommit(state => {
            for (const [proxyableDatapointId, diff] of Object.entries(payloadObject.diffs)) {
              state.atPath("datapointsById")[proxyableDatapointId] = diff;
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
          clientDatapoints.wsclient.sendPayload({
            payloadObject
          });
        }
      }
    });
  }

  getDatapoint(proxyableDatapointId, defaultValue) {
    const clientDatapoints = this,
      datapointsById = SharedState.global.state.datapointsById || {};
    if (datapointsById[proxyableDatapointId]) return datapointsById[proxyableDatapointId];
    SharedState.global.withTemporaryState(tempState => {
      tempState.atPath("datapointsById")[proxyableDatapointId] = defaultValue;
    });
    return defaultValue;
  }

  subscribe(proxyableDatapointIds) {
    const clientDatapoints = this;

    if (typeof proxyableDatapointIds == "string") proxyableDatapointIds = [proxyableDatapointIds];
    if (!Array.isArray(proxyableDatapointIds)) proxyableDatapointIds = Object.keys(proxyableDatapointIds);
    if (!proxyableDatapointIds.length) return;
    const datapointsById = {};
    for (const proxyableDatapointId of proxyableDatapointIds) datapointsById[proxyableDatapointId] = 1;
    clientDatapoints.wsclient.sendPayload({
      payloadObject: { datapoints: datapointsById }
    });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WSClientDatapoints,
  hasExposedBackDoor: true
});
