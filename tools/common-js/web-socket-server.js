const WebSocket = require("ws");
const ConvertIds = require("./convert_ids");
const SchemaDefn = require("./schema");
const PublicApi = require("./public_api");

// API is auto-generated at the bottom from the public interface of this class

class WebSocketServer {
  // public methods
  static publicMethods() {
    return ["start", "newVersionAvailableForViews"];
  }

  constructor({ cache }) {
    const wsserver = this;

    if ((wsserver.cache = cache)) cache.wsserver = wsserver;
    wsserver.views = {};
    wsserver.proxiesByRowId = {};
    wsserver.cache.addNewViewVersionCallback({
      key: "wsserver",
      callback: function(viewIds) {
        wsserver.newVersionAvailableForViews(viewIds);
      }
    });
  }

  start() {
    const server = this;

    server.wss = new WebSocket.Server({
      port: 3100
    });

    var nextWsIndex = 1;

    server.wss.on("connection", function connection(ws, req) {
      ws.isAlive = true;

      console.log(req.headers);

      var client = new WebSocketClient({ server: server, ws: ws, index: nextWsIndex++ });

      ws.on("pong", heartbeat);

      ws.on("message", function incoming(message) {
        client.serverReceivedMessage(message);
      });

      ws.on("close", function close() {
        client.closed();
      });

      ws.on("error", () => console.log("errored"));
    });

    function heartbeat() {
      this.isAlive = true;
    }

    const interval = setInterval(function ping() {
      server.wss.clients.forEach(function each(ws) {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.ping("", false, true);
      });
    }, 30000);
  }

  newVersionAvailableForViews(viewIds) {
    const server = this;

    const payloadByClientId = {};

    const handleNewViewVersionThroughProxy = (viewIdInfo, proxyableViewIdInfo, filteredClientIds) => {
      const viewInfo = server.views[proxyableViewIdInfo.proxyableViewId];
      if (!viewInfo) return;
      const clientIndexes = filteredClientIds || Object.keys(viewInfo.subscribedClients);
      if (!clientIndexes.length) {
        delete server.views[proxyableViewIdInfo.proxyableViewId];
        return;
      }

      const version = server.cache.getLatestViewVersionIfAny(viewIdInfo);
      if (
        !version ||
        (viewInfo.latestVersionByViewId[viewIdInfo.viewId] &&
          viewInfo.latestVersionByViewId[viewIdInfo.viewId].version == version.version)
      )
        return;

      viewInfo.latestVersionByViewId[viewIdInfo.viewId] = version;
      const diffsByOwnershipByFromVersion = {};
      clientIndexes.forEach(clientIndex => {
        const client = viewInfo.subscribedClients[clientIndex];
        if (!client) return;
        const clientInfo = client.subscriptions[proxyableViewIdInfo.proxyableViewId];
        const isOwner = true;
        if (!clientInfo || clientInfo.clientHasVersion != clientInfo.clientSentVersion) return;
        const diffsByOwnership =
          diffsByOwnershipByFromVersion[clientInfo.clientHasVersion] ||
          (diffsByOwnershipByFromVersion[clientInfo.clientHasVersion] = {});
        let diff = diffsByOwnership[isOwner];
        if (!diff) {
          diff = diffsByOwnership[isOwner] = version; // TODO
        }

        const clientPayload = (
          payloadByClientId[clientIndex] ||
          (payloadByClientId[clientIndex] = {
            client: client,
            payload: {}
          })
        ).payload;
        clientPayload[proxyableViewIdInfo.proxyableViewId] = {
          diff: diff,
          from: clientInfo.clientHasVersion,
          to: version.version
        };
        clientInfo.clientSentVersion = version.version;
      });
    };

    viewIds.forEach(viewId => {
      const viewIdInfo = ConvertIds.decomposeId({ viewId: viewId });
      handleNewViewVersionThroughProxy(viewIdInfo, viewIdInfo);
      const proxiesByClientIndex = server.proxiesByRowId[viewIdInfo.rowId];
      if (proxiesByClientIndex) {
        Object.keys(proxiesByClientIndex).forEach(clientIndex => {
          const proxies = proxiesByClientIndex[clientIndex];
          Object.keys(proxies).forEach(proxyRowId => {
            const proxy = proxies[proxyRowId];
            const proxyViewIdInfo = ConvertIds.recomposeId(proxy.proxyRowIdInfo, {
              variant: viewIdInfo.variant
            });
            handleNewViewVersionThroughProxy(viewIdInfo, proxyViewIdInfo, [clientIndex]);
          });
        });
      }
    });

    Object.keys(payloadByClientId).forEach(clientIndex => {
      const payload = payloadByClientId[clientIndex];
      const stringPayload = "Models:" + JSON.stringify(payload.payload);
      try {
        payload.client.ws.send(stringPayload);
      } catch (err) {
        console.log(err);
      }
    });
  }
}

