document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_relationships = class ModelDOM_relationships
  constructor:->
    @orphanModels = {}
    @modelsQueuedForDeletion = {}
    @modelsQueuedForDeletionByTime = {}
    @secondsToKeepOrphanModelsBeforeDeletion = 20
    return

  unlinkModels:(parent,child,unrefCnt)=>
    unrefCnt = 1 unless typeof(unrefCnt)=='number'
    @linkModels(parent,child,-unrefCnt)

  linkModels:(parent,child,refCnt)=>
    #if @_doDebugCall then return @debugCall("linkModels",["parent","child","refCnt"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    refCnt = 1 unless typeof(refCnt)=='number'
    unless $.isPlainObject(parent) && $.isPlainObject(child) && child!=parent
      return ERROR("Can't link models since they are the same or aren't models:",parent, child)

    v = parent.memberModels[child.id] = child.memberOfModels[parent.id] = (parent.memberModels[child.id]||0)+refCnt
    if v<=0
      delete parent.memberModels[child.id]
      delete child.memberOfModels[parent.id]
      @queueOrphanModel(child) unless Object.keys(child.memberOfModels).length or child.type=="Template"
    else 
      if tuple = @modelsQueuedForDeletion[child.id]
        delete @modelsQueuedForDeletion[child.id]
        delete @modelsQueuedForDeletionByTime[tuple[1]][child.id] if @modelsQueuedForDeletionByTime[tuple[1]]
      delete @orphanModels[child.id]

    v

  markOrphanModels:->
    @deletedModels ||= []
    while (keys = Object.keys(@orphanModels)).length
      @orphanModels = {}
      for modelId in keys when model = @models[modelId]
        @deletedModels.push(model)
        @unlinkModels(model,child,count) for id,count of model.memberModels when child = @models[id]
        delete @needModels[modelId]
        @applyModelDiff(model,{})
    return

  deleteOrphanModels:->
    for model in @deletedModels
      delete @models[model.id]
      delete @modelsByClass[model.class]
      @doneWithModels[model.id] = model
    @sendModels() if @deletedModels.length
    @deletedModels = []
    return

  queueOrphanModel:(model)->
    time = Math.floor(new Date().getTime()/1000)

    return if @modelsQueuedForDeletion[model.id]
    @modelsQueuedForDeletion[model.id] = [model,time]

    @modelsQueuedForDeletionByTime[time] ||= {}
    @modelsQueuedForDeletionByTime[time][model.id] = model
    return

  commitQueuedOrphans:->
    time = Math.floor(new Date().getTime()/1000)

    @manageDeletedModels_time = time unless @manageDeletedModels_time
    return unless @manageDeletedModels_time < time-@secondsToKeepOrphanModelsBeforeDeletion

    for delTime in [@manageDeletedModels_time...(time-@secondsToKeepOrphanModelsBeforeDeletion)]
      continue unless watingModels = @modelsQueuedForDeletionByTime[delTime]
      delete @modelsQueuedForDeletionByTime[delTime]
      for id,model of watingModels
        delete @modelsQueuedForDeletion[model.id]
        @orphanModels[model.id] = model

    @manageDeletedModels_time = time-@secondsToKeepOrphanModelsBeforeDeletion

    return
