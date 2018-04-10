document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_elements = class ModelDOM_elements
  constructor:-> 

  modelElementForElement:(el)->
    #if @_doDebugCall then return @debugCall("modelElementForElement",["el"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    if (id = el.getAttribute("modelroot")) && (root=$("#"+id)).length==1
      root
    else
      while el = el.parentElement
        if (id = el.getAttribute("modelroot")) && (root=$("#"+id)).length==1
          return root
      return

  modelIdForElement:(el,bubblesToParent,checkThisElementFirst,ignoreOverride)=>
    #if @_doDebugCall then return @debugCall("modelIdForElement",["el","bubblesToParent"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    return if $(el).hasClass('__deadModel')

    if checkThisElementFirst and el
      if bubblesToParent or el.getAttribute('using-parent-model')
        return el.getAttribute('parentmodelid') if el.hasAttribute('parentmodelid')
      else if !ignoreOverride and el.hasAttribute('overridemodelid')
        return el.getAttribute('overridemodelid') 
      else if el.hasAttribute('modelid')
        return el.getAttribute('modelid') 

    return unless root = @modelElementForElement(el)
    if bubblesToParent or el.getAttribute('using-parent-model')
      root[0].getAttribute('parentmodelid')
    else if !ignoreOverride and root[0].hasAttribute('overridemodelid')
      root[0].getAttribute('overridemodelid')
    else
      root[0].getAttribute('modelid')




  markerElementForElement:(el)=>
    #if @_doDebugCall then return @debugCall("markerElementForElement",["el"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    return unless jqel=@modelElementForElement(el)
    return unless collectionIndex=(el=jqel[0]).getAttribute("__collectionindex")
    return unless markerClass=el.getAttribute("__markerClass")
    markerCollectionClass = markerClass+"_collection-"+collectionIndex

    return unless (jqmarker=jqel.parent().children("."+markerCollectionClass)).length==1
    jqmarker

  modelForElement:(el,bubblesToParent,checkThisElementFirst,ignoreOverride)=>
    #if @_doDebugCall then return @debugCall("modelForElement",["el","bubblesToParent"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    @model(id) if (id = @modelIdForElement(el,bubblesToParent,checkThisElementFirst,ignoreOverride))!=undefined

