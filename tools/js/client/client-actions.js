const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");
const SharedState = require("../general/shared-state");
const PageState = require("./page-state");

let globalClientActions;

// API is auto-generated at the bottom from the public interface of this class

class ClientActions {
  // public methods
  static publicMethods() {
    return ["installOnElement"];
  }

  constructor({ domGenerator } = {}) {
    const clientActions = this;
    if (!globalClientActions) globalClientActions = clientActions;

    clientActions.domGenerator = domGenerator;
    domGenerator.watch({
      callbackKey: "client-actions",
      onprepelement: ({ element, proxyableRowId }) => {
        clientActions.installOnElement({ element, proxyableRowId });
      }
    });
  }

  installOnElement({ element, proxyableRowId }) {
    for (const className of element.classList) {
      switch (className) {
        case "pushModel":
          element.addEventListener("click", () => {
            if (proxyableRowId) PageState.global.visit(proxyableRowId);
          });
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: ClientActions,
  hasExposedBackDoor: true
});
