const PublicApi = require("../general/public-api");

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const WebSocketClient = require("./web-socket-client");
const ConvertIds = require("../convert-ids");
const SharedState = require("./shared-state");

const callbackKey = 'ClientDatapoints'

class WSClientDatapoints {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({
    port
  }) {
    const clientDatapoints = this

    SharedState.global.watch({
      callbackKey,
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject

        if (!clientDatapoints.wsclient) return;

        forEachChangedKeyPath((keyPath, change) => {
          if (keyPath.length == 2 && keyPath[0] == 'subscriptions' && ConvertIds.datapointRegex.test(keyPath[1])) {
            if (change.was) {
              if (!change.is) {
                if (!payloadObject) payloadObject = {}
                if (!payloadObject.datapoints) payloadObject.datapoints = {}
                payloadObject.datapoints[keyPath[1]] = 0
              }
            } else if (change.is) {
              if (!payloadObject) payloadObject = {}
              if (!payloadObject.datapoints) payloadObject.datapoints = {}
              payloadObject.datapoints[keyPath[1]] = 1
            }
          }
          if (keyPath.length == 1 && keyPath[0] == 'subscriptions') {
            if (change.was) {
              if (!change.is) {
                if (!payloadObject) payloadObject = {}
                if (!payloadObject.datapoints) payloadObject.datapoints = {}
                for (const datapointId of Object.keys(change.was)) {
                  if (ConvertIds.datapointRegex.test(datapointId)) {
                    payloadObject.datapoints[keyPath[1]] = 0
                  }
                }
              }
            } else if (change.is) {
              if (!payloadObject) payloadObject = {}
              if (!payloadObject.datapoints) payloadObject.datapoints = {}
              for (const datapointId of Object.keys(change.is)) {
                if (ConvertIds.datapointRegex.test(datapointId)) {
                  payloadObject.datapoints[keyPath[1]] = 1
                }
              }
            }
          }
        })

        if (payloadObject) {
          clientDatapoints.wsclient.sendPayload({
            payloadObject
          })
        }
      }
    })

    clientDatapoints.wsclient = new WebSocketClient({
      port
    });

    clientDatapoints.wsclient.watch({
      callbackKey,
      onpayload: ({
        messageIndex,
        messageType,
        payloadObject
      }) => {
        const nonsubscribedDiffs = {}
        if (payloadObject.diffs) {
          SharedState.requestCommit(state => {
            for (const [datapointId, diff] of Object.entries(payloadObject.diffs)) {
              state.atPath('datapointsById')[datapointId] = diff
              // TODO...
              // const datapoint = state.atPath('datapointsById', datapointId)
              // applyDiffToDatapoint({
              //   from: datapoint,
              //   diff
              // })
            }
          })
        }
      },
      onopen: () => {
        const state = SharedState.state,
          subscriptions = state.subscriptions;
        if (!subscriptions) return;

        let payloadObject

        for (const datapointId of Object.keys(subscriptions)) {
          if (ConvertIds.datapointRegex.test(datapointId)) {
            if (!payloadObject) payloadObject = {}
            if (!payloadObject.datapoints) payloadObject.datapoints = {}
            payloadObject.datapoints[datapointId] = 1
          }
        }

        if (payloadObject) {
          clientDatapoints.wsclient.sendPayload({
            payloadObject
          })
        }
      }
    })
  }
}


// API is the public facing class
module.exports = PublicApi({
  fromClass: WSClientDatapoints,
  hasExposedBackDoor: true
});