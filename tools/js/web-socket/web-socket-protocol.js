const { applyDiff, createDiff } = require('../general/diff');
const PublicApi = require('../general/public-api');
const isEqual = require('../general/is-equal');
const ConvertIds = require('../datapoints/convert-ids');
const RequiredDatapoints = require('../datapoints/required-datapoints');
const log = require('../general/log');

const ValueHistoryLength = 1;

// API is auto-generated at the bottom from the public interface of the WebSocketProtocol class

class WebSocketConnection {
  constructor({ ws, wsp }) {
    const wsc = this,
      index = wsp.nextConnectionIndex++;

    Object.assign(wsc, {
      wsp,
      ws,
      index,
      datapoints: {},
      callbackKey: `wsc-${index}`,
      localDBRowIds: {},
    });

    ws.watch({
      callbackKey: wsc.callbackKey,
      onclose: () => {
        wsc.close();
      },
      onpayload: ({ messageType, payloadObject }) => {
        if (messageType == 'datapoints') {
          wsc.handleDatapointPayload(payloadObject);
        }
      },
    });

    wsp.connections[index] = wsc;

    if (!wsp.isServer) {
      for (const datapoint of wsp.cache.datapoints) {
        if (datapoint.isClient) continue;
        wsp.queueSendDatapoint({
          theirDatapointId: datapoint.datapointId,
          datapointId: datapoint.datapointId,
          index,
        });
      }
    }
  }

  close() {
    const wsc = this,
      { callbackKey, wsp, index, ws, datapoints } = wsc;

    ws.stopWatching({ callbackKey });

    for (const datapointId of Object.keys(datapoints)) wsc.deleteDatapoint(datapointId);

    delete wsp.connections[index];

    wsc.datapoints = {};
  }

  handleDatapointPayload(payloadObject) {
    const wsc = this,
      { ws } = wsc;

    if (!payloadObject || Array.isArray(payloadObject) || typeof payloadObject != 'object') return;

    for (const [theirDatapointId, msgData] of Object.entries(payloadObject)) {
      if (typeof msgData == 'number') {
        wsc.handleVersionNumber({ theirDatapointId, version: msgData });
      } else if (typeof msgData == 'object') {
        let { version, value, diff, baseVersion } = msgData;
        if (!version || !(value !== undefined || (diff !== undefined && baseVersion))) {
          log('err', `Bad msg data for datapoint ${theirDatapointId} ${JSON.stringify(msgData)}`);
          continue;
        }
        wsc.handleVersionValue({ theirDatapointId, version, value, diff, baseVersion });
      }
    }
  }

  // semi-async
  makeConcreteDatapointId(theirDatapointId) {
    const { rowProxy } = this.ws;
    if (!rowProxy) return theirDatapointId;
    const datapointInfo = rowProxy.makeConcrete({ datapointId: theirDatapointId });
    if (!datapointInfo) return 'unknown__1__';
    if (datapointInfo.then) return datapointInfo.then(datapointInfo => datapointInfo.datapointId);
    return datapointInfo.datapointId;
  }

  // other side is saying "I've got this version"
  // reply options are:
  // (A)  "I know" (no reply)
  // (B)  "Oh, that's higher that I mine" (reply with my version number)
  // (C)  "Well, I've got this higher version, which I haven't told you about" (reply with the diff to the newer version)
  // (D)  "Well, I've got this higher version, which I've already told you about" (reply with the value of the newer version)
  // the server also has to deal with:
  // (E)  "Oh, I didn't think you knew about that datapoint" (subscribe the client to datapoint changes)
  // (F)  "Version 0 eh, ok you're unsubscribed" (version 0 is the client's way of unsubscribing to updates for a datapoint)
  handleVersionNumber({ theirDatapointId, version }) {
    const wsc = this,
      { wsp, index, ws } = wsc;
    let cdatapoint = wsc.datapoints[theirDatapointId];

    if (!cdatapoint) {
      if (version == 0) return;

      if (!wsp.isServer) {
        if (version == 1) {
          const datapointId = wsc.makeConcreteDatapointId(theirDatapointId);
          if (datapointId.then) datapointId.then(handleDatapointId);
          else handleDatapointId(datapointId);

          function handleDatapointId(datapointId) {
            if (!datapointId) return;
            const datapoint = wsp.cache.getOrCreateDatapoint(datapointId);
            if (!datapoint.initialized) {
              datapoint.setAsInitializing();
              datapoint.setValue(undefined);
            }
          }
        }
        return;
      }

      cdatapoint = wsc.getOrCreateDatapoint(theirDatapointId);

      if (wsp.isServer && ws.rowProxy) {
        const { rowId, fieldName } = ConvertIds.decomposeId({ datapointId: theirDatapointId });
        const match = /^template_?(.*)$/.exec(fieldName);
        if (match) {
          const variant = match[1];
          wsp.requiredDatapoints
            .forView({ rowId, variant, rowProxy: ws.rowProxy, userId: ws.userId })
            .then(datapoints => {
              for (const [theirDatapointId, { datapoint, callbackKey }] of Object.entries(datapoints)) {
                const cdatapoint = wsc.getOrCreateDatapoint(theirDatapointId);
                if (cdatapoint.then) cdatapoint.then(handleCDatapoint);
                else handleCDatapoint(cdatapoint);

                function handleCDatapoint(cdatapoint) {
                  const datapointId = cdatapoint.datapointId || theirDatapointId;
                  wsp.queueSendDatapoint({ theirDatapointId, datapointId, index });
                  datapoint.stopWatching({ callbackKey });
                }
              }
            });
        }
      }
    }

    if (!version) {
      wsc.deleteDatapoint(theirDatapointId);
      return;
    }

    if (cdatapoint.then) cdatapoint.then(handleCDatapoint);
    else handleCDatapoint(cdatapoint);

    function handleCDatapoint(cdatapoint) {
      cdatapoint.theirVersion = version;
      if (cdatapoint.theirVersion == cdatapoint.myVersion) return;

      const datapointId = cdatapoint.datapointId || theirDatapointId;

      wsp.queueSendDatapoint({ theirDatapointId, datapointId, index });
    }
  }

