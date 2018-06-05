const ClientDatapoints = require("./client-datapoints"),
  PageState = require("./page-state"),
  WebSocketClient = require("./web-socket-client"),
  SharedState = require("../general/shared-state"),
  DomGenerator = require("../dom/dom-generator"),
  DomUpdater = require("../dom/dom-updater"),
  ConvertIds = require("../convert-ids"),
  { htmlToElement } = require("../dom/dom-functions"),
  ClientActions = require("./client-actions");

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

document.nobo.clientActions = new ClientActions({ domGenerator: document.nobo.domGenerator });

SharedState.global.watch({
  onchangedstate: function(diff, changes) {
    console.log(`>> State change: ${JSON.stringify(diff)}`);
  }
});

document.nobo.pageState.visit();
