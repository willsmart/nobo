/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */

$(document).ready(function() {
  let ModelDOM;
  let ModelDOM_combined = document.ModelDOM || (ModelDOM = class ModelDOM {});
  if (document.ModelDOM_classes) {
    for (let className in document.ModelDOM_classes) {
      const ModelDOM_class = document.ModelDOM_classes[className];
      ModelDOM_combined = ((ModelDOM_combined, ModelDOM_class) =>
        function() {
          ModelDOM_class.call(this);
          return ModelDOM_combined.call(this);
        })(ModelDOM_combined, ModelDOM_class);

      for (let fnName in ModelDOM_class.prototype) {
        const fn = ModelDOM_class.prototype[fnName];
        if (!ModelDOM.prototype[fnName]) {
          ModelDOM.prototype[fnName] = fn;
        }
      }
    }
  }

  ModelDOM_combined.prototype = ModelDOM.prototype;
  document.ModelDOM = ModelDOM = ModelDOM_combined;

  return (document.modelDOM = new ModelDOM());
});
//document.modelDOM.updateModels()
