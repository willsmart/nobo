document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_domState = class ModelDOM_domState
  constructor:->
 


  pushState:(id, event)=>
    if event
      event.preventDefault()
      event.stopPropagation()
    return unless location=@constructLocation(@parseModelId(id))
    info = {
      modelId:id,
      top: window.pageYOffset || document.documentElement.scrollTop,
      left: window.pageXOffset || document.documentElement.scrollLeft      
    }
    window.history.pushState(info, location, location)
    @changePage(id)
    dataLayer.push {
      event: 'VirtualPageChange'
    }
    $(document).trigger('VirtualPageChange')
    return

  pushModel:(el,specifyVariant,variant,event)=>
    if event
      event.preventDefault()
      event.stopPropagation()
    return unless modelId=@modelIdForElement(el,undefined,true)
    unless specifyVariant==false
      return unless modelId=@modelIdWithVariant(modelId,variant)
    if event.metaKey and (location=@constructLocation(@parseModelId(modelId)))
      window.open(location, '_blank').focus()
    else      
      @pushState(modelId)


$(document).ready ->
  window.onpopstate = (e)->
    if e.state && e.state.modelId
      document.modelDOM.changePage(e.state.modelId, e.state.left, e.state.top) 
  window.onreplacestate = (e)->
