const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");
const SharedState = require("../general/shared-state");
const PageState = require("./page-state");
const { elementForUniquePath, uniquePathForElement } = require("../dom/dom-functions");

let globalClientActions;
const callbackKey = "client-actions";

// API is auto-generated at the bottom from the public interface of this class

class ClientActions {
  // public methods
  static publicMethods() {
    return ["installOnElement"];
  }

  constructor({ domGenerator } = {}) {
    const clientActions = this;

    clientActions.nextElementIndex = 1;

    if (!globalClientActions) globalClientActions = clientActions;

    clientActions.domGenerator = domGenerator;
    domGenerator.watch({
      callbackKey,
      onprepelement: ({ element, proxyableRowId }) => {
        clientActions.installOnElement({ element, proxyableRowId });
      }
    });
  }

  installOnElement({ element, proxyableRowId }) {
    const clientActions = this;
    let _elementIndex;
    function elementIndex() {
      if (_elementIndex !== undefined) return _elementIndex;
      _elementIndex = clientActions.nextElementIndex++;
      element.classList.add(`nobo-element-${_elementIndex}`);
    }
    for (const className of element.classList) {
      switch (className) {
        case "pushModel":
          element.addEventListener("click", () => {
            if (proxyableRowId) PageState.global.visit(proxyableRowId);
          });
      }
    }
    let value;
    if ((value = element.getAttribute("clickvariant")) && ConvertIds.fieldNameRegex.test(value)) {
      element.addEventListener("click", () => {
        const path = uniquePathForElement(element);
        SharedState.global.withTemporaryState(state => (state.atPath("overriddenElementDatapoints")[path] = value));
      });
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: ClientActions,
  hasExposedBackDoor: true
});