class WebSocketClient {
  constructor({ server, ws, index }) {
    this.server = server;
    this.ws = ws;
    this.index = index;
    this.proxyByProxyRowId = {};
    this.subscriptions = {};
    this.mapProxyRowId(
      ConvertIds.recomposeId({ typeName: "App", proxyKey: "default" }).proxyableRowId,
      ConvertIds.recomposeId({ typeName: "App", dbRowId: 1 }).rowId
    );
    this.login(1);
  }

  login(userId) {
    if (userId) {
      this.mapProxyRowId(
        ConvertIds.recomposeId({ typeName: "User", proxyKey: "me" }).proxyableRowId,
        ConvertIds.recomposeId({ typeName: "User", dbRowId: userId }).rowId
      );
      this.mapProxyRowId(
        ConvertIds.recomposeId({ typeName: "User", proxyKey: "default" }).proxyableRowId,
        ConvertIds.recomposeId({ typeName: "User", dbRowId: userId }).rowId
      );
    } else {
      this.mapProxyRowId(
        ConvertIds.recomposeId({ typeName: "User", proxyKey: "me" }).proxyableproxyableRowIdViewId,
        ConvertIds.recomposeId({ typeName: "App", dbRowId: 1 }).rowId
      );
      this.mapProxyRowId(
        ConvertIds.recomposeId({ typeName: "User", proxyKey: "default" }).proxyableRowId,
        ConvertIds.recomposeId({ typeName: "App", dbRowId: 1 }).rowId
      );
    }
  }

  logout() {
    this.login();
  }

  mapProxyRowId(proxyRowId, rowId) {
    const client = this;
    const server = client.server;

    client.unmapProxyViewId(proxyRowId);
    if (!rowId) return;

    const proxy = {
      client: client,
      proxyRowId: proxyRowId,
      proxyRowIdInfo: ConvertIds.decomposeId({ proxyableRowId: proxyRowId }),
      rowId: rowId,
      rowIdInfo: ConvertIds.decomposeId({ rowId: rowId })
    };
    client.proxyByProxyRowId[proxyRowId] = proxy;
    const proxiesByClientIndex = server.proxiesByRowId[proxy.rowId] || (server.proxiesByRowId[proxy.rowId] = {});
    const proxies = proxiesByClientIndex[client.index] || (proxiesByClientIndex[client.index] = {});
    proxies[proxyRowId] = proxy;
  }

  unmapProxyViewId(proxyRowId) {
    const client = this;

    const proxy = client.proxyByProxyRowId[proxyRowId];
    if (!proxy) return;
    delete client.proxyByProxyRowId[proxyRowId];
    const proxiesByClientIndex = server.proxiesByRowId[proxy.rowId];
    if (proxiesByClientIndex) {
      const proxies = proxiesByClientIndex[client.index];
      if (proxies) {
        delete proxies[client.index];
        if (!Object.keys(proxies).length) {
          delete server.proxiesByRowId[proxy.rowId][client.index];
          if (!Object.keys(proxiesByClientIndex).length) delete server.proxiesByRowId[proxy.rowId];
        }
      }
    }
  }

  serverReceivedMessage(message) {
    const client = this;

    console.log("Received message from client #" + this.index + ":   " + message);

    var matches = /(\d+):/.exec(message);
    var messageIndex = matches ? +matches[1] : -1;
    if (matches) message = message.substring(matches[0].length);
    if (message.startsWith("message:")) {
      client.handleMessage(messageIndex, message.substring("message:".length));
    } else if (message.startsWith("models:")) {
      client.requestViews(messageIndex, message.substring("models:".length));
    }
  }

  closed() {
    const client = this;
    const server = client.server;

    console.log("Client #" + this.index + " closed");
    Object.keys(client.subscriptions).forEach(proxyableViewId => {
      const viewInfo = server.views[proxyableViewId];
      if (viewInfo) delete viewInfo.subscribedClients[client.index];
    });
  }

