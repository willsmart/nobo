const PublicApi = require('../general/public-api');
const log = require('../general/log');
const isEqual = require('../general/is-equal');
const ConvertIds = require('../datapoints/convert-ids');

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
      subscribedClients: {},
      myValue: undefined,
      myValueSource: undefined,
    });

    datapoint.deletionCallbacks.push(() => wsp.deleteDatapoint(datapointId));

    datapoint.watch({
      callbackKey: 'wsd',
      onchange: ({ valueIfAny }) => {
        const cameFromClient = wsd.myValueSource && isEqual(wsd.myValue, valueIfAny, { exact: true });

        for (const client of Object.values(wsd.subscribedClients)) {
          if (cameFromClient && wsd.myValueSource == client.id) continue;
          client.myVersion = Math.floor(Math.max(client.myVersion, client.theirVersion) / 2) * 2 + 2;
        }

        let clients = wsd.subscribedClients;
        if (cameFromClient) {
          clients = Object.assign({}, clients);
          delete clients[wsd.myValueSource];
        }

        wsd.myValue = valueIfAny;
        wsd.myValueSource = 'cache';

        wsp.queueSendDatapoint(datapointId, clients);
      },
    });
  }

  get valueIfAny() {
    return this.myValue;
  }

  handleClientPayload(clientId, payloadValue) {
    const wsd = this,
      { subscribedClients, wsp, datapointId, datapoint } = wsd;

    if (payloadValue === false) {
      delete subscribedClients[clientId];
      if (!Object.keys(subscribedClients).length) {
        wsp.deleteDatapoint(datapointId);
      }
      return;
    }

    let client = subscribedClients[clientId];

    if (typeof payloadValue == 'number') {
      const version = payloadValue;

      if (!client) {
        client = subscribedClients[clientId] = {
          myVersion: Math.floor(version / 2) * 2 + 2,
          theirVersion: version,
        };
        datapoint.value.then(value => {
          wsd.myValue = value;
          wsd.myValueSource = 'cache';

          wsp.queueSendDatapoint(datapointId, { [clientId]: client });
        });
        return;
      }

      if (client.theirVersion == version) return;
      client.theirVersion = version;
      if (client.myVersion != version) {
        datapoint.value.then(value => {
          wsd.myValue = value;
          wsd.myValueSource = 'cache';

          wsp.queueSendDatapoint(datapointId, { [clientId]: client });
        });
      }
    } else if (payloadValue && typeof payloadValue == 'object' && payloadValue.version) {
      const { version, value } = payloadValue;

      if (!client) {
        client = subscribedClients[clientId] = {
          myVersion: version,
          theirVersion: version,
        };
      } else {
        if (client.myVersion == version) return;
        client.myVersion = version;
      }

      if (!isEqual(wsd.myValue, value, { exact: true })) {
        wsd.myValue = value;
        wsd.myValueSource = clientId;
        wsd.datapoint.setValue(value);
      }

      wsp.queueSendDatapoint(datapointId, { [clientId]: client });
    }
  }
}

class WebSocketClient {
  constructor({ ws, wsp }) {
    const wsc = this;

    Object.assign(wsc, {
      wsp,
      ws,
      datapoints: {},
      id: wsp.nextClientId++,
    });

    ws.watch({
      callbackKey: `wsc#${wsc.id}`,
      onclose: () => {
        wsc.ws = undefined;
        const datapoints = wsc.datapoints;
        wsc.datapoints = {};
        for (const datapoint of Object.values(datapoints)) {
          datapoint.handleClientPayload(wsc.id, false);
        }
        wsp.deleteClient(wsc.id);
      },
      onpayload: ({ messageType, payloadObject }) => {
        if (messageType == 'datapoints') {
          for (let [datapointId, payloadValue] of Object.entries(payloadObject)) {
            const datapointInfo = ConvertIds.decomposeId({ datapointId });
            if (datapointInfo.proxyKey) {
              datapointInfo.proxyKey = `client${wsc.id}_${datapointInfo.proxyKey}`;
              datapointId = ConvertIds.recomposeId(datapointInfo).datapointId;
            }
            wsp.getOrCreateDatapoint(datapointId).handleClientPayload(wsc.id, payloadValue);
          }
        }
      },
    });
  }

