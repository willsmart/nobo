
$(document).ready ->

  ModelDOM_combined = document.ModelDOM || (class ModelDOM)
  if document.ModelDOM_classes
    for className,ModelDOM_class of document.ModelDOM_classes
      ModelDOM_combined=((ModelDOM_combined,ModelDOM_class)->
        ->
          ModelDOM_class.call(this)
          ModelDOM_combined.call(this)
      )(ModelDOM_combined,ModelDOM_class)

      for fnName,fn of ModelDOM_class.prototype
        ModelDOM.prototype[fnName] = fn unless ModelDOM.prototype[fnName]

  ModelDOM_combined.prototype = ModelDOM.prototype
  document.ModelDOM = ModelDOM = ModelDOM_combined


  document.modelDOM = new ModelDOM
  #document.modelDOM.updateModels()

 