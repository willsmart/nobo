/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_domState;
if (!document.ModelDOM_classes) {
  document.ModelDOM_classes = {};
}
document.ModelDOM_classes.ModelDOM_domState = ModelDOM_domState = class ModelDOM_domState {
  construct() {
    this.pushState = this.pushState.bind(this);
    this.pushModel = this.pushModel.bind(this);
  }

  pushState(id, event) {
    let location;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!(location = this.constructLocation(this.parseModelId(id)))) {
      return;
    }
    const info = {
      modelId: id,
      top: window.pageYOffset || document.documentElement.scrollTop,
      left: window.pageXOffset || document.documentElement.scrollLeft
    };
    window.history.pushState(info, location, location);
    this.changePage(id);
    dataLayer.push({
      event: "VirtualPageChange"
    });
    $(document).trigger("VirtualPageChange");
  }

  pushModel(el, specifyVariant, variant, event) {
    let location, modelId;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!(modelId = this.modelIdForElement(el, undefined, true))) {
      return;
    }
    if (specifyVariant !== false) {
      if (!(modelId = this.modelIdWithVariant(modelId, variant))) {
        return;
      }
    }
    if (event.metaKey && (location = this.constructLocation(this.parseModelId(modelId)))) {
      return window.open(location, "_blank").focus();
    } else {
      return this.pushState(modelId);
    }
  }
};

$(document).ready(function() {
  window.onpopstate = function(e) {
    if (e.state && e.state.modelId) {
      return document.modelDOM.changePage(e.state.modelId, e.state.left, e.state.top);
    }
  };
  return (window.onreplacestate = function(e) {});
});
