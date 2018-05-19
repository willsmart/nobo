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
    const server = this;

    server._cache = cache;

    server.serverDatapoints = new ServerDatapoints({
      wsserver: server
    })
  }

  get cache() {
    return this._cache
  }

  start({
    port = 3100
  } = {}) {
    const server = this;

    server.serverParams = {
      port: port
    };
    server.wss = new WebSocket.Server({
      port: port
    });

    var nextWsIndex = 1;

    server.wss.on("connection", function connection(ws, req) {
      ws.pongHistory = [0, 0, 0, 1],
        ws.pongCount = 1;

      console.log(req.headers);

      var client = new WebSocketClient({
        server: server,
        ws: ws,
        index: nextWsIndex++
      });

      server.notifyListeners('onclientConnected', client)

      ws.on("pong", () => {
        ws.pongHistory[ws.pongHistory.length - 1]++;
        ws.pongCount++
      });

      ws.on("message", function incoming(message) {
        client.serverReceivedMessage(message);
      });

      ws.on("close", function close() {
        client.closed();
      });

      ws.on("error", () => console.log("errored"));
    });

    const interval = setInterval(function ping() {
      server.wss.clients.forEach(function each(ws) {
        if (!ws.pongCount) {
          return ws.terminate();
        }

        ws.pongHistory.push(0);
        ws.pongCount -= ws.pongHistory.shift()

        ws.ping("", false, true);
      });
    }, 10000);

    console.log(`Web socket server listening on port ${port}`);
  }

}

class WebSocketClient {
  constructor({
    server,
    ws,
    index
  }) {
    const client = this

    client.server = server;
    client.ws = ws;
    client.index = index;
    client.mapProxyRowId(
      ConvertIds.recomposeId({
        typeName: "App",
        proxyKey: "default"
      }).proxyableRowId,
      ConvertIds.recomposeId({
        typeName: "App",
        dbRowId: 1
      }).rowId
    );
    client.login(1);
  }

  login(userId) {
    const client = this

    if (userId) {
      client.mapProxyRowId(
        ConvertIds.recomposeId({
          typeName: "User",
          proxyKey: "me"
        }).proxyableRowId,
        ConvertIds.recomposeId({
          typeName: "User",
          dbRowId: userId
        }).rowId
      );
      client.mapProxyRowId(
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
      client.mapProxyRowId(
        ConvertIds.recomposeId({
          typeName: "User",
          proxyKey: "me"
        }).proxyableproxyableRowIdViewId,
        ConvertIds.recomposeId({
          typeName: "App",
          dbRowId: 1
        }).rowId
      );
      client.mapProxyRowId(
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

    console.log("Received message from client #" + client.index + ":   " + message);

    const matches = /^(?:(\d+)|(\w+)):/.exec(message),
      messageIndex = matches ? +matches[1] : -1,
      messageType = matches ? matches[2] : undefined;
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
      messageType,
      payloadObject
    })
  }

  closed() {
    const client = this;
    const server = client.server;

    console.log("Client #" + client.index + " closed");

    client.notifyListeners('onclose')
  }

  sendPayload({
    messageIndex = -1,
    messageType,
    payloadObject
  }) {
    const client = this;

    const message = `${messageIndex==-1 ? (messageType ? `${messageType}:` : '') : `${messageIndex}:`}${JSON.stringify(payloadObject)}`
    console.log("Sending message to client #" + client.index + ":   " + message);

    client.ws.send(message)
  }
}

makeClassWatchable(WebSocketClient)
makeClassWatchable(WebSocketServer)

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketServer,
  hasExposedBackDoor: true
});