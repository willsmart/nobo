const PublicApi = require('./general/public-api');
const ConvertIds = require('./convert-ids');

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const callbackKey = 'ClientDatapoints';

class WSClientDatapoints {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({ client, serverDatapoints, index }) {
    const clientDatapoints = this;

    clientDatapoints.serverDatapoints = serverDatapoints;
    clientDatapoints.index = index;
    clientDatapoints.subscribedDatapoints = {};
    clientDatapoints.diffByDatapointId = {};
    clientDatapoints.newlyValidDatapoints = {};
    clientDatapoints.clientDatapointVersions = {};

    clientDatapoints.sendMessage = string => client.sendMessage(string);
    clientDatapoints.sendPayload = ({ messageIndex, messageType, payloadObject }) => {
      client.sendPayload({
        messageIndex,
        messageType,
        payloadObject,
      });
    };

    client.watch({
      callbackKey,
      onclose: () => clientDatapoints.close(),
      onpayload: args => clientDatapoints.handlePayload(args),
    });
  }

  get callbackKey() {
    return `${callbackKey}_${this.index}`;
  }

  close() {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints;

    for (const datapoint of Object.values(clientDatapoints.subscribedDatapoints)) {
      if (!datapoint) continue;
      datapoint.stopWatching({
        callbackKey: clientDatapoints.callbackKey,
      });
      serverDatapoints.releaseRefForDatapoint(datapoint);
    }
    clientDatapoints.subscribedDatapoints = {};
    clientDatapoints.diffByDatapointId = {};
    clientDatapoints.newlyValidDatapoints = {};
    clientDatapoints.clientDatapointVersions = {};
    delete serverDatapoints.clientsWithPayloads[clientDatapoints.index];
  }

  subscribe({ proxyableDatapointId, user }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints;

    if (clientDatapoints.subscribedDatapoints.hasOwnProperty(proxyableDatapointId))
      return clientDatapoints.subscribedDatapoints[proxyableDatapointId];

    const datapointId = clientDatapoints.datapointIdFromProxyableDatapointId({ proxyableDatapointId, user });

    let datapoint;
    if (datapointId) {
      ({ datapoint } = serverDatapoints.addRefForDatapoint({
        datapointId,
      }));
      datapoint.watch({
        callbackKey: `${clientDatapoints.callbackKey}__${proxyableDatapointId}`,
        onvalid: () => {
          clientDatapoints.queueSendDiff({ proxyableDatapointId, datapoint });
        },
      });
    }

    clientDatapoints.subscribedDatapoints[proxyableDatapointId] = datapoint;

    clientDatapoints.queueSendDiff({ proxyableDatapointId, datapoint });
  }

  unsubscribe({ proxyableDatapointId }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints,
      datapoint = clientDatapoints.subscribedDatapoints[proxyableDatapointId];

    delete clientDatapoints.subscribedDatapoints[proxyableDatapointId];

    if (datapoint) {
      datapoint.stopWatching({
        callbackKey: `${clientDatapoints.callbackKey}__${proxyableDatapointId}`,
      });
      serverDatapoints.releaseRefForDatapoint(datapoint);
    }
  }

  queueSendDiff({ proxyableDatapointId, datapoint }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints,
      datapointId = datapoint ? datapoint.datapointId : undefined;

    if (clientDatapoints.diffByDatapointId[proxyableDatapointId]) return;

    const clientVersionInfo = clientDatapoints.clientDatapointVersions[proxyableDatapointId],
      { sentVersion = 0, hasVersion = 0 } = clientVersionInfo || {};

    if (sentVersion != hasVersion) return;

    const diff = datapoint
      ? serverDatapoints.diffForDatapoint({
          datapointId,
          value: datapoint.valueIfAny,
          fromVersion: hasVersion,
        })
      : '';
    if (diff === undefined) return;

    if (clientVersionInfo) clientVersionInfo.sentVersion = diff.toVersion;
    else
      clientDatapoints.clientDatapointVersions[proxyableDatapointId] = {
        hasVersion,
        sentVersion: diff.toVersion,
      };
    clientDatapoints.diffByDatapointId[proxyableDatapointId] = diff;
    serverDatapoints.clientsWithPayloads[clientDatapoints.index] = clientDatapoints;

    serverDatapoints.queueSendPayloads();

    return diff;
  }

  handlePayload({ messageIndex, messageType, payloadObject, session }) {
    const clientDatapoints = this;

    if (payloadObject.datapoints)
      clientDatapoints.recievedDatapointsFromClient({ datapoints: payloadObject.datapoints, session });
  }

  datapointIdFromProxyableDatapointId({ proxyableDatapointId, user }) {
    if (!ConvertIds.proxyDatapointRegex.test(proxyableDatapointId)) return proxyableDatapointId;
    const datapointInfo = ConvertIds.decomposeId({ proxyableDatapointId });
    switch (datapointInfo.typeName) {
      case 'User':
        switch (datapointInfo.proxyKey) {
          case '':
          case 'me':
          case 'default':
            if (user) return ConvertIds.recomposeId(datapointInfo, { dbRowId: user.id }).datapointId;
            break;
        }
      case 'App':
        switch (datapointInfo.proxyKey) {
          case 'default':
            return ConvertIds.recomposeId(datapointInfo, { dbRowId: 1 }).datapointId;
        }
    }
  }