  getRowIdForProxyKey({ typeName, proxyKey }) {
    const wsc = this,
      { ws } = wsc,
      { rowProxy } = ws;
    if (!rowProxy) return;
    const concreteRowInfo = rowProxy.makeConcrete({ rowId: ConvertIds.recomposeId({ typeName, proxyKey }).rowId });
    return typeof concreteRowInfo != 'object'
      ? undefined
      : concreteRowInfo.then
        ? concreteRowInfo.then(concreteRowInfo => (concreteRowInfo ? concreteRowInfo.rowId : undefined))
        : concreteRowInfo.rowId;
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
      clients: {},
      nextClientId: 1,
    });

    cache.getterSetterInfo.finders.push([
      function({ datapoint, schema }) {
        const { typeName, proxyKey: baseProxyKey, fieldName } = datapoint,
          type = schema.allTypes[typeName];

        if (!type || datapoint.isClient || !baseProxyKey || fieldName != 'rowId') return;

        const match = /^client(\d+)_(l\d+)$/.exec(baseProxyKey);
        if (!match) return;
        const clientId = match[1],
          proxyKey = match[2];

        function evaluate() {
          const client = wsp.clients[clientId];
          if (!client) return;

          return client.getRowIdForProxyKey({ typeName, proxyKey });
        }

        return {
          getter: {
            fn: evaluate,
          },
          setter: {
            fn: evaluate,
          },
        };
      },
      'wsp',
    ]);

    ws.watch({
      callbackKey: 'wsp',
      onclientConnected: client => {
        const wsc = new WebSocketClient({ ws: client, wsp });
        wsp.clients[wsc.id] = wsc;
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
      { datapoints } = wsp,
      wsd = datapoints[datapointId];
    if (wsd) {
      delete datapoints[datapointId];
      wsp.queueSendDatapoint(datapointId, wsd.subscribedClients);
    }
  }

  deleteClient(clientId) {
    delete this.clients[clientId];
  }

  queueSendDatapoint(datapointId, clients) {
    const wsp = this,
      { queuedDatapoints, sendDelay } = wsp;

    if (datapointId) {
      const wsd = wsp.datapoints[datapointId];
      if (wsd && !wsd.datapoint.valid) {
        wsd.datapoint.value.then(() => {
          wsp.queueSendDatapoint(datapointId, clients);
        });
        return;
      }
      if (!queuedDatapoints[datapointId]) queuedDatapoints[datapointId] = { clients: {} };
      if (clients) Object.assign(queuedDatapoints[datapointId].clients, clients);
    }

    if (!wsp.queueTimeout)
      wsp.queueTimeout = setTimeout(() => {
        wsp.queueTimeout = undefined;
        wsp.goSendDatapoints();
      }, sendDelay);
  }

  goSendDatapoints() {
    const wsp = this,
      { queuedDatapoints, datapoints } = wsp;

    wsp.queuedDatapoints = {};

    const payloadObjects = {};

    for (const [datapointId, { clients }] of Object.entries(queuedDatapoints)) {
      const wsd = datapoints[datapointId];

      for (const clientId of Object.keys(clients)) {
        const wscd = wsd && wsd.subscribedClients[clientId];

        let payload;
        if (!wscd) {
          payload = false;
        } else if (wscd.myVersion == wscd.theirVersion) {
          payload = wscd.myVersion;
        } else if (wscd.myVersion > wscd.theirVersion) {
          payload = {
            version: wscd.myVersion,
            value: wsd.myValue,
          };
        }

        if (payload !== undefined) {
          const payloadObject = payloadObjects[clientId] || (payloadObjects[clientId] = {});

          let localDatapointId = datapointId;
          const datapointInfo = ConvertIds.decomposeId({ datapointId });
          if (datapointInfo.proxyKey) {
            const prefix = `client${clientId}_`;
            if (!datapointInfo.proxyKey.startsWith(prefix)) continue;
            datapointInfo.proxyKey = datapointInfo.proxyKey.substring(prefix.length);
            localDatapointId = ConvertIds.recomposeId(datapointInfo).datapointId;
          }

          payloadObject[localDatapointId] = payload;
        }
      }
    }

    for (const [clientId, payloadObject] of Object.entries(payloadObjects)) {
      const client = wsp.clients[clientId];
      if (!(client && client.ws && Object.keys(payloadObjects).length)) continue;
      client.ws.sendPayload({ messageType: 'datapoints', payloadObject });
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketProtocol,
  hasExposedBackDoor: true,
});
