document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_domEvents = class ModelDOM_domEvents
  getTargetIfEvent:(eventOrElement, cancelBubble, preventDefault)->
    if (eventOrElement instanceof jQuery.Event) or (eventOrElement instanceof Event)
      event = eventOrElement
      return false if event.cancelBubble or (event.originalEvent and event.originalEvent.cancelBubble)
      event.preventDefault() unless preventDefault == false
      unless cancelBubble == false
        event.stopPropagation()
        event.cancelBubble = true
        event.originalEvent.cancelBubble = true if event.originalEvent

      event.target
    else
      eventOrElement



$(document).ready ->
  $(window).focus ->
    return if document.modelDOM.windowIsFocussed
    document.modelDOM.windowIsFocussed = true
    #document.modelDOM.updateModels()

  $(window).blur ->
    return if !document.modelDOM.windowIsFocussed
    document.modelDOM.windowIsFocussed = false

  $(window).resize ->
    document.modelDOM.periodicTasks()


  $(document).on "click", ".pushModel", (event)->
    return if event.originalEvent and event.originalEvent.cancelBubble
    return document.modelDOM.pushModel(this,true,this.getAttribute('pushvariant'),event)

  $(document).on "click", "[clickvariant]", (event)->
    document.modelDOM.overrideVariant(event,event.target.getAttribute('clickvariant'));

  $(document).on "click", "[clickmodelid]", (event)->
    document.modelDOM.overrideModelId(event,event.target.getAttribute('clickmodelid'));

  $(document).on "click", ".model-anchor[href]", (event)->
    link = event.target.getAttribute 'href'
    link = link.substring(1) if link.substring(0,1)=='#'
    $('a[name="'+link+'"]').each ->
      if (el = document.modelDOM.modelElementForElement(this)).length and el[0].parentElement and (el = document.modelDOM.modelElementForElement(el[0].parentElement)).length
        el.addClass('flash-heart-beat')
        setTimeout(->
          el.removeClass('flash-heart-beat')
        , 2000)

  $(document).on "dragstart", ".model-draggable", (event)->
    return unless event.originalEvent && transfer = event.originalEvent.dataTransfer
    unless (id = document.modelDOM.modelIdForElement(event.target)) and (context=event.target.getAttribute("dragcontextmodelid")) and (field=event.target.getAttribute("dragcontextfield"))
      transfer.effectAllowed = "none"
      return false 

    transfer.setData("itemmodelid", document.modelDOM.modelIdWithVariant(id))
    transfer.setData("contextmodelid", context)
    transfer.setData("contextfield", field)
    transfer.effectAllowed = "move"

  $(document).on "dragenter", ".model-drag-space", (event)->
    return unless event.originalEvent and event.originalEvent.fromElement
    return unless event.originalEvent.fromElement.getAttribute("dragcontextmodelid") == event.target.getAttribute("dragcontextmodelid")
    return unless event.originalEvent.fromElement.getAttribute("dragcontextfield") == event.target.getAttribute("dragcontextfield")
    event.target.setAttribute('hasdrag','1')
    event.preventDefault()

  $(document).on "dragover", ".model-drag-space", (event)->
    event.preventDefault()

  $(document).on "dragleave", ".model-drag-space", (event)->
    event.target.removeAttribute('hasdrag')

  $(document).on "drop", ".model-drag-space", (event)->
    event.target.removeAttribute('hasdrag')
    return unless event.originalEvent
    return unless transfer = event.originalEvent.dataTransfer
    return unless (context=transfer.getData("contextmodelid")) and (field=transfer.getData("contextfield")) and (id=transfer.getData("itemmodelid"))
    return unless context == event.target.getAttribute("dragcontextmodelid")
    return unless field == event.target.getAttribute("dragcontextfield")
    afterId = event.target.getAttribute("aftermodelid")

    formData = {
      item: id,
      field: field,
      move_to_after: afterId
    }
    document.modelDOM.submitWSMessage(undefined, "move_child", context, formData)
    event.preventDefault()
