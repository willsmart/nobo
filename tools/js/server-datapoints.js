const PublicApi = require('./general/public-api');
const ConvertIds = require('./convert-ids');
const ChangeCase = require('change-case');
const RequiredDatapoints = require('./required-datapoints');

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

    for (const [datapointId, datapoint] of Object.entries(clientDatapoints.subscribedDatapoints)) {
      if (!datapoint) continue;
      datapoint.stopWatching({
        callbackKey: `${clientDatapoints.callbackKey}__${datapointId}`,
      });
      serverDatapoints.releaseRefForDatapoint(datapoint);
    }
    clientDatapoints.subscribedDatapoints = {};
    clientDatapoints.diffByDatapointId = {};
    clientDatapoints.clientDatapointVersions = {};
    delete serverDatapoints.clientsWithPayloads[clientDatapoints.index];
  }

  async subscribe({ datapointId, rowProxy, userId }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints;

    if (clientDatapoints.subscribedDatapoints.hasOwnProperty(datapointId))
      return clientDatapoints.subscribedDatapoints[datapointId];

    const nonProxyDatapointInfo = await rowProxy.makeConcrete({ datapointId });

    let datapoint;
    if (nonProxyDatapointInfo) {
      ({ datapoint } = serverDatapoints.addRefForDatapoint({
        datapointId: nonProxyDatapointInfo.datapointId,
      }));

      const isTemplate = datapoint.fieldName && datapoint.fieldName.startsWith('template');

      datapoint.watch({
        callbackKey: `${clientDatapoints.callbackKey}__${datapointId}`,
        onvalid: () => {
          clientDatapoints.queueSendDiff({ datapointId, datapoint, isTemplate, userId });
        },
      });

      clientDatapoints.subscribedDatapoints[datapointId] = datapoint;

      if (isTemplate) {
        const variant = ChangeCase.camelCase(datapoint.fieldName.substring('template'.length)) || undefined,
          rowId = ConvertIds.decomposeId({ datapointId }).rowId;

        const requiredDatapointCallbackKeys = await serverDatapoints.requiredDatapoints.forView({
          rowId,
          variant,
          rowProxy,
          userId,
        });

        clientDatapoints.queueSendDiff({ datapointId, datapoint, isTemplate, userId });

        for (const [datapointId, { datapoint, callbackKey }] of Object.entries(requiredDatapointCallbackKeys)) {
          await clientDatapoints.subscribe({ datapointId, rowProxy, userId });
          if (datapoint) datapoint.stopWatching({ callbackKey });
        }
        return;
      }

      clientDatapoints.queueSendDiff({ datapointId, datapoint, isTemplate, userId });
    }
  }

  unsubscribe({ datapointId }) {
    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints,
      datapoint = clientDatapoints.subscribedDatapoints[datapointId];

    delete clientDatapoints.subscribedDatapoints[datapointId];

    if (datapoint) {
      datapoint.stopWatching({
        callbackKey: `${clientDatapoints.callbackKey}__${datapointId}`,
      });
      serverDatapoints.releaseRefForDatapoint(datapoint);
    }
  }

  queueSendDiff({ datapointId, datapoint, isTemplate, userId }) {
    let datapointIdKey = datapointId,
      value = datapoint.valueIfAny;

    if (isTemplate && value && typeof value == 'object') {
      const isOwner = value.ownerId && value.ownerId == userId;
      if (isOwner) datapointIdKey = `owner ${datapointIdKey}`;
      value = value[isOwner ? 'private' : 'public'];
    }

    const clientDatapoints = this,
      serverDatapoints = clientDatapoints.serverDatapoints,
      nonProxyDatapointId = datapoint ? datapoint.datapointId : undefined;

    if (clientDatapoints.diffByDatapointId[datapointId]) return;

    const clientVersionInfo = clientDatapoints.clientDatapointVersions[datapointId],
      { sentVersion = 0, hasVersion = 0 } = clientVersionInfo || {};

    if (sentVersion != hasVersion) return;

    const diff = datapoint
      ? serverDatapoints.diffForDatapoint({
          datapointIdKey,
          nonProxyDatapointId,
          value,
          fromVersion: hasVersion,
        })
      : '';
    if (diff === undefined) return;

    if (clientVersionInfo) clientVersionInfo.sentVersion = undefined;
    else
      clientDatapoints.clientDatapointVersions[datapointId] = {
        hasVersion,
        sentVersion: undefined, //TODO
      };
    clientDatapoints.diffByDatapointId[datapointId] = diff;
    serverDatapoints.clientsWithPayloads[clientDatapoints.index] = clientDatapoints;

    serverDatapoints.queueSendPayloads();

    return diff;
  }

  handlePayload({ payloadObject, rowProxy, userId }) {
    const clientDatapoints = this;

    if (payloadObject.datapoints)
      clientDatapoints.recievedDatapointsFromClient({ datapoints: payloadObject.datapoints, rowProxy, userId });
  }

  recievedDatapointsFromClient({ datapoints: datapointsFromClient, rowProxy, userId }) {
    const clientDatapoints = this;

    for (let [datapointId, datapointFromClient] of Object.entries(datapointsFromClient)) {
      if (datapointFromClient === 0)
        datapointFromClient = {
          unsubscribe: true,
        };
      else if (datapointFromClient === 1)
        datapointFromClient = {
          subscribe: true,
        };

      const isSubscribed = clientDatapoints.subscribedDatapoints.hasOwnProperty(datapointId),
        subscribedDatapoint = clientDatapoints.subscribedDatapoints[datapointId],
        { ackVersion, unsubscribe, subscribe, diff } = datapointFromClient;

      if (isSubscribed) {
        if (unsubscribe) {
          clientDatapoints.unsubscribe({
            datapointId,
          });
          continue;
        }
        if (ackVersion) {
          let clientVersionInfo = clientDatapoints.clientDatapointVersions[datapointId];
          const { hasVersion = 0 } = clientVersionInfo || {};

          if (hasVersion != ackVersion) {
            if (!clientVersionInfo)
              clientVersionInfo = clientDatapoints.clientDatapointVersions[datapointId] = {
                hasVersion: ackVersion,
                sentVersion: ackVersion,
              };
            else clientVersionInfo.hasVersion = ackVersion;

            clientDatapoints.queueSendDiff({ datapointId, datapoint: subscribedDatapoint });
          }
        }
        if (diff) {
          // TODO
        }
      } else if (subscribe) {
        clientDatapoints.subscribe({
          datapointId,
          rowProxy,
          userId,
        });
      }
    }
  }
}

