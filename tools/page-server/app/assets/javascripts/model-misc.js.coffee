document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_misc = class ModelDOM_misc
  constructor:->
    @windowIsFocussed = true


  markerIndex:(field)->
    return "self" unless typeof(field)=='string'
    "marker-"+document.modelDOM.sanitizeClassName(field,true)



  periodicTasks:->
    body = $(document.body)
    if body.hasClass('has-scrollbar')
      body.removeClass('has-scrollbar') unless document.body.scrollHeight > document.body.clientHeight
    else
      body.addClass('has-scrollbar') if document.body.scrollHeight > document.body.clientHeight


  getModelDOM:(model, subtemplatePath)=>
    #if @_doDebugCall then return @debugCall("getModelDOM",["model", "subtemplatePath"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    if typeof(model.fields.dom)=='string'
      {
        dom:model.fields.dom
        domModels:[model]
        templateModel: model if model.type == 'Template'
      }
    else if template = @templateForModel(model, subtemplatePath)
      {
        dom:(if typeof(dom = template.fields.dom)=='string' then dom else "<div/>")
        domModels:[model,template]
        templateModel:template
      }

  templateForModel:(model, subtemplatePath)->
    if subtemplatePath
      ret if model.fields.subtemplates && (templateId = model.fields.subtemplates[subtemplatePath]) && (ret = @model(templateId))
    else
      ret if model.fields.template && model.fields.template.array && model.fields.template.array.length>=1 && (ret = model.fields.template.array[0].model)


  changePage:(newId, left, top)=>
    if @_doDebugCall then return @debugCall("changePage",["newId"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    return unless typeof newId == 'string'
    @scrollTo = {left:left, top:top}
    @applyModelDiff(@model("root"),{page:[newId]})
    document.aautil.killModals()
    if Object.getOwnPropertyNames(@needModels).length and (jqel = $('#change-page-loading')).length
      document.aautil.toggle(jqel[0],undefined,true,false)
      @sendModelsNow()
    else 
      @updateModels()
    true




