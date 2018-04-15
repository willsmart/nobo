/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_model;
if (!document.ModelDOM_classes) { document.ModelDOM_classes = {}; }
document.ModelDOM_classes.ModelDOM_model = (ModelDOM_model = (function() {
  ModelDOM_model = class ModelDOM_model {
    static initClass() {
  
      this.prototype.doDebugCall =true;
      this.prototype._doDebugCall =true;
  
      this.prototype._debugCallDepth =1;
    }
    constructor() {

      this.modelIdWithVariant = this.modelIdWithVariant.bind(this);
      this.model = this.model.bind(this);
      this.models = {};
      this.modelsByClass = {};
      this.needModels = {};
      this.doneWithModels = {};
    }

    constructLocation(o){
      let f, rowidres;
      if (!$.isPlainObject(o) || !o.type) { return; }
      if (o.rowid) { rowidres = /^([a-z\d]*)(?:\[([\w\d_]+)\])?$/.exec(o.rowid); }
      return `/${o.type}`+
        (rowidres && rowidres[1] && (rowidres[1]!=='default') ? `/${rowidres[1]}` : '')+
        (rowidres && rowidres[2] ? `:${rowidres[2]}` : '')+
        (o.variant && (o.variant!=='default') && /[\w-.]+/.test(o.variant) ? `~${o.variant}` : '')+
        (((f=o.name) && (typeof(f)==='string'))||(o.fields && (f=o.fields['name']) && (typeof(f)==='string')) ? `//${f.replace(/[^A-Za-z0-9-_.!~*'()]/g,'-')}` : '');
    }

    parseLocation(s){
      let res;
      if (!(res = /^\/(\w+)(?:\/([a-z\d]+))?(?::([\w\d_]+))?(?:(?:~|%7[eE])([\w-.]+))?(?:\/\/(.*))?$/.exec(s))) { return; }
      return {
        type: res[1],
        rowid: (res[2] && (res[2]!=='default') ? res[2] : '') + (res[3] ? `[${res[3]}]` : ''),
        variant: (res[4] && (res[4] !== 'default') ? res[4] : undefined),
        name: res[5]
      };
    }

    constructModelId(o){
      if (!$.isPlainObject(o) || !o.type) { return; }
      return (o.mine ? 'my ' : '')+
        o.type+
        (o.rowid && /^[a-z\d]+$/.test(o.rowid) ? `__${o.rowid}` : '__default')+
        (o.variant && /[\w-.]+/.test(o.variant) ? `__${o.variant}` : '__default');
    }

    parseModelId(s){
      let res;
      if (!(res = /^(my\b ?)?((?:[a-z0-9]+(?:_[a-z0-9]+)*))?(?:__([a-z\d]+))?(?:__([\w\-.]+))?$/.exec(s))) { return; }
      return {
        mine: res[1]!==undefined,
        type: res[2],
        rowid: (res[3] && (res[3]!=='default') ? res[3] : ''),
        variant: (res[4] && (res[4]!=='default') ? res[4] : undefined)
      };
    }

    modelIdWithVariant(id, variant){
      let o;
      if (!(o = this.parseModelId(id))) { return; }
      o.variant = variant;
      return this.constructModelId(o);
    }
    debugCall(fn,argNames,args){
      let arg;
      const depth = this._debugCallDepth++;
      if (depth>30) {
        ERROR("too deep");
        die();
      }
      const argDict = {};
      for (let ind = 0; ind < argNames.length; ind++) {
        const name = argNames[ind];
        arg = (args.length>ind ? args[ind] : undefined);
        argDict[name] = arg;
      }
      this._debugCallArgs = ((() => {
        const result = [];
        for (arg of Array.from(args)) {           result.push(arg);
        }
        return result;
      })());
      this._debugCallArgs.unshift(JSON.mystringify(argDict,4));
      this._debugCallArgs.unshift(">".repeat(depth)+" (window.BP:"+(document._bpIndex+1)+") "+fn);
      this._doDebugCall = false;
      const ret = this[fn].apply(this,args);
      if (ret!==undefined) { this.debug.apply(this,["<".repeat(depth)+" "+fn,ret]); }
      this._debugCallDepth = depth;
      return ret;
    }
    debug() {
      return console.log.apply(this,arguments);
    }


    model(modelId,name){
      //if @_doDebugCall then return @debugCall("model",["modelId"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

      let ret;
      if (ret = this.models[modelId]) {
        let tuple;
        if (tuple = this.modelsQueuedForDeletion[modelId]) {
          delete this.modelsQueuedForDeletion[modelId];
          if (this.modelsQueuedForDeletionByTime[tuple[1]]) { delete this.modelsQueuedForDeletionByTime[tuple[1]][modelId]; }
        }
      } else {
        let o;
        if (!(o = this.parseModelId(modelId))) { return; }

        ret = (this.models[modelId] = {
          id: modelId,
          mine: o.mine,
          type: o.type,
          name,
          ver: 0,
          rowid: o.rowid,
          variant: o.variant,
          memberModels: {},
          memberOfModels: {},
          fields:{},
          fieldChanges:{},
          overrideVariants:{},
          nextIndex:1,
          classSuffix: (!o.mine ? "" : "_mine")+
            (o.type==="" ? "" : `_type-${this.sanitizeClassName(o.type,true)}`)+
            (!o.rowid ? "" : `_id-${this.sanitizeClassName(o.rowid,true)}`)+
            (!o.variant ? "" : `_variant-${this.sanitizeClassName(o.variant,true)}`)
        });
        ret.class = `__model${ret.classSuffix}`;
        ret.classAsChild = `__childOf${ret.classSuffix}`;

        this.modelsByClass[ret.class] = ret;

        if (modelId!=='root') {
          this.needModels[modelId] = ret; 
          if (this.doneWithModels) { delete this.doneWithModels[modelId]; }
        }

        this.sendModels();
      }
      return ret;
    }
  };
  ModelDOM_model.initClass();
  return ModelDOM_model;
})());

