const WebSocket = require("isomorphic-ws");
const ConvertIds = require("./convert-ids");
const PublicApi = require("./general/public-api");
const makeClassWatchable = require("./general/watchable");
const ServerDatapoints = require("./server-datapoints");

// API is auto-generated at the bottom from the public interface of this class

class WebSocketClient {
  // public methods
  static publicMethods() {
    return ["sendMessage", "sendPayload", "watch", "stopWatching"];
  }

  constructor({
    port = 3100
  } = {}) {
    const client = this;

    client.nextMessageIndex = 1
    client.clientParams = {
      port: port
    };

    function open() {
      const ws = client.ws = new WebSocket(`ws://localhost:${port}`, {
        origin: 'https://websocket.org'
      });

      ws.onopen = function open() {
        client.notifyListeners('onopen')

        client.pongHistory = [0, 0, 0, 1],
          client.pongCount = 1;

      };

      ws.onclose = function close() {
        client.notifyListeners('onclose')
        setTimeout(() => open(), 2000)
      };

      ws.on("pong", () => {
        client.pongHistory[client.pongHistory.length - 1]++;
        client.pongCount++;
      });

      ws.onmessage = function incoming(message) {
        console.log("Received message from server:   " + message);

        client.notifyListeners('onpayload', WebSocketClient.decodeMessage({
          message: message.data
        }))
      };

      ws.onerror = (err) => {
        console.log(`Error: ${err.message}`);
      }
    }
    open()

    const interval = setInterval(function ping() {
      if (!client.pongCount) {
        return client.ws.close();
      }

      client.pongHistory.push(0);
      client.pongCount -= client.pongHistory.shift()

      client.ws.ping("", false, true);
    }, 10000);


    console.log(`Web socket client listening to server on port ${port}`);
  }

  static decodeMessage({
    message
  }) {
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

    return {
      messageIndex,
      messageType,
      payloadObject
    }

  }
  get cache() {
    return this._cache
  }

  sendMessage({
    message
  }) {
    this.sendPayload(WebSocketClient.decodeMessage({
      message
    }))
  }

  sendPayload({
    messageIndex = -1,
    messageType,
    payloadObject
  }) {
    const client = this;

    if (messageIndex == -1 && !messageType) messageIndex = client.nextMessageIndex++;
    const message = `${messageIndex==-1 ? (messageType ? `${messageType}:` : '') : `${messageIndex}:`}${JSON.stringify(payloadObject)}`
    console.log("Sending message to server:   " + message);

    client.ws.send(message)
  }
}


makeClassWatchable(WebSocketClient)

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketClient,
  hasExposedBackDoor: true
});