  // other side is saying "Version msgData.version has value msgData.value"
  //   or "Version msgData.version is the result of applying msgData.diff to version msgData.baseVersion"
  // reply options are:
  // A  "Snap! I've got that too" (reply with my version number)
  // B  "Cool, that's higher that I mine and I've got the new value" (reply with my version number)
  // C  "Well, I've got this higher version" (reply with the value of the newer version)
  // D  "Um, I don't have that baseVersion you speak of" (reply with my version number)
  // E  "Eek, I tried that diff and it didn't fit" (reply with my version number)
  // the server also has to deal with:
  // F  "Oh, I didn't think you knew about that datapoint" (subscribe the client to datapoint changes)
  handleVersionValue({ theirDatapointId, version, value, diff, baseVersion }) {
    const wsc = this,
      { wsp, index } = wsc;
    let cdatapoint = wsc.datapoints[theirDatapointId];

    if (version <= 1) return;

    if (!cdatapoint) {
      // todo client should start a timer
      cdatapoint = wsc.getOrCreateDatapoint(theirDatapointId);
    }

    if (cdatapoint.then) cdatapoint.then(handleCDatapoint);
    else handleCDatapoint(cdatapoint);

    function handleCDatapoint(cdatapoint) {
      const datapointId = cdatapoint.datapointId || theirDatapointId;

      cdatapoint.theirVersion = version;

      if (cdatapoint.theirVersion > cdatapoint.myVersion) {
        if (baseVersion) {
          const pdatapoint = wsp.datapoints[datapointId];
          let base;
          for (const valueInfo of pdatapoint.values) {
            if (valueInfo.versionByConnectionIndex[index] == baseVersion) {
              base = valueInfo.value;
            }
          }
          if (base !== undefined) {
            value = applyDiff({ diff, base });
            if (value === undefined) {
              log(
                'err',
                `Couldn't apply diff for datapoint ${theirDatapointId}\n   Base: ${JSON.stringify(
                  base
                )}\n   Diff: ${JSON.stringify(diff)}`
              );
            }
          }
        }
        if (value !== undefined) {
          const datapoint = wsp.cache.getOrCreateDatapoint( datapointId );
          wsp.addDatapointValue({
            datapointId,
            value,
            versionByConnectionIndex: { [index]: cdatapoint.theirVersion },
          });
          if (wsp.isServer) {
            datapoint.updateValue({ newValue: value });
          } else {
            datapoint.setAsInitializing();
            datapoint.setValue(value);
          }
        }
      }

      wsp.queueSendDatapoint({ theirDatapointId, datapointId, index });
    }
  }

  deleteDatapoint(theirDatapointId) {
    const wsc = this,
      { wsp, index } = wsc,
      cdatapoint = wsc.datapoints[theirDatapointId];
    if (!cdatapoint) return;
    delete wsc.datapoints[theirDatapointId];

    const datapointId = cdatapoint.datapointId || theirDatapointId,
      pdatapoint = wsp.datapoints[datapointId];

    if (pdatapoint) {
      for (const valueInfo of pdatapoint.values) {
        delete valueInfo.versionByConnectionIndex[index];
      }
      delete pdatapoint.connectionIndexes[index][theirDatapointId];
      if (!Object.keys(pdatapoint.connectionIndexes[index]).length) {
        delete pdatapoint.connectionIndexes[index];

        if (!Object.keys(pdatapoint.connectionIndexes).length) {
          wsp.deleteDatapoint(datapointId);
        }
      }
    }
  }

