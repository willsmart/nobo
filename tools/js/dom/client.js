const ClientDatapoints = require("./client-datapoints"),
  PageState = require("../client/page-state"),
  WebSocketClient = require("./web-socket-client"),
  SharedState = require("./shared-state"),
  DomGenerator = require("./dom-generator"),
  DomUpdater = require("./dom-updater"),
  ConvertIds = require("../convert-ids"),
  { htmlToElement } = require("./dom-functions");

document.nobo = {
  ClientDatapoints,
  PageState,
  WebSocketClient,
  SharedState,
  DomGenerator,
  DomUpdater
};

document.nobo.wsclient = new WebSocketClient();
document.nobo.datapoints = new document.nobo.ClientDatapoints({ wsclient: document.nobo.wsclient });

const getDatapoint = (proxyableDatapointId, defaultValue) =>
  document.nobo.datapoints.getDatapoint(proxyableDatapointId, defaultValue);

document.nobo.domGenerator = new document.nobo.DomGenerator({
  htmlToElement,
  getDatapoint
});
document.nobo.domUpdater = new document.nobo.DomUpdater({
  domGenerator: document.nobo.domGenerator
});
document.nobo.pageState = new document.nobo.PageState({
  getDatapoint
});

SharedState.global.watch({
  onchangedstate: function(diff, changes) {
    console.log(`>> State change: ${JSON.stringify(diff)}`);
  }
});

document.nobo.pageState.visit();
