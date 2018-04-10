document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_dom = class ModelDOM_dom
  constructor:->
    o = @parseLocation(window.location.pathname)
    unless id = @constructModelId(o)
      o = @parseLocation("/app")
      id = @constructModelId(o)
    location = @constructLocation(o)
    window.history.replaceState({modelId:id}, location, location)
 
    that = this
    @nextElid = 1
    $(document).ready ->
      that.applyModelDiff(that.model("root"),{page:[id]})
      that.sendModels()




  refreshLocation:(ifChanged)=>
    return unless (model = @models['root']) and (a = model.fields['page'].array) and a.length and (page = a[0].model)

    if ifChanged
      return unless (@changedModels['root'] and model.fieldChanges['page']) or (@changedModels[page.id] and page.fieldChanges['name'])

    name = if typeof(page.fields['name'])=='string' then page.fields['name'] else ""
    title = if typeof(page.fields['pageTitle'])=='string' then page.fields['pageTitle'] else name

    return unless location=@constructLocation(page)
    document.title = title
    info = {
      modelId: page.id       
    }
    window.history.replaceState(info, location, location)

  checkAppear:->
    if (els = $('.__offscreenModels:not(.__deadModel)').appear()).length
      #console.log("appeared", els)
      els.removeClass('__offscreenModels')
      els.addClass('__onscreenModels')
#      for el in els
#        if ep = el.getAttribute('modelEndpoint')
#          @usingEndpoint(ep)

  checkDisppear:->
    if (els = $('.__onscreenModels:not(.__deadModel)').appear()).length
      #console.log("disappeared", els)
      els.removeClass('__onscreenModels')
      els.addClass('__offscreenModels')