  // semi-async
  getOrCreateDatapoint(theirDatapointId) {
    const wsc = this,
      { wsp, index } = wsc;
    let cdatapoint = wsc.datapoints[theirDatapointId];
    if (cdatapoint) return cdatapoint;

    const datapointId = wsc.makeConcreteDatapointId(theirDatapointId);
    if (datapointId.then) return datapointId.then(handleDatapointId);
    else return handleDatapointId(datapointId);

    function handleDatapointId(datapointId) {
      let pdatapoint = wsp.datapoints[datapointId];

      cdatapoint = wsc.datapoints[theirDatapointId] = {
        myVersion: 1,
        theirVersion: 0,
        datapointId: datapointId == theirDatapointId ? undefined : datapointId,
      };

      if (!pdatapoint) pdatapoint = wsp.getOrCreateDatapoint(datapointId);

      (pdatapoint.connectionIndexes[index] = pdatapoint.connectionIndexes[index] || {})[theirDatapointId] = true;

      if (pdatapoint.values.length) {
        cdatapoint.myVersion = 2 + (wsp.isServer ? 1 : 0);
      }
      return cdatapoint;
    }
  }

  payload({ theirDatapointId, datapointId, values }) {
    const wsc = this,
      { index, datapoints, wsp, ws } = wsc,
      cdatapoint = datapoints[theirDatapointId];

    if (!cdatapoint) return 1;

    if (!values.length) {
      cdatapoint.myVersion = 1;
      return 1;
    }

    const valueInfo = values[values.length - 1];

    let myVersion = valueInfo.versionByConnectionIndex[index];
    if (myVersion === undefined) {
      const maxVersion = Math.max(cdatapoint.theirVersion, cdatapoint.myVersion),
        nextEvenVersion = Math.floor(maxVersion / 2 + 1) * 2;
      myVersion = valueInfo.versionByConnectionIndex[index] = nextEvenVersion + (wsp.isServer ? 1 : 0);
    }
    cdatapoint.myVersion = myVersion;

    if (myVersion <= 1 || myVersion <= cdatapoint.theirVersion) return myVersion;

    const prevValueInfo = values.find(
      valueInfo => valueInfo.versionByConnectionIndex[index] === cdatapoint.theirVersion
    );
    if (prevValueInfo) {
      // TODO do a diff
    }

    let { value } = valueInfo;
    if (value && typeof value == 'object' && value.public !== undefined) {
      const { public: publicValue, private: privateValue, ownerId } = value,
        userId = ws.userId;
      value = (ownerId ? ownerId == userId : !userId) ? privateValue || publicValue : publicValue;
    }
    return { version: myVersion, value };
  }

  sendPayload({ payloadObject }) {
    this.ws.sendPayload({ messageType: 'datapoints', payloadObject });
  }
}

class WebSocketProtocol {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({ cache, dbConnection, ws, isServer }) {
    const wsp = this;

    wsp.isServer = isServer;
    wsp.dbConnection = dbConnection;
    wsp.cache = cache;
    wsp.requiredDatapoints = new RequiredDatapoints({ cache });
    wsp.queuedDatapoints = {};
    wsp.queueTimer = undefined;
    wsp.queueDelay = 1;
    wsp.datapoints = {};
    wsp.nextConnectionIndex = 1; //owned by WebSocketConnection
    wsp.connections = {}; //owned by WebSocketConnection

    const callbackKey = (wsp.callbackKey = 'wsp');
    ws.watch({
      callbackKey,
      onclientConnected: client => {
        new WebSocketConnection({ ws: client, wsp });
      },
      onopen: () => {
        new WebSocketConnection({ ws, wsp });
      },
    });

    if (!wsp.isServer) {
      cache.watch({
        callbackKey,
        onvalid: ({ newlyValidDatapoints }) => {
          for (const datapointId of newlyValidDatapoints) {
            if (wsp.datapoints[datapointId]) continue;
            const datapointInfo = ConvertIds.decomposeId({ datapointId });
            if (datapointInfo.proxyKey && datapointInfo.fieldName != 'id' && /^l\d+$/.test(datapointInfo.proxyKey)) {
              const dbRowIdDatapointId = ConvertIds.recomposeId(datapointInfo, { fieldName: 'id' }).datapointId;
              cache.getOrCreateDatapoint( dbRowIdDatapointId );
            }
            const datapoint = cache.getExistingDatapoint({ datapointId });
            if (!datapoint || datapoint.isClient) continue;
            for (const wsc of Object.values(wsp.connections)) {
              wsc.getOrCreateDatapoint(datapointId);
            }
            const pdatapoint = wsp.getOrCreateDatapoint(datapointId);
            if (!datapoint.initialized) {
              wsp.queueSendDatapoint({ datapointId, connectionIndexes: pdatapoint.connectionIndexes });
            } else {
              wsp.addDatapointValue({
                datapointId,
                value: datapoint.valueIfAny,
              });
            }
          }
        },
      });
    }
  }

