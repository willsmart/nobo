/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_misc;
if (!document.ModelDOM_classes) { document.ModelDOM_classes = {}; }
document.ModelDOM_classes.ModelDOM_misc = (ModelDOM_misc = class ModelDOM_misc {
  constructor() {
    this.getModelDOM = this.getModelDOM.bind(this);
    this.changePage = this.changePage.bind(this);
    this.windowIsFocussed = true;
  }


  markerIndex(field){
    if (typeof(field)!=='string') { return "self"; }
    return `marker-${document.modelDOM.sanitizeClassName(field,true)}`;
  }



  periodicTasks() {
    const body = $(document.body);
    if (body.hasClass('has-scrollbar')) {
      if (document.body.scrollHeight <= document.body.clientHeight) { return body.removeClass('has-scrollbar'); }
    } else {
      if (document.body.scrollHeight > document.body.clientHeight) { return body.addClass('has-scrollbar'); }
    }
  }


  getModelDOM(model, subtemplatePath){
    //if @_doDebugCall then return @debugCall("getModelDOM",["model", "subtemplatePath"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    let template;
    if (typeof(model.fields.dom)==='string') {
      return {
        dom:model.fields.dom,
        domModels:[model],
        templateModel: model.type === 'Template' ? model : undefined
      };
    } else if (template = this.templateForModel(model, subtemplatePath)) {
      let dom;
      return {
        dom:(typeof(dom = template.fields.dom)==='string' ? dom : "<div/>"),
        domModels:[model,template],
        templateModel:template
      };
    }
  }

  templateForModel(model, subtemplatePath){
    let ret;
    if (subtemplatePath) {
      let templateId;
      if (model.fields.subtemplates && (templateId = model.fields.subtemplates[subtemplatePath]) && (ret = this.model(templateId))) { return ret; }
    } else {
      if (model.fields.template && model.fields.template.array && (model.fields.template.array.length>=1) && (ret = model.fields.template.array[0].model)) { return ret; }
    }
  }


  changePage(newId, left, top){
    let jqel;
    if (this._doDebugCall) { return this.debugCall("changePage",["newId"],arguments); } else { if (this._doDebugCall = this.doDebugCall) { console.log.apply(this,this._debugCallArgs); window.BP(); } }
    if (typeof newId !== 'string') { return; }
    this.scrollTo = {left, top};
    this.applyModelDiff(this.model("root"),{page:[newId]});
    document.aautil.killModals();
    if (Object.getOwnPropertyNames(this.needModels).length && (jqel = $('#change-page-loading')).length) {
      document.aautil.toggle(jqel[0],undefined,true,false);
      this.sendModelsNow();
    } else { 
      this.updateModels();
    }
    return true;
  }
});




