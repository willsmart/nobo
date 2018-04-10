document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_model = class ModelDOM_model
  constructor:->

    @models = {}
    @modelsByClass = {}
    @needModels = {}
    @doneWithModels = {}

  constructLocation:(o)->
    return unless $.isPlainObject(o) && o.type
    rowidres = /^([a-z\d]*)(?:\[([\w\d_]+)\])?$/.exec(o.rowid) if o.rowid
    return '/'+o.type+
      (if rowidres and rowidres[1] and rowidres[1]!='default' then '/'+rowidres[1] else '')+
      (if rowidres and rowidres[2] then ':'+rowidres[2] else '')+
      (if o.variant && o.variant!='default' && /[\w-.]+/.test(o.variant) then '~'+o.variant else '')+
      (if ((f=o.name) && typeof(f)=='string')||(o.fields && (f=o.fields['name']) && typeof(f)=='string') then '//'+f.replace(/[^A-Za-z0-9-_.!~*'()]/g,'-') else '')

  parseLocation:(s)->
    return unless res = /^\/(\w+)(?:\/([a-z\d]+))?(?::([\w\d_]+))?(?:(?:~|%7[eE])([\w-.]+))?(?:\/\/(.*))?$/.exec(s)
    return {
      type: res[1]
      rowid: (if res[2] && res[2]!='default' then res[2] else '') + (if res[3] then '['+res[3]+']' else '')
      variant: (if res[4] && res[4] != 'default' then res[4] else undefined)
      name: res[5]
    }

  constructModelId:(o)->
    return unless $.isPlainObject(o) && o.type
    return (if o.mine then 'my ' else '')+
      o.type+
      (if o.rowid && /^[a-z\d]+$/.test(o.rowid) then '__'+o.rowid else '__default')+
      (if o.variant && /[\w-.]+/.test(o.variant) then '__'+o.variant else '__default')

  parseModelId:(s)->
    return unless res = /^(my\b ?)?((?:[a-z0-9]+(?:_[a-z0-9]+)*))?(?:__([a-z\d]+))?(?:__([\w\-.]+))?$/.exec(s)
    return {
      mine: res[1]!=undefined
      type: res[2]
      rowid: (if res[3] && res[3]!='default' then res[3] else '')
      variant: (if res[4] && res[4]!='default' then res[4] else undefined)
    }

  modelIdWithVariant:(id, variant)=>
    return unless o = @parseModelId(id)
    o.variant = variant
    @constructModelId(o)

  doDebugCall:true
  _doDebugCall:true

  _debugCallDepth:1
  debugCall:(fn,argNames,args)->
    depth = @_debugCallDepth++
    if depth>30
      ERROR "too deep"
      die()
    argDict = {}
    for name,ind in argNames
      arg = (if args.length>ind then args[ind])
      argDict[name] = arg
    @_debugCallArgs = (arg for arg in args)
    @_debugCallArgs.unshift JSON.mystringify(argDict,4)
    @_debugCallArgs.unshift ">".repeat(depth)+" (window.BP:"+(document._bpIndex+1)+") "+fn
    @_doDebugCall = false
    ret = this[fn].apply(this,args)
    if ret!=undefined then @debug.apply(this,["<".repeat(depth)+" "+fn,ret])
    @_debugCallDepth = depth
    ret
  debug:->
    console.log.apply(this,arguments)


  model:(modelId,name)=>
    #if @_doDebugCall then return @debugCall("model",["modelId"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    if ret = @models[modelId]
      if tuple = @modelsQueuedForDeletion[modelId]
        delete @modelsQueuedForDeletion[modelId]
        delete @modelsQueuedForDeletionByTime[tuple[1]][modelId] if @modelsQueuedForDeletionByTime[tuple[1]]
    else
      return unless o = @parseModelId(modelId)

      ret = @models[modelId] = {
        id: modelId
        mine: o.mine
        type: o.type
        name: name
        ver: 0
        rowid: o.rowid
        variant: o.variant
        memberModels: {}
        memberOfModels: {}
        fields:{}
        fieldChanges:{}
        overrideVariants:{}
        nextIndex:1
        classSuffix: (if !o.mine then "" else "_mine")+
          (if o.type=="" then "" else "_type-"+@sanitizeClassName(o.type,true))+
          (if !o.rowid then "" else "_id-"+@sanitizeClassName(o.rowid,true))+
          (if !o.variant then "" else "_variant-"+@sanitizeClassName(o.variant,true))
      }
      ret.class = "__model"+ret.classSuffix
      ret.classAsChild = "__childOf"+ret.classSuffix

      @modelsByClass[ret.class] = ret

      unless modelId=='root'
        @needModels[modelId] = ret 
        delete @doneWithModels[modelId] if @doneWithModels

      @sendModels()
    ret

