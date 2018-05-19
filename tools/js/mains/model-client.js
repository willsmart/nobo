// model_server
// © Will Smart 2018. Licence: MIT

const WebSocketClient = require("../web-socket-client");
const fs = require("fs");
const rl = require("readline");
const processArgs = require("../general/process-args");

var rlInterface = rl.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

(async function () {
  var args = processArgs();

  console.log("Client to test the ws connection");
  console.log("   args: " + JSON.stringify(args));

  const wsclient = new WebSocketClient(args);

  const callbackKey = "model-client"
  wsclient.watch({
    callbackKey,
    onpayload: ({
      messageIndex,
      messageType,
      payloadObject
    }) => {
      console.log(JSON.stringify(payloadObject, undefined, 2))
    }
  })

  rlInterface.on('line', (message) => {
    wsclient.sendMessage({
      message
    })
    console.log("msg: ")
  })
})();

/*

{"datapoints":{"user__1__#bio":1}}

*/