/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_elements;
if (!document.ModelDOM_classes) { document.ModelDOM_classes = {}; }
document.ModelDOM_classes.ModelDOM_elements = (ModelDOM_elements = class ModelDOM_elements {
  constructor() {
    this.modelIdForElement = this.modelIdForElement.bind(this);
    this.markerElementForElement = this.markerElementForElement.bind(this);
    this.modelForElement = this.modelForElement.bind(this);
  } 

  modelElementForElement(el){
    //if @_doDebugCall then return @debugCall("modelElementForElement",["el"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    let id, root;
    if ((id = el.getAttribute("modelroot")) && ((root=$(`#${id}`)).length===1)) {
      return root;
    } else {
      while ((el = el.parentElement)) {
        if ((id = el.getAttribute("modelroot")) && ((root=$(`#${id}`)).length===1)) {
          return root;
        }
      }
      return;
    }
  }

  modelIdForElement(el,bubblesToParent,checkThisElementFirst,ignoreOverride){
    //if @_doDebugCall then return @debugCall("modelIdForElement",["el","bubblesToParent"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    let root;
    if ($(el).hasClass('__deadModel')) { return; }

    if (checkThisElementFirst && el) {
      if (bubblesToParent || el.getAttribute('using-parent-model')) {
        if (el.hasAttribute('parentmodelid')) { return el.getAttribute('parentmodelid'); }
      } else if (!ignoreOverride && el.hasAttribute('overridemodelid')) {
        return el.getAttribute('overridemodelid'); 
      } else if (el.hasAttribute('modelid')) {
        return el.getAttribute('modelid'); 
      }
    }

    if (!(root = this.modelElementForElement(el))) { return; }
    if (bubblesToParent || el.getAttribute('using-parent-model')) {
      return root[0].getAttribute('parentmodelid');
    } else if (!ignoreOverride && root[0].hasAttribute('overridemodelid')) {
      return root[0].getAttribute('overridemodelid');
    } else {
      return root[0].getAttribute('modelid');
    }
  }




  markerElementForElement(el){
    //if @_doDebugCall then return @debugCall("markerElementForElement",["el"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    let collectionIndex, jqel, jqmarker, markerClass;
    if (!(jqel=this.modelElementForElement(el))) { return; }
    if (!(collectionIndex=(el=jqel[0]).getAttribute("__collectionindex"))) { return; }
    if (!(markerClass=el.getAttribute("__markerClass"))) { return; }
    const markerCollectionClass = markerClass+"_collection-"+collectionIndex;

    if ((jqmarker=jqel.parent().children(`.${markerCollectionClass}`)).length!==1) { return; }
    return jqmarker;
  }

  modelForElement(el,bubblesToParent,checkThisElementFirst,ignoreOverride){
    //if @_doDebugCall then return @debugCall("modelForElement",["el","bubblesToParent"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    let id;
    if ((id = this.modelIdForElement(el,bubblesToParent,checkThisElementFirst,ignoreOverride))!==undefined) { return this.model(id); }
  }
});

