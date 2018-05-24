const PublicApi = require("./general/public-api");

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const WebSocketClient = require("./web-socket-client");
const ConvertIds = require("../convert-ids");
const State = require("./client-state");

var rlInterface = rl.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

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
        let message

        if (!clientDatapoints.wsclient) return;

        forEachChangedKeyPath((keyPath, change) => {
          if (keyPath.length == 2 && keyPath[0] == 'subscriptions' && ConvertIds.datapointRegex.test(keyPath[1])) {
            if (change.hasOwnProperty('was')) {
              if (!change.hasOwnProperty('is')) {
                if (!message) message = {}
                if (!message.datapoints) message.datapoints = {}
                message.datapoints[keyPath[1]] = 0
              }
            } else if (change.hasOwnProperty('is')) {
              if (!message) message = {}
              if (!message.datapoints) message.datapoints = {}
              message.datapoints[keyPath[1]] = 1
            }
          }
        })

        if (message) {
          clientDatapoints.wsclient.sendMessage({
            message
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
            for (const [datapointId, diff] of payloadObject.diffs) {
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

        let message

        for (const datapointId of Object.keys(subscriptions)) {
          if (ConvertIds.datapointRegex.test(datapointId)) {
            if (!message) message = {}
            if (!message.datapoints) message.datapoints = {}
            message.datapoints[datapointId] = 1
          }
        }

        if (message) {
          clientDatapoints.wsclient.sendMessage({
            message
          })
        }
      }
    })
  }
}


// API is the public facing class
module.exports = PublicApi({
  fromClass: WSServerDatapoints,
  hasExposedBackDoor: true
});