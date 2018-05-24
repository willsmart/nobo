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
      callbackKey: 'manage-subscriptions',
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject

        if (!clientDatapoints.wsclient) return;

        forEachChangedKeyPath((keyPath, change) => {
          if (keyPath.length == 1 && keyPath[0] == 'datapointsById') return true;

          if (keyPath.length == 2 && keyPath[0] == 'datapointsById' && ConvertIds.datapointRegex.test(keyPath[1])) {
            if (!payloadObject) payloadObject = {}
            if (!payloadObject.datapoints) payloadObject.datapoints = {}
            switch (change.type) {
              case 'delete':
                payloadObject.datapoints[keyPath[1]] = 0
                break;
              case 'insert':
                payloadObject.datapoints[keyPath[1]] = 1
                break;
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

    SharedState.global.watch({
      callbackKey: 'adjust-divs',
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject

        forEachChangedKeyPath((keyPath, change) => {
          if (!keyPath.length || keyPath[0] != 'datapointsById') return;
          if (keyPath.length <= 2 || !ConvertIds.datapointRegex.test(keyPath[1])) return true;

          const datapointId = keyPath[1];

          if (keyPath.length == 3) {
            if (Array.isArray(change.is)) return true

            clientDatapoints.updateFieldValue({
              datapointId,
              field: keyPath[2],
              was: change.was,
              is: change.is
            })
          } else if (keyPath.length == 4 && typeof (keyPath[3]) == 'number') {
            const
              wasRowId = (typeof (change.was) == 'string' && ConvertIds.rowRegex.test(change.was) ? change.was : undefined),
              isRowId = (typeof (change.is) == 'string' && ConvertIds.rowRegex.test(change.is) ? change.is : undefined)

            if (wasRowId == isRowId) return;

            if (change.type == 'change' || change.type == 'delete') {
              clientDatapoints.deleteDOMChild({
                datapointId,
                field: keyPath[2],
                index: keyPath[3],
                rowId: wasRowId
              })
            }
            if (change.type == 'change' || change.type == 'insert') {
              clientDatapoints.insertDOMChild({
                datapointId,
                field: keyPath[2],
                index: keyPath[3],
                rowId: isRowId
              })
            }
          }
        })
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

  subscribe({
    datapointIds
  }) {
    if (!Array.isArray(datapointIds)) datapointIds = Object.keys(datapointIds);
    if (!datapoints.length) return;
    const datapointsById = {}
    for (const datapointId of datapointIds) datapointsById[datapointId] = 1;
    clientDatapoints.wsclient.sendPayload({
      datapoints: datapointsById
    })
  }

}


// API is the public facing class
module.exports = PublicApi({
  fromClass: WSClientDatapoints,
  hasExposedBackDoor: true
});