  recievedDatapointsFromClient({ datapoints: datapointsFromClient, session }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints,
      { user } = session;

    for (let [proxyableDatapointId, datapointFromClient] of Object.entries(datapointsFromClient)) {
      if (datapointFromClient === 0)
        datapointFromClient = {
          unsubscribe: true,
        };
      else if (datapointFromClient === 1)
        datapointFromClient = {
          subscribe: true,
        };

      const isSubscribed = clientDatapoints.subscribedDatapoints.hasOwnProperty(proxyableDatapointId),
        subscribedDatapoint = clientDatapoints.subscribedDatapoints[proxyableDatapointId],
        { ackVersion, unsubscribe, subscribe, diff } = datapointFromClient;

      if (isSubscribed) {
        if (unsubscribe) {
          clientDatapoints.unsubscribe({
            proxyableDatapointId,
          });
          continue;
        }
        if (ackVersion) {
          let clientVersionInfo = clientDatapoints.clientDatapointVersions[proxyableDatapointId];
          const { hasVersion = 0 } = clientVersionInfo || {};

          if (hasVersion != ackVersion) {
            if (!clientVersionInfo)
              clientVersionInfo = clientDatapoints.clientDatapointVersions[proxyableDatapointId] = {
                hasVersion: ackVersion,
                sentVersion: ackVersion,
              };
            else clientVersionInfo.hasVersion = ackVersion;

            clientDatapoints.queueSendDiff({ proxyableDatapointId, datapoint: subscribedDatapoint });
          }
        }
        if (diff) {
          // TODO
        }
      } else if (subscribe) {
        clientDatapoints.subscribe({
          proxyableDatapointId,
          user,
        });
      }
    }
  }
}

class WSServerDatapoints {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({ wsserver }) {
    const serverDatapoints = this;

    serverDatapoints._cache = wsserver.cache;
    serverDatapoints.clientsWithPayloads = {};
    serverDatapoints.nextClientIndex = 1;
    serverDatapoints.payloadByFromVersionByDatapointId = {};
    serverDatapoints.datapointInfos = {};

    wsserver.watch({
      callbackKey,
      onclientConnected: client =>
        (client.datapoints = new WSClientDatapoints({
          serverDatapoints,
          client,
          index: serverDatapoints.nextClientIndex++,
        })),
    });

    serverDatapoints.cache.watch({
      callbackKey,
      onvalid: () => {
        serverDatapoints.sendPayloadsToClients();
      },
    });
  }

  get cache() {
    return this._cache;
  }

  addRefForDatapoint({ datapointId }) {
    const serverDatapoints = this,
      datapoint = serverDatapoints.cache.getOrCreateDatapoint({
        datapointId,
      });

    let datapointInfo = serverDatapoints.datapointInfos[datapointId];
    if (datapointInfo) {
      datapointInfo.refCnt++;
    } else {
      datapointInfo = serverDatapoints.datapointInfos[datapointId] = {
        datapoint,
        refCnt: 1,
        currentVersion: datapoint.invalid ? 0 : 1,
      };

      datapoint.watch({
        callbackKey,
        onvalid_prioritized: () => {
          datapointInfo.currentVersion++;
        },
      });

      if (datapoint.invalid) serverDatapoints.cache.queueValidationJob();
    }
    return datapointInfo;
  }

  releaseRefForDatapoint({ datapointId }) {
    const serverDatapoints = this;

    let datapointInfo = serverDatapoints.datapointInfos[datapointId];
    if (datapointInfo && !--datapointInfo.refCnt) {
      datapointInfo.datapoint.stopWatching({
        callbackKey,
      });
      delete serverDatapoints.datapointInfos[datapointId];
      return;
    }
    return datapointInfo;
  }

  queueValidateJob() {
    const serverDatapoints = this;
  }
  diffForDatapoint({ datapointId, value, fromVersion }) {
    const serverDatapoints = this,
      payloadByFromVersion = serverDatapoints.payloadByFromVersionByDatapointId[datapointId]
        ? serverDatapoints.payloadByFromVersionByDatapointId[datapointId]
        : (serverDatapoints.payloadByFromVersionByDatapointId[datapointId] = {});

    if (payloadByFromVersion[fromVersion]) return payloadByFromVersion[fromVersion];

    const datapointInfo = serverDatapoints.datapointInfos[datapointId] || {},
      { currentVersion = 0 } = datapointInfo;

    if (currentVersion <= fromVersion) return;

    // TODO handle diff for recent version
    return (payloadByFromVersion[fromVersion] = (datapointInfo.datapoint || {}).valueIfAny);
  }

  queueSendPayloads({ delay = 100 } = {}) {
    const serverDatapoints = this;

    if (delay <= 0) {
      serverDatapoints.sendPayloadsToClients();
      return;
    }

    if (serverDatapoints._sendPayloadsTimeout) return;
    serverDatapoints._sendPayloadsTimeout = setTimeout(() => {
      delete serverDatapoints._sendPayloadsTimeout;
      serverDatapoints.sendPayloadsToClients();
    }, delay);
  }

  sendPayloadsToClients() {
    const serverDatapoints = this;

    if (serverDatapoints._sendPayloadsTimeout) {
      clearTimeout(serverDatapoints._sendPayloadsTimeout);
      delete serverDatapoints._sendPayloadsTimeout;
    }

    const clientsWithPayloads = serverDatapoints.clientsWithPayloads;
    serverDatapoints.clientsWithPayloads = {};
    serverDatapoints.payloadByFromVersionByDatapointId = {};

    for (const clientDatapoints of Object.values(clientsWithPayloads)) {
      const newlyValidDatapoints = clientDatapoints.newlyValidDatapoints;
      clientDatapoints.newlyValidDatapoints = {};

      const diffByDatapointId = clientDatapoints.diffByDatapointId;
      clientDatapoints.diffByDatapointId = {};

      try {
        clientDatapoints.sendPayload({
          messageType: 'Models',
          payloadObject: {
            diffs: diffByDatapointId,
          },
        });
      } catch (err) {
        console.log(err);
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WSServerDatapoints,
  hasExposedBackDoor: true,
});
