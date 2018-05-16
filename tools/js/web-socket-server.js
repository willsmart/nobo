const WebSocket = require("ws");
const ConvertIds = require("./convert-ids");
const PublicApi = require("./general/public-api");
const makeClassWatchable = require("./general/watchable");
const ServerDatapoints = require("./server-datapoints");

// API is auto-generated at the bottom from the public interface of this class

class WebSocketServer {
  // public methods
  static publicMethods() {
    return ["start", "cache", "watch", "stopWatching"];
  }

  constructor({
    cache
  }) {
    const wsserver = this;

    wsserver._cache = cache;

    wsserver.serverDatapoints = new ServerDatapoints({
      wsserver
    })
  }

  get cache() {
    return this._cache
  }

  start({
    port = 3100
  } = {}) {
    const server = this;

    this.serverParams = {
      port: port
    };
    server.wss = new WebSocket.Server({
      port: port
    });

    var nextWsIndex = 1;

    server.wss.on("connection", function connection(ws, req) {
      ws.isAlive = true;

      console.log(req.headers);

      var client = new WebSocketClient({
        server: server,
        ws: ws,
        index: nextWsIndex++
      });

      server.notifyListeners('onclientConnected', client)

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

    console.log(`Web socket server listening on port ${port}`);
  }

}

class WebSocketClient {
  constructor({
    server,
    ws,
    index
  }) {
    this.server = server;
    this.ws = ws;
    this.index = index;
    this.mapProxyRowId(
      ConvertIds.recomposeId({
        typeName: "App",
        proxyKey: "default"
      }).proxyableRowId,
      ConvertIds.recomposeId({
        typeName: "App",
        dbRowId: 1
      }).rowId
    );
    this.login(1);
  }

  login(userId) {
    if (userId) {
      this.mapProxyRowId(
        ConvertIds.recomposeId({
          typeName: "User",
          proxyKey: "me"
        }).proxyableRowId,
        ConvertIds.recomposeId({
          typeName: "User",
          dbRowId: userId
        }).rowId
      );
      this.mapProxyRowId(
        ConvertIds.recomposeId({
          typeName: "User",
          proxyKey: "default"
        }).proxyableRowId,
        ConvertIds.recomposeId({
          typeName: "User",
          dbRowId: userId
        }).rowId
      );
    } else {
      this.mapProxyRowId(
        ConvertIds.recomposeId({
          typeName: "User",
          proxyKey: "me"
        }).proxyableproxyableRowIdViewId,
        ConvertIds.recomposeId({
          typeName: "App",
          dbRowId: 1
        }).rowId
      );
      this.mapProxyRowId(
        ConvertIds.recomposeId({
          typeName: "User",
          proxyKey: "default"
        }).proxyableRowId,
        ConvertIds.recomposeId({
          typeName: "App",
          dbRowId: 1
        }).rowId
      );
    }
  }

  mapProxyRowId(proxyRowId, rowId) {
    // TODO
  }

  logout() {
    this.login();
  }

  serverReceivedMessage(message) {
    const client = this;

    console.log("Received message from client #" + this.index + ":   " + message);

    var matches = /(\d+):/.exec(message);
    var messageIndex = matches ? +matches[1] : -1;
    if (matches) message = message.substring(matches[0].length);

    let payloadObject
    try {
      payloadObject = JSON.parse(message)
    } catch (err) {
      payloadObject = message
    }
    if (Array.isArray(payloadObject)) {
      payloadObject = {
        array: payloadObject
      }
    } else if (typeof (payloadObject) != 'object') {
      payloadObject = {
        message: `${payloadObject}`
      }
    }

    client.notifyListeners('onpayload', {
      messageIndex,
      payloadObject
    })
  }

  closed() {
    const client = this;
    const server = client.server;

    console.log("Client #" + this.index + " closed");

    client.notifyListeners('onclose')
  }

}

makeClassWatchable(WebSocketClient)
makeClassWatchable(WebSocketServer)

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketServer,
  hasExposedBackDoor: true
});