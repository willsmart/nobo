const WebSocket = require("isomorphic-ws");
const ConvertIds = require("../convert-ids");
const PublicApi = require("../general/public-api");
const makeClassWatchable = require("../general/watchable");

// API is auto-generated at the bottom from the public interface of this class

class WebSocketClient {
  // public methods
  static publicMethods() {
    return ["sendMessage", "sendPayload", "isOpen", "watch", "stopWatching", "signOut"];
  }

  constructor({ port = 3100 } = {}) {
    const client = this;

    client._isOpen = false;
    client.nextMessageIndex = 1;
    client.clientParams = {
      port: port
    };

    function open() {
      const ws = (client.ws = new WebSocket(
        `ws://localhost:${port}${client.phoenix ? `?phoenix=${encodeURIComponent(client.phoenix)}` : ""}`
      ));
      delete client.phoenix;
      ws.onopen = function open() {
        client._isOpen = true;
        client.notifyListeners("onopen");

        (client.pongHistory = [0, 0, 0, 1]), (client.pongCount = 1);
      };

      ws.onclose = function close() {
        clearInterval(ws.pingInterval);
        client._isOpen = false;
        client.notifyListeners("onclose");
        setTimeout(() => open(), 2000);
      };

      if (ws.on) {
        ws.on("pong", () => {
          ws.pongHistory[ws.pongHistory.length - 1]++;
          ws.pongCount++;
        });
      }

      ws.onmessage = function incoming(message) {
        const match = /^Phoenix:(.*)$/.exec(message.data);
        if (match) {
          client.phoenix = JSON.parse(match[1]);
          ws.close();
          return;
        }

        client.notifyListeners(
          "onpayload",
          WebSocketClient.decodeMessage({
            message: message.data
          })
        );
      };

      ws.onerror = err => {
        console.log(`Error: ${err.message}`);
      };

      if (ws.ping) {
        ws.pingInterval = setInterval(function ping() {
          if (!ws.pongCount) {
            return ws.close();
          }

          ws.pongHistory.push(0);
          clwsient.pongCount -= ws.pongHistory.shift();

          ws.ping("", false, true);
        }, 10000);
      }
    }
    open();

    console.log(`Web socket client listening to server on port ${port}`);
  }

  get isOpen() {
    return this._isOpen;
  }

  static decodeMessage({ message }) {
    const matches = /^(?:(\d+)|(\w+)):/.exec(message),
      messageIndex = matches && matches[1] !== undefined ? +matches[1] : -1,
      messageType = matches && matches[2] !== undefined ? matches[2] : undefined;
    if (matches) message = message.substring(matches[0].length);

    let payloadObject;
    try {
      payloadObject = JSON.parse(message);
    } catch (err) {
      payloadObject = message;
    }
    if (Array.isArray(payloadObject)) {
      payloadObject = {
        array: payloadObject
      };
    } else if (typeof payloadObject != "object") {
      payloadObject = {
        message: `${payloadObject}`
      };
    }

    return {
      messageIndex,
      messageType,
      payloadObject
    };
  }
  get cache() {
    return this._cache;
  }

  sendMessage({ message }) {
    this.sendPayload(
      WebSocketClient.decodeMessage({
        message
      })
    );
  }

  sendPayload({ messageIndex = -1, messageType, payloadObject }) {
    const client = this;

    if (!client.isOpen) return;

    if (messageIndex == -1 && !messageType) messageIndex = client.nextMessageIndex++;
    const message = `${
      messageIndex == -1 ? (messageType ? `${messageType}:` : "") : `${messageIndex}:`
    }${JSON.stringify(payloadObject)}`;
    console.log("Sending message to server:   " + message);

    client.ws.send(message);
  }

  signOut() {
    const client = this;

    client.phoenix = "out";
    client.ws.close();
  }
}

makeClassWatchable(WebSocketClient);

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketClient,
  hasExposedBackDoor: true
});