class WSServerDatapoints {
  // public methods
  static publicMethods() {
    return ['requiredDatapoints'];
  }

  constructor({ wsserver }) {
    const serverDatapoints = this;

    const cache = (serverDatapoints._cache = wsserver.cache);
    serverDatapoints._requiredDatapoints = new RequiredDatapoints({ cache });

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

    cache.watch({
      callbackKey,
      onvalid: () => {
        serverDatapoints.sendPayloadsToClients();
      },
    });
  }

  get requiredDatapoints() {
    return this._requiredDatapoints;
  }

  get cache() {
    return this._cache;
  }

  setRequiredDatapoints({ datapointId, requiredDatapointCallbackKeys }) {
    const serverDatapoints = this,
      datapointInfo = serverDatapoints.datapointInfos[datapointId],
      ret = [];
    if (!datapointInfo) {
      return ret;
    }

    const requiredDatapointIdsWere = Object.keys(datapointInfo.requiredDatapointCallbackKeys);

    for (const [requiredDatapointId, callbackKey] of Object.entries(requiredDatapointCallbackKeys)) {
      if (!datapointInfo.requiredDatapointCallbackKeys[requiredDatapointId]) {
        ret.push(
          serverDatapoints.addRefForDatapoint({
            datapointId: requiredDatapointId,
            requiredByDatapointId: datapointId,
            callbackKey,
          })
        );
      } else ret.push(serverDatapoints.datapointInfos[requiredDatapointId]);
    }
    for (const requiredDatapointId of requiredDatapointIdsWere) {
      if (!requiredDatapointCallbackKeys[requiredDatapointId]) {
        serverDatapoints.releaseRefForDatapoint({
          datapointId: requiredDatapointId,
          requiredByDatapointId: datapointId,
          callbackKey: datapointInfo.requiredDatapointCallbackKeys[requiredDatapointId],
        });
      }
    }

    return ret;
  }

