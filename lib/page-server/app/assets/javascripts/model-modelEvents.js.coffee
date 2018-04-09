document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_modelEvents = class ModelDOM_modelEvents
  constructor:->
 
    me = this
    @defaultModelCallbacks={}
    @modelEvents={}
    @defaultModelCallbacks={
      insertmodel:->
        return unless jqel = me.modelElementForElement(this)
        el = jqel[0]
        if el.hasAttribute('fadeinmodel')
          fadeIn = +el.getAttribute('fadeinmodel')
          fadeIn = 300 unless fadeIn>0
        else if jqel.hasClass('fade-in-model')
          fadeIn = 300
        if fadeIn
          jqel.fadeIn(fadeIn)
        fadeIn
      removemodel:->
        return unless jqel = me.modelElementForElement(this)
        el = jqel[0]
        if el.hasAttribute('fadeoutmodel')
          fadeOut = +el.getAttribute('fadeinmodel')
          fadeOut = 200 unless fadeOut>0
        else if jqel.hasClass('fade-out-model')
          fadeOut = 2000
        if fadeOut
          jqel.fadeOut(fadeOut)
        fadeOut
    }


  queueModelEvent:(el,type, ifElementHasHandler)=>
    return if ifElementHasHandler and (!(cb = element.getAttribute('onchangemodel')) or typeof(cb)!='string' or !@getFunction(cb))

    modelEvents = @modelEvents
    modelEvents[type] ||= []
    modelEvents[type].push el
    return


  notifyModelChanges:=>
    #if @_doDebugCall then return @debugCall("notifyModelChanges",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    sels = ""
    for id,model of @changedModels
      sel = "."+model.class+"__onchangemodel"
      if sels.length
        sels += ","+sel
      else
        sels = sel
      if model.fieldWatchers
        for field of model.fieldChanges
          if watchers = model.fieldWatchers[field]
            for key, watcher of watchers when typeof(watcher)=='function'
              #try TODO
              watcher(model,field)

    me = this
    $(sels).filter(':not(.__deadModel)').each ->
      me.queueModelEvent(this, 'changemodel')

    return


  getFunction:(fn)=>
    return fn if typeof(fn)=='function'
    return unless typeof(fn)=='string'
    @_functionLookup ||= {}
    if (ret = @_functionLookup[fn]) != undefined
      ret if typeof(ret)=='function'
    else
      #try TODO
      ret = Function(fn)
      ret = null unless typeof(ret)=='function'
      @_functionLookup[fn] = ret

  notifyModelElements:=>
    modelEvents = @modelEvents
    @modelEvents = {}
    delayedRemoves = {}
    for type in ['removemodel', 'insertmodel', 'changemodel'] when elements = modelEvents[type]
      for element in elements
        cbret = undefined
        if (((cb = element.getAttribute('on'+type)) and typeof(cb)=='string') || (cb = @defaultModelCallbacks[type])) and (cb = @getFunction(cb))
          try 
            cbret = cb.call(element)
          catch e
            WARN("Calling a "+type+" hook on an element threw an exception: "+e.message+"\n\n>> "+e.stack)

        if type=='removemodel'
          cbret = 0 unless cbret==false
          if typeof(cbret)=='number'
            delayedRemoves[cbret] ||= []
            delayedRemoves[cbret].push element

    for delay,elements of delayedRemoves
      delay = +delay
      if delay==0
        $(elements).remove()
      else
        setTimeout(
          ->
            $(elements).remove()
          , delay
        )
    return