  getOrCreateDatapoint(datapointId) {
    const wsp = this,
      { cache, callbackKey } = wsp;
    let pdatapoint = wsp.datapoints[datapointId];

    if (pdatapoint) return pdatapoint;
    pdatapoint = wsp.datapoints[datapointId] = {
      values: [],
      connectionIndexes: {},
    };

    const datapoint = cache.getOrCreateDatapoint( datapointId );
    datapoint.watch({
      callbackKey,
      onchange: datapoint => {
        const { valueIfAny: value, datapointId } = datapoint;
        wsp.addDatapointValue({
          datapointId,
          value,
        });
      },
    });
    if (datapoint.initialized && datapoint.valueIfAny != null)
      wsp.addDatapointValue({ datapointId, value: datapoint.valueIfAny });

    return pdatapoint;
  }

  addDatapointValue({ datapointId, value, versionByConnectionIndex = {} }) {
    if (value === undefined) value = null;

    const wsp = this;
    let pdatapoint = wsp.datapoints[datapointId];
    if (!pdatapoint) pdatapoint = wsp.getOrCreateDatapoint( datapointId );
    const { values } = pdatapoint;

    if (values.length && isEqual(value, values[values.length - 1].value)) {
      if (versionByConnectionIndex) {
        Object.assign(values[values.length - 1].versionByConnectionIndex, versionByConnectionIndex);
      }
      return;
    }

    values.push({
      value,
      versionByConnectionIndex,
    });

    if (values.length > ValueHistoryLength) values.shift();

    wsp.queueSendDatapoint({ datapointId, connectionIndexes: pdatapoint.connectionIndexes });
  }

  deleteDatapoint(datapointId) {
    const wsp = this,
      { cache, callbackKey } = wsp,
      pdatapoint = wsp.datapoints[datapointId];

    if (!pdatapoint || Object.keys(pdatapoint.connectionIndexes).length) return;

    const datapoint = cache.getExistingDatapoint({ datapointId });
    if (datapoint) datapoint.stopWatching({ callbackKey });

    delete wsp.datapoints[datapointId];
  }

  queueSendDatapoint({ theirDatapointId, datapointId, index, connectionIndexes }) {
    const wsp = this,
      indexes = (wsp.queuedDatapoints[datapointId] = wsp.queuedDatapoints[datapointId] || {});
    if (index && theirDatapointId) {
      const theirDatapointIds = (indexes[index] = Object.assign({}, indexes[index]) || {});
      theirDatapointIds[theirDatapointId] = true;
    }
    if (connectionIndexes) Object.assign(indexes, connectionIndexes);

    if (wsp.queueTimer === undefined) {
      wsp.queueTimer = setTimeout(() => {
        const queuedDatapoints = wsp.queuedDatapoints;
        wsp.queuedDatapoints = {};
        wsp.sendDatapoints(queuedDatapoints);
      }, wsp.queueDelay);
    }
  }

  sendDatapoints(datapoints) {
    const wsp = this,
      { cache } = wsp;

    if (wsp.queueTimer !== undefined) {
      clearTimeout(wsp.queueTimer);
      wsp.queueTimer = undefined;
    }

    const payloadObjects = {};

    for (const [datapointId, theirDatapointIdsByIndex] of Object.entries(datapoints)) {
      const pdatapoint = wsp.datapoints[datapointId];
      if (!pdatapoint) continue;

      const { values } = pdatapoint;

      for (const [index, theirDatapointIds] of Object.entries(theirDatapointIdsByIndex)) {
        const wsc = wsp.connections[index];
        if (!wsc) continue;
        //if (wsp.isServer && (wsc.msgCount = (wsc.msgCount || 0) + 1) > 20) continue;

        const payloadObject = (payloadObjects[index] = payloadObjects[index] || {});
        for (const theirDatapointId of Object.keys(theirDatapointIds)) {
          payloadObject[theirDatapointId] = wsc.payload({ theirDatapointId, datapointId, values, pdatapoint });
        }
      }
    }
    for (const [index, payloadObject] of Object.entries(payloadObjects)) {
      wsp.connections[index].sendPayload({ payloadObject });
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketProtocol,
  hasExposedBackDoor: true,
});
