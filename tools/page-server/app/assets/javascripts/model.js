/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

// This is all a horrific hack. Sorry. TODO! clean up all ths old coffee code
$(document).ready(function() {
  let ModelDOM =
    document.ModelDOM ||
    class ModelDOM {
      constructor() {
        this.construct();
      }
      construct() {}
    };
  if (document.ModelDOM_classes) {
    for (let className in document.ModelDOM_classes) {
      const ModelDOM_class = document.ModelDOM_classes[className];
      for (const methodName of Object.getOwnPropertyNames(ModelDOM_class.prototype)) {
        const method = ModelDOM_class.prototype[methodName];
        if (methodName == "construct") {
          const methodWas = ModelDOM.prototype[methodName];
          ModelDOM.prototype[methodName] = function() {
            methodWas.call(this, arguments);
            method.call(this, arguments);
          };
        } else {
          ModelDOM.prototype[methodName] = method;
        }
      }
    }
  }

  document.ModelDOM = ModelDOM;

  return (document.modelDOM = new ModelDOM());
});
//document.modelDOM.updateModels()
