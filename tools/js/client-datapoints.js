const PublicApi = require("../general/public-api");

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const callbackKey = 'ClientDatapoints'

class WSClientDatapoints {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({
    client,
    serverDatapoints,
    index
  }) {
    const clientDatapoints = this;

    clientDatapoints.serverDatapoints = serverDatapoints
    clientDatapoints.index = index
    clientDatapoints.subscribedDatapoints = {}
    clientDatapoints.diffByDatapointId = {}
    clientDatapoints.newlyValidDatapoints = {}
    clientDatapoints.clientDatapointVersions = {}

    clientDatapoints.sendMessage = (string) => client.ws.send(string)

    client.watch({
      callbackKey,
      ondisconnected: () => clientDatapoints.close(),
      onpayload: (payload) => clientDatapoints.handlePayload(payload),
    })
  }

  get callbackKey() {
    `${callbackKey}_${this.index}`
  }

  close() {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints;

    for (const datapoint of Object.values(clientDatapoints.subscribedDatapoints)) {
      datapoint.stopWatching(clientDatapoints.callbackKey)
      serverDatapoints.releaseRefForDatapoint(datapoint)
    }
    clientDatapoints.subscribedDatapoints = {}
    clientDatapoints.diffByDatapointId = {}
    clientDatapoints.newlyValidDatapoints = {}
    clientDatapoints.clientDatapointVersions = {}
    delete serverDatapoints.clientsWithPayloads[clientDatapoints.index]
  }

  subscribe({
    datapointId
  }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints;

    if (clientDatapoints.subscribedDatapoints[datapointId]) return clientDatapoints.subscribedDatapoints[datapointId];

    const {
      datapoint
    } = serverDatapoints.addRefForDatapoint({
      datapointId
    })

    clientDatapoints.subscribedDatapoints[datapointId] = datapoint

    datapoint.watch({
      callbackKey: clientDatapoints.callbackKey,
      onvalid: () => {
        clientDatapoints.queueSendDiff(datapoint)
      }
    })



    clientDatapoints.queueSendDiff(datapoint)
  }

  unsubscribe({
    datapointId
  }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints,
      datapoint = clientDatapoints.subscribedDatapoints[datapointId]

    if (!datapoint) return;

    delete clientDatapoints.subscribedDatapoints[datapointId]

    datapoint.stopWatching({
      callbackKey: clientDatapoints.callbackKey,
    })
  }

  queueSendDiff(datapoint) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints,
      datapointId = datapoint.datapointId;

    if (clientDatapoints.diffByDatapointId[datapointId]) return

    const clientVersionInfo = clientDatapoints.clientDatapointVersions[datapointId],
      {
        sentVersion = 0,
        hasVersion = 0
      } = clientVersionInfo || {}

    if (sentVersion != hasVersion) return

    const diff = serverDatapoints.diffForDatapoint({
      datapointId,
      value: datapoint.valueIfAny,
      fromVersion: hasVersion
    })
    if (!diff) return

    if (clientVersionInfo) clientVersionInfo.sentVersion = diff.toVersion;
    else clientDatapoints.clientDatapointVersions[datapointId] = {
      hasVersion,
      sentVersion: diff.toVersion
    }
    clientDatapoints.diffByDatapointId[datapointId] = diff
    serverDatapoints.clientsWithPayloads[clientDatapoints.index] = clientDatapoints

    return diff
  }

  handlePayload({
    payloadObject,
  }) {
    const clientDatapoints = this

    if (payloadObject.datapoints) clientDatapoints.recievedDatapointsFromClient(payloadObject)
  }

  recievedDatapointsFromClient({
    datapoints: datapointsFromClient
  }) {
    for (const [datapointId, datapointFromClient] of Object.entries(datapointsFromClient)) {
      const subscribedDatapoint = clientDatapoints.subscribedDatapoints[datapointId],
        {
          ackVersion,
          unsubscribe,
          subscribe,
          diff
        } = datapointFromClient

      if (subscribedDatapoint) {
        if (unsubscribe) {
          clientDatapoints.unsubscribe(subscribedDatapoint)
          continue
        }
        if (ackVersion) {
          let clientVersionInfo = clientDatapoints.clientDatapointVersions[datapointId]
          const {
            hasVersion = 0
          } = clientVersionInfo || {}

          if (hasVersion != ackVersion) {
            if (!clientVersionInfo) clientVersionInfo = clientDatapoints.clientDatapointVersions[datapointId] = {
              hasVersion: ackVersion,
              sentVersion: ackVersion
            };
            else clientVersionInfo.hasVersion = ackVersion

            clientDatapoints.queueSendDiff(subscribedDatapoint)
          }
        }
        if (diff) {
          // TODO
        }
      }
    }
  }
}