  addRefForDatapoint({ datapointId, requiredByDatapointId, callbackKey }) {
    const serverDatapoints = this,
      datapoint = serverDatapoints.cache.getOrCreateDatapoint({
        datapointId,
      });

    let datapointInfo = serverDatapoints.datapointInfos[datapointId];

    if (requiredByDatapointId && callbackKey) {
      let parentDatapointInfo = serverDatapoints.datapointInfos[requiredByDatapointId];
      if (!parentDatapointInfo) {
        datapoint.stopWatching({ callbackKey });
        return;
      }

      const { requiredDatapointCallbackKeys } = parentDatapointInfo;
      if (requiredDatapointCallbackKeys[datapointId]) {
        datapoint.stopWatching({ callbackKey });
        return datapointInfo;
      }

      requiredDatapointCallbackKeys[datapointId] = callbackKey;
    }

    if (datapointInfo) {
      datapointInfo.refCnt++;
    } else {
      datapointInfo = serverDatapoints.datapointInfos[datapointId] = {
        datapoint,
        requiredDatapointCallbackKeys: {},
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

  releaseRefForDatapoint({ datapointId, requiredByDatapointId }) {
    const serverDatapoints = this,
      datapointInfo = serverDatapoints.datapointInfos[datapointId];

    if (!datapointInfo) return;

    if (requiredByDatapointId && callbackKey) {
      let parentDatapointInfo = serverDatapoints.datapointInfos[requiredByDatapointId];
      if (!parentDatapointInfo) return;

      const { requiredDatapointCallbackKeys } = parentDatapointInfo;
      if (!requiredDatapointCallbackKeys[datapointId]) return datapointInfo;

      const datapoint = serverDatapoints.cache.getExistingDatapoint({
        datapointId,
      });
      if (datapoint) datapoint.stopWatching({ callbackKey: requiredDatapointCallbackKeys[datapointId] });
      delete requiredDatapointCallbackKeys[datapointId];
    }

    if (!--datapointInfo.refCnt) {
      for (const [requiredDatapointId, callbackKey] of Object.entries(datapointInfo.requiredDatapointCallbackKeys)) {
        serverDatapoints.releaseRefForDatapoint({ datapointId: requiredDatapointId });

        const datapoint = serverDatapoints.cache.getExistingDatapoint({
          datapointId,
        });
        if (datapoint) datapoint.stopWatching({ callbackKey });
      }

      datapointInfo.datapoint.stopWatching({
        callbackKey,
      });
      delete serverDatapoints.datapointInfos[datapointId];
      return;
    }
    return datapointInfo;
  }

  diffForDatapoint({ datapointIdKey, nonProxyDatapointId, value, fromVersion }) {
    const serverDatapoints = this,
      payloadByFromVersion = serverDatapoints.payloadByFromVersionByDatapointId[datapointIdKey]
        ? serverDatapoints.payloadByFromVersionByDatapointId[datapointIdKey]
        : (serverDatapoints.payloadByFromVersionByDatapointId[datapointIdKey] = {});

    if (payloadByFromVersion.hasOwnProperty(fromVersion)) return payloadByFromVersion[fromVersion];

    const datapointInfo = serverDatapoints.datapointInfos[nonProxyDatapointId] || {},
      { currentVersion = 0 } = datapointInfo;

    if (currentVersion <= fromVersion) return;

    // TODO handle diff for recent version
    return (payloadByFromVersion[fromVersion] = value === undefined ? null : value);
  }

  queueSendPayloads({ delay = 1 } = {}) {
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
