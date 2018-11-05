const PublicApi = require('../general/public-api');
const log = require('../general/log');
const isEqual = require('../general/is-equal');

// API is auto-generated at the bottom from the public interface of the WebSocketProtocol class

class WebSocketDatapoint {
  constructor({ datapointId, wsp }) {
    const wsd = this,
      { cache } = wsp;

    const datapoint = cache.getOrCreateDatapoint(datapointId);

    Object.assign(wsd, {
      datapointId,
      datapoint,
      wsp,
      myVersion: 1,
      theirVersion: 1,
      myValue: undefined,
      resolvers: [],
    });

    datapoint.deletionCallbacks.push(() => wsp.deleteDatapoint(datapointId));

    wsp.queueSendDatapoint(datapointId);
  }

  get valueIfAny() {
    return this.myValue;
  }

  get value() {
    const wsd = this,
      { myVersion, theirVersion } = wsd;
    if (theirVersion > 1 && myVersion >= theirVersion) return wsd.myValue;
    return new Promise(resolve => {
      wsd.resolvers.push(resolve);
    });
  }

  setValue(newValue) {
    const wsd = this,
      { myVersion, theirVersion, datapointId, resolvers, wsp } = wsd;
    wsd.myVersion = Math.floor((Math.max(myVersion, theirVersion) + 1) / 2) * 2 + 1;
    wsd.myValue = newValue === null ? undefined : newValue;

    if (resolvers.length) {
      wsd.resolvers = [];
      for (const resolver of resolvers) {
        resolver(newValue);
      }
    }
    wsp.queueSendDatapoint(datapointId);
  }
}

class WebSocketProtocol {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({ cache, ws }) {
    const wsp = this;

    Object.assign(wsp, {
      cache,
      ws,
      datapoints: {},
      sendDelay: 10,
      queueTimeout: undefined,
      queuedDatapoints: {},
      client: undefined,
    });

    cache.getterSetterInfo.finders.push(function({ datapoint, cache, schema }) {
      const { typeName, datapointId } = datapoint,
        type = schema.allTypes[typeName];

      if (!type || datapoint.isClient) return;

      return {
        getter: {
          fn: () => wsp.getOrCreateDatapoint(datapointId).value,
        },
        setter: {
          fn: newValue => {
            wsp.getOrCreateDatapoint(datapointId).setValue(newValue);
            return newValue;
          },
        },
      };
    });

    ws.watch({
      callbackKey: 'wsp',
      onclose: () => {
        wsp.client = undefined;

        for (const wsd of Object.values(wsp.datapoints)) {
          wsd.myVersion = wsd.myVersion > wsd.theirVersion ? 3 : 1;
          wsd.theirVersion = 2;
        }
      },
      onopen: client => {
        wsp.client = ws;
        wsp.queueSendDatapoint();
      },
      onpayload: ({ messageType, payloadObject }) => {
        if (messageType == 'datapoints' || !payloadObject || typeof payloadObject != 'object') {
          for (const [datapointId, payloadValue] of Object.entries(payloadObject)) {
            const wsd = wsp.getOrCreateDatapoint(datapointId);
            if (typeof payloadValue == 'number') {
              const version = payloadValue;
              if (wsd.theirVersion == version) continue;
              wsd.theirVersion = version;
              if (wsd.myVersion != version) {
                wsp.queueSendDatapoint(datapointId);
              }
            } else if (payloadValue && typeof payloadValue == 'object' && payloadValue.version) {
              let { version, value } = payloadValue;
              if (value === null) value = undefined;
              if (wsd.theirVersion == version) continue;
              wsd.theirVersion = version;
              if (wsd.myVersion != version) {
                if (wsd.myVersion > version) {
                  wsp.queueSendDatapoint(datapointId);
                }
                if (wsd.myVersion < version) {
                  wsd.myVersion = version;
                  if (!isEqual(value, wsd.myValue, { exact: true })) {
                    wsd.myValue = value;
                    wsd.datapoint.invalidate();
                  }
                  const { resolvers } = wsd;
                  if (resolvers.length) {
                    wsd.resolvers = [];
                    for (const resolver of resolvers) {
                      resolver(value);
                    }
                  }
                }
              }
            }
          }
        }
      },
    });
  }

  getExistingDatapoint(datapointId) {
    const wsp = this,
      { datapoints } = wsp;
    return datapoints[datapointId];
  }

  getOrCreateDatapoint(datapointId) {
    const wsp = this,
      { datapoints } = wsp,
      existingDatapoint = datapoints[datapointId];
    if (existingDatapoint) return existingDatapoint;
    return (datapoints[datapointId] = new WebSocketDatapoint({ datapointId, wsp }));
  }

  deleteDatapoint(datapointId) {
    const wsp = this,
      { datapoints } = wsp;
    delete datapoints[datapointId];
    wsp.queueSendDatapoint(datapointId);
  }

  queueSendDatapoint(datapointId) {
    const wsp = this,
      { queuedDatapoints, sendDelay } = wsp;

    if (datapointId) queuedDatapoints[datapointId] = true;

    if (!wsp.queueTimeout)
      wsp.queueTimeout = setTimeout(() => {
        wsp.queueTimeout = undefined;
        wsp.goSendDatapoints();
      }, sendDelay);
  }

  goSendDatapoints() {
    const wsp = this,
      { queuedDatapoints, datapoints, client } = wsp,
      datapointIds = Object.keys(queuedDatapoints);

    if (!client) return;

    wsp.queuedDatapoints = {};

    const payloadObject = {};

    for (const datapointId of datapointIds) {
      const wsd = datapoints[datapointId];

      if (!wsd) {
        payloadObject[datapointId] = false;
      } else if (wsd.myVersion == wsd.theirVersion) {
        payloadObject[datapointId] = wsd.myVersion;
      } else if (wsd.myVersion > wsd.theirVersion) {
        payloadObject[datapointId] = {
          version: wsd.myVersion,
          value: wsd.myValue === undefined ? null : wsd.myValue,
        };
      }
    }

    if (!Object.keys(payloadObject).length) return;

    client.sendPayload({ messageType: 'datapoints', payloadObject });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketProtocol,
  hasExposedBackDoor: true,
});