class WSServerDatapoints {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({
    wsserver,
    cache
  }) {
    const serverDatapoints = this

    serverDatapoints._cache = cache
    serverDatapoints.clientsWithPayloads = {}
    serverDatapoints.nextClientIndex = 1
    serverDatapoints.payloadByFromVersionByDatapointId = {}
    serverDatapoints.datapointInfos = {}

    wsserver.watch({
      callbackKey,
      onclientConnected: (client) => client.datapoints = new ClientDatapoints({
        serverDatapoints,
        client,
        index: serverDatapoints.nextClientIndex++
      })
    })

    cache.watch({
      callbackKey,
      onvalid: () => serverDatapoints.sendPayloadsToClients()
    })
  }

  get cache() {
    return this._cache
  }

  addRefForDatapoint({
    datapointId
  }) {
    const serverDatapoints = this,
      datapoint = serverDatapoints.cache.getOrCreateDatapoint({
        datapointId
      })

    let datapointInfo = serverDatapoints.datapointInfos[datapointId]
    if (datapointInfo) {
      datapointInfo.refCnt++
    } else {
      datapointInfo = serverDatapoints.datapointInfos[datapointId] = {
        datapoint,
        refCnt: 1,
        currentVersion: datapoint.invalid ? 0 : 1
      }

      datapoint.watch({
        callbackKey,
        onvalid_prioritized: () => {
          datapointInfo.currentVersion++
        }
      })

      if (datapoint.invalid) serverDatapoints.cache.queueValidationJob()
    }
    return datapointInfo
  }

  releaseRefForDatapoint({
    datapointId
  }) {
    const serverDatapoints = this

    let datapointInfo = serverDatapoints.datapointInfos[datapointId]
    if (datapointInfo && !--datapointInfo.refCnt) {
      datapoint.stopWatching({
        callbackKey
      })
      delete serverDatapoints.datapointInfos[datapointId]
      return
    }
    return datapointInfo
  }

  queueValidateJob() {
    const serverDatapoints = this


  }
  diffForDatapoint({
    datapointId,
    value,
    fromVersion
  }) {
    const serverDatapoints = this,
      payloadByFromVersion = serverDatapoints.payloadByFromVersionByDatapointId[datapointId] ?
      serverDatapoints.payloadByFromVersionByDatapointId[datapointId] :
      (serverDatapoints.payloadByFromVersionByDatapointId[datapointId] = {})

    if (payloadByFromVersion[fromVersion]) return payloadByFromVersion[fromVersion];

    const datapointInfo = serverDatapoints.datapointInfos[datapointId] || {},
      {
        currentVersion = 0
      } = datapointInfo

    if (currentVersion <= fromVersion) return;

    // TODO handle diff for recent version
    return payloadByFromVersion[fromVersion] = (datapointInfo.datapoint || {}).valueIfAny
  }

  sendPayloadsToClients() {
    const serverDatapoints = this

    const clientsWithPayloads = serverDatapoints.clientsWithPayloads;
    serverDatapoints.clientsWithPayloads = {}

    for (const clientDatapoints of Object.values(clientsWithPayloads)) {
      const newlyValidDatapoints = clientDatapoints.newlyValidDatapoints;
      clientDatapoints.newlyValidDatapoints = {}

      try {
        client.sendPayload("Models", payload);
      } catch (err) {
        console.log(err);
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WSServerDatapoints,
  hasExposedBackDoor: true
});