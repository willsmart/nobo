const PublicApi = require("../general/public-api");

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const WebSocketClient = require("./web-socket-client");
const ConvertIds = require("../convert-ids");
const SharedState = require("./shared-state");
const { TemporaryState } = SharedState;

const callbackKey = "ClientDatapoints";

let globalClientDatapoints;

class WSClientDatapoints {
  // public methods
  static publicMethods() {
    return ["subscribe", "getDatapoint", "global"];
  }

  constructor({ port } = {}) {
    const clientDatapoints = this;

    SharedState.global.watch({
      callbackKey: "manage-subscriptions",
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject;

        if (!clientDatapoints.wsclient) return;

        forEachChangedKeyPath((keyPath, change) => {
          if (keyPath.length == 1 && keyPath[0] == "datapointsById") return true;

          if (keyPath.length == 2 && keyPath[0] == "datapointsById" && ConvertIds.datapointRegex.test(keyPath[1])) {
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

    clientDatapoints.wsclient = new WebSocketClient({
      port
    });

    clientDatapoints.wsclient.watch({
      callbackKey,
      onpayload: ({ messageIndex, messageType, payloadObject }) => {
        if (payloadObject.diffs) {
          SharedState.requestCommit(state => {
            for (const [datapointId, diff] of Object.entries(payloadObject.diffs)) {
              state.atPath("datapointsById")[datapointId] = diff;
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
          clientDatapoints.wsclient.sendPayload({
            payloadObject
          });
        }
      }
    });
  }

  static get global() {
    return globalClientDatapoints ? globalClientDatapoints : (globalClientDatapoints = new WSClientDatapoints());
  }

  getDatapoint(datapointId, defaultValue) {
    const clientDatapoints = this,
      datapointsById = SharedState.global.state.datapointsById || {};
    if (datapointsById[datapointId]) return datapointsById[datapointId];
    SharedState.global.withTemporaryState(tempState => {
      tempState.atPath("datapointsById")[datapointId] = defaultValue;
    });
    return defaultValue;
  }

  subscribe(datapointIds) {
    const clientDatapoints = this;

    if (typeof datapointIds == "string") datapointIds = [datapointIds];
    if (!Array.isArray(datapointIds)) datapointIds = Object.keys(datapointIds);
    if (!datapointIds.length) return;
    const datapointsById = {};
    for (const datapointId of datapointIds) datapointsById[datapointId] = 1;
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