#      for el in els
#        if ep = el.getAttribute('modelEndpoint')
#          @stoppedUsingEndpoint(ep)




  updateModels:=>
    @updateIndex ||= 1
    @commitQueuedOrphans()
    @markOrphanModels()
    @removeDeletedModels()
    @deleteOrphanModels()
    @prepToRemakeModelsWithChangedDom()
    @refreshLocation(true)
    @updateTextAndAttributesOfModels()
    @notifyModelChanges()
    @insertChildModels()
    @remakeModelsWithChangedDom()
    @clearModelChanges()
    @notifyModelElements()
    @periodicTasks()
    @updateIndex++
    return





  updateTextAndAttributesOfModels:=>
    #if @_doDebugCall then return @debugCall("updateTextAndAttributesOfModels",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    sels = ""
    for id,model of @changedModels
      for field of model.fieldChanges
        sel = "."+model.class+"__v-"+@sanitizeClassName(field,true)
        if sels.length
          sels += ","+sel
        else
          sels = sel
    me = this
    $(sels).filter(':not(.__deadModel)').each ->
      me.updateTextAndAttributesOfElement(this)

    return

  prepToRemakeModelsWithChangedDom:=>
    #if @_doDebugCall then return @debugCall("prepToRemakeModelsWithChangedDom",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    sels = ""
    for id,model of @changedModels
      if model.fieldChanges["dom"]
        unless $.isPlainObject(f = model.fields["dom"]) && f.array && f.changes
          sel = "."+model.class+"__dom"
          if sels.length
            sels += ","+sel
          else
            sels = sel
      else if model.fieldChanges["template"]
        if $.isPlainObject(f = model.fields["template"]) && f.array && f.changes && model.fields["dom"]==undefined
          sel = "."+model.class+"__dom"
          if sels.length
            sels += ","+sel
          else
            sels = sel

    me = this

    remakeClass = '__remake_model__'+@updateIndex
    $(sels).filter(':not(.__deadModel)').each ->
      jqel = $(this)
      jqel.empty()
      jqel.addClass(remakeClass)

    return


  remakeModelsWithChangedDom:=>
    #if @_doDebugCall then return @debugCall("remakeModelsWithChangedDom",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    remakeClass = '__remake_model__'+@updateIndex
    me = this
    (jqels = $('.'+remakeClass)).removeClass(remakeClass).removeClass('__remake_model__')
    jqels.each ->
      me.remakeModelElement(this)

    return


  updateTextAndAttributesOfElement:(el,model)=>
    #if @_doDebugCall then return @debugCall("updateTextAndAttributesOfElement",["el","model"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    unless modelEl = @modelElementForElement(el)
      return ERROR("Can't update text and attributes of element since no parent model element could be determined by looking at its modelroot",el)
    return if modelEl.hasClass('__deadModel')

    unless model || (model = @modelForElement(el))
      return ERROR("Can't update text and attributes of element since no model was supplied, and the model could not be determined by looking at its classes",el)

    elid = modelEl[0].id

    textNodeIndex = 1
    for node in el.childNodes
      if node.nodeType == 3 # text node
        if (template = el.getAttribute("__template_textNode-"+textNodeIndex))
          s = @templatedText(template,model.fields,elid,model.id)
          node.textContent = s if typeof(s)=='string' && s!=node.textContent
        textNodeIndex++

    regex = /^__template_attr_((?!__template_).+)$/
    addAttr = {}
    for attr in el.attributes when attr.specified
      if match = regex.exec(attr.name)
        addAttr[match[1]] = @templatedText(attr.value,model.fields,elid,model.id)

    for own k,v of addAttr
      el.setAttribute(k,v)

    return


  insertChildModels:=>
    #if @_doDebugCall then return @debugCall("insertChildModels",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    sels = ""

    mappings = []
    for id,model of @changedModels
      for field of model.fieldChanges
        if $.isPlainObject(f = model.fields[field]) && f.array && f.changes
          prevIndex = f.markerIndex
          prevIsMarker = true
          for index,change of f.changes when change.type=='insert' || change.type=='edit'
            prevMappings = lastMappings || []
            lastMappings = []
            for prevEl in $("."+model.classAsChild+"__"+change.prevIndex).filter(':not(.__deadModel)')
              jqprevEl = $(prevEl)
              if newMappings = @insertNewModelElement(model,jqprevEl,undefined,jqprevEl.parent(),change.value,undefined,index,field,undefined,true)
                lastMappings.push(mapping) for mapping in newMappings
                mappings.push(mapping) for mapping in newMappings
            unless prevIsMarker
              for prevMapping in prevMappings when prevMapping.add.is("."+model.classAsChild+"__"+change.prevIndex)
                if newMappings = @insertNewModelElement(model,prevMapping.add,undefined,prevMapping.marker,change.value,undefined,index,field,undefined,true)
                  lastMappings.push(mapping) for mapping in newMappings
                  mappings.push(mapping) for mapping in newMappings

            prevIndex = index
            prevIsMarker = false

    # we need to add these after doing the other updates. Otherwise child collections that were made as part of making
    #  new nodes could potentially be updated using the diff for that collection
    mapping.after.after(mapping.add) for mapping in mappings
    return



  remakeModelElement:(el)=>
    #if @_doDebugCall then return @debugCall("remakeModelElement",["el"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    return unless (jqel = $('#'+el.id)).length==1 && jqel[0]==el

    jqwrapper = jqel unless (jqwrapper=$('#'+el.id+'_base')).length
    wrapper = jqwrapper[0]

    unless parentEl = wrapper.parentElement
      return ERROR("Can't remake model element since the element supplied has no parent",el)
    jqparentEl = $(parentEl)


    unless collectionIndex=wrapper.getAttribute("__collectionindex")
      return ERROR("Can't remake model element since the element supplied has no __collectionindex attribute, which should point to the marker element to copy for the new node",el)

    unless markerClass=wrapper.getAttribute("__markerClass")
      return ERROR("Can't remake model element since the element supplied has no __markerClass attribute, which should point to the marker element to copy for the new node",el)

    unless el.hasAttribute('collectionmodelid') and el.hasAttribute('itemmodelid')
      return ERROR("Can't remake model element since the element supplied has no model and parent model attributes",el)

    return unless (model = @models[el.getAttribute('itemmodelid')]) && (parentModel = @models[el.getAttribute('collectionmodelid')])

    if el.hasAttribute('overridemodelid')
      return unless overrideModel = @models[el.getAttribute('overridemodelid')]

    clss = wrapper.className.split(/\s+/)
    prfx = parentModel.classAsChild+"__"
    for cls in clss when cls.substring(0,prfx.length)==prfx and /^\d+$/.test(index=cls.substring(prfx.length))
      index = +index
      break

    #unless index!=undefined
    #  return ERROR("Can't remake model element since the element supplied has no index in its collection",el)

    mappings = @insertNewModelElement(parentModel,undefined,collectionIndex,jqparentEl,model,overrideModel,index,undefined,markerClass,false)
    for mapping in mappings when !mapping.after
      jqwrapper.replaceWith(mapping.add)

    return


  removeDeletedModels:=>
    #if @_doDebugCall then return @debugCall("removeDeletedModels",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    sels = ""
    for id,model of @changedModels
      for field,change of model.fieldChanges
        if $.isPlainObject(f = model.fields[field]) && f.array && f.changes
          for index,change of f.changes when change.type=='delete' || change.type=='edit'
            sel = "."+model.classAsChild+"__"+index
            if sels.length
              sels += ","+sel
            else
              sels = sel
        else if $.isArray(change)
          for index in change
            sel = "."+model.classAsChild+"__"+index
            if sels.length
              sels += ","+sel
            else
              sels = sel

    if sels.length
      els = $(sels).filter(':not(.__deadModel)')
      els.find('*').addBack().addClass('__deadModel')
      for el in els
        @queueModelEvent(el,'removemodel')

    return


  insertNewModelElement:(parentModel,jqprevEl,collectionIndex,jqparentEl,model,overrideModel,index,field,markerClass,justReturnMapping,depth,inSubtemplateForModelIds)=>

    die() if depth>10
    depth = (depth||0)+1

    unless collectionIndex
      unless jqprevEl.length == 1
        return ERROR("Can't insert new model element since no unique prev element was supplied",jqprevEl)
      unless collectionIndex=(prevEl = jqprevEl[0]).getAttribute("__collectionindex")
        return ERROR("Can't insert new model element since the prev element supplied has no __collectionindex attribute, which should point to the marker element to copy for the new node",jqprevEl)

    markerClass = parentModel.classAsChild+"__"+@markerIndex(field) unless markerClass

    markerCollectionClass = markerClass+"_collection-"+collectionIndex
    if jqparentEl.is("."+markerCollectionClass)
      jqmarker = jqparentEl
    else
      unless (jqmarker=jqparentEl.children("."+markerCollectionClass)).length==1
        return ERROR("Can't insert new model element since no unique marker node was found with class "+markerCollectionClass,jqmarker)

    placeholderClass = markerClass+"_placeholder"

    subtemplatePath = jqmarker[0].getAttribute('__subtemplatePath') if jqmarker[0].hasAttribute('__subtemplatePath')

    fieldSubstitutes = {}
    for attr in jqmarker[0].attributes when attr.specified
      continue unless match = /^(\w+)_field$/.exec(attr.name)
      fieldSubstitutes[match[1]] = @quickStartupTemplatedText(attr.value,model,parentModel,{},elid)

    elid = "model_"+(@nextElid++)

    for overrideCount in [0...10]
      if overrideCount == 10
        WARN("too many override variants/models")
        break
      domInfo = @getModelDOM(overrideModel || model, subtemplatePath) || {dom:'<div/>',domModels:[overrideModel || model]}
      jqnode = $('<div/>') unless (jqnode = $(domInfo.dom)) && jqnode.length == 1
      jqnode[0].id = elid

      if jqnode[0].hasAttribute('overridevariant')
        overrideVariant = @quickTemplatedText(jqnode[0].getAttribute('overridevariant'),model,fieldSubstitutes,elid)
        newOverrideModel = @model(@modelIdWithVariant(model.id,overrideVariant)) unless overrideVariant=='<default>'
      else if jqnode[0].hasAttribute('overridemodelid')
        overrideModelId = @quickTemplatedText(jqnode[0].getAttribute('overridemodelid'),model,fieldSubstitutes,elid)
        newOverrideModel = @model(overrideModelId) unless overrideModelId=='<default>'
      else
        break

      break if newOverrideModel == (overrideModel || model)

      overrideModel = newOverrideModel


      # if it's a subtemplate, this dom should be inserted using the parent template's model and parent model
    if jqmarker[0].hasAttribute("__usemodelid") and jqmarker[0].hasAttribute("__useparentmodelid")
      useModel = @model(jqmarker[0].getAttribute("__usemodelid"))
      useParentModel = @model(jqmarker[0].getAttribute("__useparentmodelid"))
    else
      useParentModel = parentModel
      useModel = model

    fieldSubstitutes = {}
    for attr in jqmarker[0].attributes when attr.specified
      continue unless match = /^(\w+)_field$/.exec(attr.name)
      fieldSubstitutes[match[1]] = @quickStartupTemplatedText(attr.value,useModel,useParentModel,{},elid)

    jqnode[0].setAttribute("modelid",useModel.id)
    jqnode[0].setAttribute("overridemodelid",overrideModel.id) if overrideModel
    jqnode[0].setAttribute("parentmodelid",useParentModel.id)
    jqnode[0].setAttribute("itemmodelid",model.id)
    jqnode[0].setAttribute("collectionmodelid",parentModel.id)
    jqnode[0].removeAttribute("variant")

    useModel = overrideModel if overrideModel

    jqnode.addClass(useModel.class) if useModel
    if domInfo.domModels
      for domModel in domInfo.domModels
        jqnode.addClass(domModel.class+"__dom")

    jqwrapped = jqnode

    unless jqmarker.hasClass(placeholderClass)
      jqwrapper = jqmarker.clone()      
      jqwrapper[0].removeAttribute("variant")
      if style = jqmarker[0].getAttribute('_style')
        jqwrapper[0].removeAttribute('_style')
        jqwrapper[0].setAttribute('style', style)
      if styleTemplate = jqmarker[0].getAttribute('__template_attr__style')
        jqwrapper[0].removeAttribute('__template_attr__style')
        jqwrapper[0].setAttribute('__template_attr_style', styleTemplate)

      jqwrapper.removeClass(markerClass)
      jqwrapper.removeClass(markerCollectionClass)
      jqwrapper.css("display","")
      jqwrapper[0].id = elid+"_base"

      if (jqplaceholderEl = jqwrapper.find("."+placeholderClass)).length
        for cls in jqplaceholderEl[0].className.split(/\s+/) when cls && cls!=placeholderClass
          jqnode.addClass(cls)
        for attr in jqplaceholderEl[0].attributes when attr.specified and attr.name!='class'
          jqnode[0].setAttribute(attr.name, attr.value)
        jqplaceholderEl.replaceWith(jqnode)

      jqnode = jqwrapper

    jqnode[0].setAttribute("__collectionindex",collectionIndex)
    jqnode[0].setAttribute("__markerClass",markerClass)

    usingParentModel = useModel.type=='Template'
    @setupModelNodeSubtree(useModel,useParentModel,usingParentModel,jqnode,false,undefined,elid,[1],fieldSubstitutes,domInfo.templateModel,subtemplatePath,{}) if useModel

    clss = jqmarker[0].className.split(/\s+/)
    for cls in clss when /^__childOf(?:(?!__marker-).)*$/.test(cls)
      jqnode.addClass(cls)

    ret = [{add:jqnode, after:jqprevEl, marker:jqmarker}]
    @queueModelEvent(jqnode[0],'insertmodel')
    @queueModelEvent(jqwrapped[0],'insertmodel') unless jqwrapped[0]==jqnode[0]

    @insertNewModelElementChildren(useModel,jqnode,justReturnMapping,depth,inSubtemplateForModelIds,ret) if useModel
    @insertNewModelElementChildren(useParentModel,jqnode,justReturnMapping,depth,inSubtemplateForModelIds,ret) if useParentModel and useModel!=useParentModel
    @insertNewModelElementChildren(domInfo.templateModel,jqnode,justReturnMapping,depth,inSubtemplateForModelIds,ret) if domInfo.templateModel

    index = 'single' if index==undefined
    for mapping in ret when parentModel
      mapping.add.addClass(parentModel.classAsChild+"__"+index)

    unless justReturnMapping
      for mapping in ret
        mapping.after.after(mapping.add) if mapping.after

    ret



  insertNewModelElementChildren:(model,jqnode,justReturnMapping,depth,inSubtemplateForModelIds,ret)=>
    ret||=[]
    return unless model
    childMarkerSel = "."+model.classAsChild+"__"+@markerIndex()
    for childField,f of model.fields when childField != 'subtemplates' and f.array
      childMarkerSel = "."+model.classAsChild+"__"+f.markerIndex
      if jqnode.is(childMarkerSel)
        jqprevChildEl = jqnode
        for m in f.array
          if mappings = @insertNewModelElement(model,jqprevChildEl,undefined,jqnode,m.model,undefined,m.index,childField,undefined,justReturnMapping,depth,inSubtemplateForModelIds)
            jqprevChildEl = mappings[0].add
            ret.push(mapping) for mapping in mappings
      else
        for childMarkerEl in jqnode.find(childMarkerSel)
          jqprevChildEl = $(childMarkerEl)
          jqpar = jqprevChildEl.parent()
          for m in f.array
            if mappings = @insertNewModelElement(model,jqprevChildEl,undefined,jqpar,m.model,undefined,m.index,childField,undefined,false,depth,inSubtemplateForModelIds)
              jqprevChildEl = mappings[0].add
    if subtemplates = model.fields.subtemplates
      for subtemplatePath,template of subtemplates when !(inSubtemplateForModelIds && inSubtemplateForModelIds[model.id])
        markerClass = model.classAsChild+"__"+@markerIndex('subtemplates')+'__'+@sanitizeClassName(subtemplatePath,true)
        childMarkerSel = "."+markerClass
        unless jqnode.is(childMarkerSel)
          for childMarkerEl in jqnode.find(childMarkerSel)
            jqprevChildEl = $(childMarkerEl)
            jqpar = jqprevChildEl.parent()
            inSubtemplateForModelIds ||= {}
            inSubtemplateForModelIds[model.id] = true
            if mappings = @insertNewModelElement(model,jqprevChildEl,childMarkerEl.getAttribute("__collectionindex"),jqpar,model,undefined,undefined,childField,markerClass,false,depth,inSubtemplateForModelIds)
              jqprevChildEl = mappings[0].add
            delete inSubtemplateForModelIds[model.id]
    ret



  setupModelNodeSubtree:(model,parentModel,usingParentModel,jqnode,isDesc,field,elid,acollectionIndex,fieldSubstitutes,template,subtemplatePath,modelChildIndexesByField)=>
    #if @_doDebugCall then return @debugCall("setupModelNodeSubtree",["model","parentModel","usingParentModel","jqnode","isDesc","field","elid","acollectionIndex","fieldSubstitutes","template","subtemplatePath","modelChildIndexesByField"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    return if jqnode.length!=1 || (isDesc && jqnode.hasClass('modelStop'))
    node = jqnode[0]

    if jqnode.hasClass("using-this-model")
      usingParentModel = false
    else if jqnode.hasClass("using-parent-model")
      usingParentModel = true

    if usingParentModel
      jqnode.attr("using-parent-model","1")

    usingModel = (if usingParentModel then parentModel else model)

    hasValueFields = {}
    addAttr = {}
    addClasses = {}

    addAttr["modelroot"] = elid
    clss = node.className.split(/\s+/)

    # setup model containers, any node marked with a class like users-model-child will be seen as a marker for an array of children under that field,
    # unless it is prefixed with 'subtemplate-uses-' which simply ensures that field exists in the incoming model (and is available for subtemplates to use)

    if field==undefined
      break for cls in clss when match=/^(?!subtemplate-uses-)([\w_]*)-model-child$/.exec(cls)
      if match
        field=match[1]
        if index = modelChildIndexesByField[field]
          index += 1
          modelChildIndexesByField[field] = index
          field += "-"+index
        else
          modelChildIndexesByField[field] = 1
      else
        break for cls in clss when match=/^model-child$/.exec(cls)
        if match
          field=null

          if node.hasAttribute("fieldasmodelchild")
            field = node.getAttribute("fieldasmodelchild")

            if startupFields = @startupTemplateFields(field)
              field = @templatedText(field,fieldSubstitutes||{},elid,usingModel.id,parentModel,startupFields)
              addAttr["fieldasmodelchild"] = field

      if field!=undefined
        markerClass = model.classAsChild+"__"+@markerIndex(field)
        collectionIndex = acollectionIndex[0]++
        unless jqnode.find(".model-placeholder").length
          addClasses["model-placeholder"] = true
          addClasses[markerClass+"_placeholder"] = true
          isPlaceholder = true
        addClasses[markerClass] = true
        addClasses[markerClass+"_collection-"+collectionIndex] = true
        addAttr["__markerClass"] = markerClass
        addAttr["__collectionindex"] = collectionIndex
        if style = jqnode[0].getAttribute('style')
          jqnode[0].setAttribute('_style', style)
        jqnode[0].setAttribute("style","display:none;")
        jqnode.removeClass(cls)
        isMarker = true

      # setup model subtemplates, any node marked with a class like users-subtemplate will be seen as a marker for an array of children under that field, the difference being that they are the children of the template

      else if template
        break for cls in clss when match=/^(\w*)-subtemplate$/.exec(cls)
        if match
          field=match[1]
          if node.hasAttribute 'model'
            if template
              markerClass = template.classAsChild+"__"+@markerIndex(field)
              collectionIndex = acollectionIndex[0]++
              unless jqnode.find(".subtemplate-placeholder").length
                addClasses["subtemplate-placeholder"] = true
                addClasses[markerClass+"_placeholder"] = true
                isPlaceholder = true
              addClasses[markerClass] = true
              addClasses[markerClass+"_collection-"+collectionIndex] = true
              addAttr["__markerClass"] = markerClass
              addAttr["__collectionindex"] = collectionIndex
              #addAttr["__usemodelid"] = node.hasAttribute
              #addAttr["__useparentmodelid"] = parentModel.id
              if style = jqnode[0].getAttribute('style')
                jqnode[0].setAttribute('_style', style)
              jqnode[0].setAttribute("style","display:none;")
              jqnode.removeClass(cls)
              isMarker = true
          else
            newPath = (if subtemplatePath then subtemplatePath+' ' else '')+field
            markerClass = model.classAsChild+"__"+@markerIndex('subtemplates')
            markerClass = model.classAsChild+"__"+@markerIndex('subtemplates')+'__'+@sanitizeClassName(newPath,true)
            collectionIndex = acollectionIndex[0]++
            unless jqnode.find(".model-placeholder").length
              addClasses["model-placeholder"] = true
              addClasses[markerClass+"_placeholder"] = true
              isPlaceholder = true
            addClasses[markerClass] = true
            addClasses[markerClass+"_collection-"+collectionIndex] = true
            addAttr["__subtemplatePath"] = newPath
            addAttr["__markerClass"] = markerClass
            addAttr["__collectionindex"] = collectionIndex
            if style = jqnode[0].getAttribute('style')
              jqnode[0].setAttribute('_style', style)
            jqnode[0].setAttribute("style","display:none;")
            jqnode.removeClass(cls)
            isMarker = true

    else if jqnode.hasClass("model-placeholder")
      addClasses[model.classAsChild+"__"+@markerIndex(field)+"_placeholder"] = true
      isPlaceholder = true
    else if jqnode.hasClass("subtemplate-placeholder") and template
      addClasses[template.classAsChild+"__"+@markerIndex(field)+"_placeholder"] = true
      isPlaceholder = true

    if isPlaceholder
      jqnode.empty()
    else 
      unless isMarker
        # setup templates for attributes and textnodes that need replacing based on the model value

        for attr in node.attributes when attr.specified
          value = attr.value
          continue if /^__template_/.test(attr.name)


          if startupFields = @startupTemplateFields(value)
            value = @templatedText(value,fieldSubstitutes||{},elid,usingModel.id,parentModel,startupFields)
            addAttr[attr.name] = value

          continue unless fields = @templateFields(value)
          if fieldSubstitutes
            hasSubs = false
            break for f in fields when hasSubs=(fieldSubstitutes[f.field]!=undefined)
            if hasSubs
              value = @templatedText(value,fieldSubstitutes,elid,usingModel.id,parentModel,fields,true)
              unless fields = @templateFields(value)
                addAttr[attr.name] = value
                continue

          addAttr["__template_attr_"+attr.name] = value
          addAttr[attr.name] = @templatedText(value,usingModel.fields,elid,usingModel.id,parentModel,fields)
          for f in fields
            hasValueFields[f.field] = true
            hasValueFields[f2.field] = true for f2 in f.defFields if f.defFields

      textNodeIndex = 1
      for child in node.childNodes
        if child.nodeType == 3 # text node
          thisindex = textNodeIndex++
          value = child.textContent

          if startupFields = @startupTemplateFields(value)
            value = @templatedText(value,fieldSubstitutes||{},elid,usingModel.id,parentModel,startupFields)
            child.textContent = value

          continue unless fields = @templateFields(value)
          if fieldSubstitutes
            hasSubs = false
            break for f in fields when hasSubs=(fieldSubstitutes[f.field]!=undefined)
            if hasSubs
              value = @templatedText(value,fieldSubstitutes,elid,usingModel.id,parentModel,fields,true)
              unless fields = @templateFields(value)
                child.textContent = value
                continue

            addAttr["__template_textNode-"+thisindex] = value
            child.textContent = @templatedText(value,usingModel.fields,usingModel.id,parentModel,elid,fields)
            for f in fields
              hasValueFields[f.field] = true
              hasValueFields[f2.field] = true for f2 in f.defFields if f.defFields
        else if child.nodeType == 1 # element
          @setupModelNodeSubtree(model,parentModel,usingParentModel,$(child),true,field,elid,acollectionIndex,fieldSubstitutes,template,subtemplatePath,modelChildIndexesByField)


    # mark which values this node is concerned with
    for field of hasValueFields
      addClasses[usingModel.class+"__v-"+@sanitizeClassName(field,true)] = true

    if node.hasAttribute 'onchangemodel'
      addClasses[usingModel.class+'__onchangemodel'] = true

    # actually set the attributes and classes
    node.setAttribute(k,v) for k,v of addAttr
    jqnode.addClass(cls) for cls of addClasses

    return


  overrideVariant:(el,variant)=>
    el = @getTargetIfEvent(el)
      
    return false unless (jqel = @modelElementForElement(el)) and (model = @modelForElement(jqel[0])) and (overrideModelId = @modelIdWithVariant(model.id,variant))
    @overrideModelId(el,overrideModelId)
    false

  overrideModelId:(el,overrideModelId)=>
    el = @getTargetIfEvent(el)
      
    return false unless (jqel = @modelElementForElement(el)) and (model = @modelForElement(jqel[0]))
    el = jqel[0]

    overrideModelIdWas = el.getAttribute('overridemodelid') if el.hasAttribute('overridemodelid')
    return false if overrideModelId==overrideModelIdWas

    el.setAttribute('overridemodelid', overrideModelId)

    if overrideModelIdWas and (overrideModelWas = model.overrideVariants[overrideModelIdWas])
      delete model.overrideVariants[overrideModelIdWas]
      @unlinkModels(model,overrideModelWas)

    if overrideModelId and (overrideModel = @model(overrideModelId))
      model.overrideVariants[overrideModelId] = overrideModel
      @linkModels(model,overrideModel)

    jqel.addClass '__remake_model__'
    jqel.addClass '__remake_model__'+@updateIndex
    @updateModels() unless Object.getOwnPropertyNames(@needModels).length
    false


  $(document.body).on 'appear', '.__offscreenModels', (event, nodes)->
    #console.log("on appear", arguments)
    document.modelDOM.checkAppear()

  $(document.body).on 'disappear', '.__onscreenModels', (event, nodes)->
    #console.log("on disappear", arguments)
    document.modelDOM.checkAppear()
