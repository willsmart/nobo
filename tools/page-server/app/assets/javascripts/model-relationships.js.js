/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_relationships;
if (!document.ModelDOM_classes) { document.ModelDOM_classes = {}; }
document.ModelDOM_classes.ModelDOM_relationships = (ModelDOM_relationships = class ModelDOM_relationships {
  constructor() {
    this.unlinkModels = this.unlinkModels.bind(this);
    this.linkModels = this.linkModels.bind(this);
    this.orphanModels = {};
    this.modelsQueuedForDeletion = {};
    this.modelsQueuedForDeletionByTime = {};
    this.secondsToKeepOrphanModelsBeforeDeletion = 20;
  }

  unlinkModels(parent,child,unrefCnt){
    if (typeof(unrefCnt)!=='number') { unrefCnt = 1; }
    return this.linkModels(parent,child,-unrefCnt);
  }

  linkModels(parent,child,refCnt){
    //if @_doDebugCall then return @debugCall("linkModels",["parent","child","refCnt"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    if (typeof(refCnt)!=='number') { refCnt = 1; }
    if (!$.isPlainObject(parent) || !$.isPlainObject(child) || (child===parent)) {
      return ERROR("Can't link models since they are the same or aren't models:",parent, child);
    }

    const v = (parent.memberModels[child.id] = (child.memberOfModels[parent.id] = (parent.memberModels[child.id]||0)+refCnt));
    if (v<=0) {
      delete parent.memberModels[child.id];
      delete child.memberOfModels[parent.id];
      if (!Object.keys(child.memberOfModels).length && (child.type!=="Template")) { this.queueOrphanModel(child); }
    } else { 
      let tuple;
      if (tuple = this.modelsQueuedForDeletion[child.id]) {
        delete this.modelsQueuedForDeletion[child.id];
        if (this.modelsQueuedForDeletionByTime[tuple[1]]) { delete this.modelsQueuedForDeletionByTime[tuple[1]][child.id]; }
      }
      delete this.orphanModels[child.id];
    }

    return v;
  }

  markOrphanModels() {
    let keys;
    if (!this.deletedModels) { this.deletedModels = []; }
    while ((keys = Object.keys(this.orphanModels)).length) {
      this.orphanModels = {};
      for (let modelId of Array.from(keys)) {
        var model;
        if ((model = this.models[modelId])) {
          this.deletedModels.push(model);
          for (let id in model.memberModels) { var child;
          const count = model.memberModels[id]; if ((child = this.models[id])) { this.unlinkModels(model,child,count); } }
          delete this.needModels[modelId];
          this.applyModelDiff(model,{});
        }
      }
    }
  }

  deleteOrphanModels() {
    for (let model of Array.from(this.deletedModels)) {
      delete this.models[model.id];
      delete this.modelsByClass[model.class];
      this.doneWithModels[model.id] = model;
    }
    if (this.deletedModels.length) { this.sendModels(); }
    this.deletedModels = [];
  }

  queueOrphanModel(model){
    const time = Math.floor(new Date().getTime()/1000);

    if (this.modelsQueuedForDeletion[model.id]) { return; }
    this.modelsQueuedForDeletion[model.id] = [model,time];

    if (!this.modelsQueuedForDeletionByTime[time]) { this.modelsQueuedForDeletionByTime[time] = {}; }
    this.modelsQueuedForDeletionByTime[time][model.id] = model;
  }

  commitQueuedOrphans() {
    const time = Math.floor(new Date().getTime()/1000);

    if (!this.manageDeletedModels_time) { this.manageDeletedModels_time = time; }
    if (!(this.manageDeletedModels_time < (time-this.secondsToKeepOrphanModelsBeforeDeletion))) { return; }

    for (let delTime = this.manageDeletedModels_time, end = time-this.secondsToKeepOrphanModelsBeforeDeletion, asc = this.manageDeletedModels_time <= end; asc ? delTime < end : delTime > end; asc ? delTime++ : delTime--) {
      var watingModels;
      if (!(watingModels = this.modelsQueuedForDeletionByTime[delTime])) { continue; }
      delete this.modelsQueuedForDeletionByTime[delTime];
      for (let id in watingModels) {
        const model = watingModels[id];
        delete this.modelsQueuedForDeletion[model.id];
        this.orphanModels[model.id] = model;
      }
    }

    this.manageDeletedModels_time = time-this.secondsToKeepOrphanModelsBeforeDeletion;

  }
});