  handleMessage(messageIndex, message) {
    const client = this;
    const server = client.server;
    const cache = server.cache;
    const defn = cache.schema;

    console.log("Handle message: " + message);
    const obj = JSON.parse(message);
    if (typeof obj != "object") return;

    const viewId = obj.modelId;
    if (!viewId) return;
    let proxyableViewIdInfo = ConvertIds.decomposeId({ proxyableViewId: viewId });
    const proxy = client.proxyByProxyRowId[proxyableViewIdInfo.proxyableRowId];

    if (!(proxy || proxyableViewIdInfo.dbRowId > 0)) {
      console.log("View id looks like proxy, but doesn't have a mapping set");
      return;
    }
    const rowIdInfo = proxy ? proxy.rowIdInfo : proxyableViewIdInfo;

    const type = defn.allTypes[rowIdInfo.typeName];
    if (!type) {
      console.log(`No type "${rowIdInfo.typeName}"`);
      return;
    }

    const form = obj.form;

    obj.message = obj.message || "save";

    switch (obj.message) {
      case "save":
        if (!form) break;
        Object.keys(form).forEach(fieldName => {
          const field = type.fields[fieldName];
          if (!field) {
            console.log(`No field "${fieldName}" in type "${rowIdInfo.typeName}"`);
            return;
          }

          const newValue = form[fieldName];
          const datapointId = field.getDatapointId({ dbRowId: rowIdInfo.dbRowId });
          cache.updateDatapointValue({ datapointId, newValue });
        });
        break;
      case "add":
        const fieldName = obj.fieldName;
        const field = type.fields[fieldName];
        if (!field || !field.isId) {
          console.log(`No id field "${fieldName}" in type "${rowIdInfo.typeName}"`);
          return;
        }
        cache.connection.break;
    }

    cache.commitNewlyUpdatedDatapoints();
  }

  requestViews(messageIndex, message) {
    const client = this;
    const server = client.server;

    console.log("Request views: " + message);
    const obj = JSON.parse(message);
    if (typeof obj != "object") return;
    let payload = {};
    if (obj.subscribe) {
      Object.getOwnPropertyNames(obj.subscribe).forEach(proxyableViewId => {
        var version = obj.subscribe[proxyableViewId];
        console.log(`View: ${proxyableViewId}[${version}]`);

        let proxyableViewIdInfo = ConvertIds.decomposeId({ proxyableViewId: proxyableViewId });
        if (!proxyableViewIdInfo) {
          payload[proxyableViewId] = {
            from: version,
            to: version
          };
          console.log("Couldn't parse view id");
          return;
        }
        const proxy = client.proxyByProxyRowId[proxyableViewIdInfo.proxyableRowId];

        if (!(proxy || proxyableViewIdInfo.dbRowId > 0)) {
          payload[proxyableViewId] = {
            from: version,
            to: version
          };
          console.log("View id looks like proxy, but doesn't have a mapping set");
          return;
        }
        const clientRowIdInfo = proxy ? proxy.rowIdInfo : proxyableViewIdInfo;
        const clientViewIdInfo = ConvertIds.recomposeId(clientRowIdInfo, {
          variant: proxyableViewIdInfo.variant
        });
        try {
          server.cache.ensureViewFields(clientViewIdInfo);
        } catch (error) {
          payload[proxyableViewId] = {
            from: version,
            to: version
          };
          console.log(error);
          return;
        }

        var currentVersionInfo =
          client.subscriptions[proxyableViewId] ||
          (client.subscriptions[proxyableViewId] = {
            client: client,
            clientSentVersion: version
          });
        currentVersionInfo.clientHasVersion = version;

        console.log(`Client sent version: ${currentVersionInfo.clientSentVersion}`);

        if (currentVersionInfo.clientHasVersion == currentVersionInfo.clientSentVersion) {
          let viewInfo = server.views[proxyableViewId];
          if (!viewInfo) {
            viewInfo = server.views[proxyableViewId] = {
              proxyableViewId: proxyableViewId,
              subscribedClients: {},
              latestVersionByViewId: {}
            };
          }
          if (!viewInfo.latestVersionByViewId[clientViewIdInfo.viewId]) {
            viewInfo.latestVersionByViewId[clientViewIdInfo.viewId] = server.cache.getLatestViewVersionIfAny(
              clientViewIdInfo
            );
          }
          viewInfo.subscribedClients[client.index] = client;

          const latestVersion = viewInfo.latestVersionByViewId[clientViewIdInfo.viewId];
          if (latestVersion && latestVersion.version >= version) {
            const latestVersionIndex = latestVersion ? latestVersion.version : 0;
            if (currentVersionInfo.clientHasVersion == latestVersionIndex) {
              payload[proxyableViewId] = {
                from: currentVersionInfo.clientHasVersion,
                to: latestVersion.version
              };
            } else {
              var diff = latestVersion; // TODO

              payload[proxyableViewId] = {
                diff: diff,
                from: currentVersionInfo.clientHasVersion,
                to: latestVersion.version
              };
            }

            currentVersionInfo.clientSentVersion = latestVersion.version;
          } else {
            console.log(`Will retrieve view ${clientViewIdInfo.viewId} asynchronously`);
          }
        }
      });

      console.log(payload);
      if (Object.keys(payload).length) {
        const payloadString =
          (messageIndex == -1 || messageIndex == undefined ? "Models:" : messageIndex + ":") + JSON.stringify(payload);
        client.ws.send(payloadString);
      }

      server.cache.validateNewlyInvalidDatapoints();
    }
  }
}

// API is the public facing class
module.exports = PublicApi({ fromClass: WebSocketServer, hasExposedBackDoor: true });
