const ClientDatapoints = require("./client-datapoints"),
  WebSocketClient = require("./web-socket-client"),
  SharedState = require("./shared-state"),
  DomGenerator = require("./dom-generator"),
  DomUpdater = require("./dom-updater"),
  ConvertIds = require("../convert-ids"),
  { htmlToElement } = require("./dom-functions");

document.nobo = {
  ClientDatapoints,
  WebSocketClient,
  SharedState,
  DomGenerator,
  DomUpdater
};

document.nobo.datapoints = new document.nobo.ClientDatapoints();
document.nobo.domGenerator = new document.nobo.DomGenerator({
  htmlToElement,
  getDatapoint: (datapointId, defaultValue) => document.nobo.datapoints.getDatapoint(datapointId, defaultValue)
});
document.nobo.domUpdater = new document.nobo.DomUpdater({
  domGenerator: document.nobo.domGenerator
});

SharedState.global.watch({
  onchangedstate: function(diff, changes) {
    console.log(`>> State change: ${JSON.stringify(diff)}`);
  }
});

function testScript() {
  const { SharedState, ClientDatapoints, WebSocketClient } = document.nobo;
  document.nobo.datapoints.subscribe("user__1__app_name");
}

function locationPathFromRowIds(rowIds) {
  if (rowIds.length == 0) {
    return "";
  }
  const rowId = rowIds[0];
  if (ConvertIds.rowRegex.test(rowId)) {
    const decomposed = ConvertIds.decomposeId({ rowId });
    return `${decomposed.typeName}/${decomposed.dbRowId}`;
  }
  if (ConvertIds.datapointRegex.test(rowId)) {
    const decomposed = ConvertIds.decomposeId({ datapointId: rowId });
    return `${decomposed.typeName}/${decomposed.dbRowId}/${decomposed.fieldName}`;
  }
  return "";
}

function rowIdsFromLocationPath(path) {
  if (path === undefined) path = window.location.pathname;

  let match = /^\/([\w\d_]+)\/(\d+)(?:\/([\w\d_]+))?$/.exec(path);
  if (!match) match = [undefined, "app", "1"];
  const recomposed = ConvertIds.recomposeId({
    typeName: match[1],
    dbRowId: match[2],
    fieldName: match[3]
  });
  return [recomposed.datapointId || recomposed.rowId];
}

function locationPathFromRowIds(rowIds) {
  return rowIds.join("___");
}

SharedState.global.watch({
  callbackKey: "location-watch",
  onchangedstate: function(diff, changes, forEachChangedKeyPath) {
    forEachChangedKeyPath((keyPath, change) => {
      switch (keyPath.length) {
        case 0:
          return true;
        case 1:
          return keyPath[0] == "datapointsById";
        case 2:
          if (keyPath[0] == "datapointsById" && keyPath[1] == "page" && Array.isArray(change.is)) break;
        default:
          return false;
      }

      const path = locationPathFromRowIds(change.is);
      console.log(path);
    });
  }
});

function setPage(rowId) {
  SharedState.global.requestCommit(temp => {
    temp.atPath("datapointsById").page = [rowId];
  });
}

setPage(rowIdsFromLocationPath()[0]);
