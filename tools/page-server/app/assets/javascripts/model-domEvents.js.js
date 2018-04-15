/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_domEvents;
if (!document.ModelDOM_classes) { document.ModelDOM_classes = {}; }
document.ModelDOM_classes.ModelDOM_domEvents = (ModelDOM_domEvents = class ModelDOM_domEvents {
  getTargetIfEvent(eventOrElement, cancelBubble, preventDefault){
    if ((eventOrElement instanceof jQuery.Event) || (eventOrElement instanceof Event)) {
      const event = eventOrElement;
      if (event.cancelBubble || (event.originalEvent && event.originalEvent.cancelBubble)) { return false; }
      if (preventDefault !== false) { event.preventDefault(); }
      if (cancelBubble !== false) {
        event.stopPropagation();
        event.cancelBubble = true;
        if (event.originalEvent) { event.originalEvent.cancelBubble = true; }
      }

      return event.target;
    } else {
      return eventOrElement;
    }
  }
});



$(document).ready(function() {
  $(window).focus(function() {
    if (document.modelDOM.windowIsFocussed) { return; }
    return document.modelDOM.windowIsFocussed = true;
  });
    //document.modelDOM.updateModels()

  $(window).blur(function() {
    if (!document.modelDOM.windowIsFocussed) { return; }
    return document.modelDOM.windowIsFocussed = false;
  });

  $(window).resize(() => document.modelDOM.periodicTasks());


  $(document).on("click", ".pushModel", function(event){
    if (event.originalEvent && event.originalEvent.cancelBubble) { return; }
    return document.modelDOM.pushModel(this,true,this.getAttribute('pushvariant'),event);
  });

  $(document).on("click", "[clickvariant]", event=> document.modelDOM.overrideVariant(event,event.target.getAttribute('clickvariant')));

  $(document).on("click", "[clickmodelid]", event=> document.modelDOM.overrideModelId(event,event.target.getAttribute('clickmodelid')));

  $(document).on("click", ".model-anchor[href]", function(event){
    let link = event.target.getAttribute('href');
    if (link.substring(0,1)==='#') { link = link.substring(1); }
    return $(`a[name="${link}"]`).each(function() {
      let el;
      if ((el = document.modelDOM.modelElementForElement(this)).length && el[0].parentElement && (el = document.modelDOM.modelElementForElement(el[0].parentElement)).length) {
        el.addClass('flash-heart-beat');
        return setTimeout(() => el.removeClass('flash-heart-beat')
        , 2000);
      }
    });
  });

  $(document).on("dragstart", ".model-draggable", function(event){
    let context, field, id, transfer;
    if (!event.originalEvent || !(transfer = event.originalEvent.dataTransfer)) { return; }
    if ((!(id = document.modelDOM.modelIdForElement(event.target))) || (!(context=event.target.getAttribute("dragcontextmodelid"))) || (!(field=event.target.getAttribute("dragcontextfield")))) {
      transfer.effectAllowed = "none";
      return false; 
    }

    transfer.setData("itemmodelid", document.modelDOM.modelIdWithVariant(id));
    transfer.setData("contextmodelid", context);
    transfer.setData("contextfield", field);
    return transfer.effectAllowed = "move";
  });

  $(document).on("dragenter", ".model-drag-space", function(event){
    if (!event.originalEvent || !event.originalEvent.fromElement) { return; }
    if (event.originalEvent.fromElement.getAttribute("dragcontextmodelid") !== event.target.getAttribute("dragcontextmodelid")) { return; }
    if (event.originalEvent.fromElement.getAttribute("dragcontextfield") !== event.target.getAttribute("dragcontextfield")) { return; }
    event.target.setAttribute('hasdrag','1');
    return event.preventDefault();
  });

  $(document).on("dragover", ".model-drag-space", event=> event.preventDefault());

  $(document).on("dragleave", ".model-drag-space", event=> event.target.removeAttribute('hasdrag'));

  return $(document).on("drop", ".model-drag-space", function(event){
    let context, field, id, transfer;
    event.target.removeAttribute('hasdrag');
    if (!event.originalEvent) { return; }
    if (!(transfer = event.originalEvent.dataTransfer)) { return; }
    if ((!(context=transfer.getData("contextmodelid"))) || (!(field=transfer.getData("contextfield"))) || (!(id=transfer.getData("itemmodelid")))) { return; }
    if (context !== event.target.getAttribute("dragcontextmodelid")) { return; }
    if (field !== event.target.getAttribute("dragcontextfield")) { return; }
    const afterId = event.target.getAttribute("aftermodelid");

    const formData = {
      item: id,
      field,
      move_to_after: afterId
    };
    document.modelDOM.submitWSMessage(undefined, "move_child", context, formData);
    return event.preventDefault();
  });
});
