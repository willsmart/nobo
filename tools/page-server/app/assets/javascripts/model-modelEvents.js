/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_modelEvents;
if (!document.ModelDOM_classes) {
  document.ModelDOM_classes = {};
}
document.ModelDOM_classes.ModelDOM_modelEvents = ModelDOM_modelEvents = class ModelDOM_modelEvents {
  construct() {
    this.queueModelEvent = this.queueModelEvent.bind(this);
    this.notifyModelChanges = this.notifyModelChanges.bind(this);
    this.getFunction = this.getFunction.bind(this);
    this.notifyModelElements = this.notifyModelElements.bind(this);
    const me = this;
    this.defaultModelCallbacks = {};
    this.modelEvents = {};
    this.defaultModelCallbacks = {
      insertmodel() {
        let fadeIn, jqel;
        if (!(jqel = me.modelElementForElement(this))) {
          return;
        }
        const el = jqel[0];
        if (el.hasAttribute("fadeinmodel")) {
          fadeIn = +el.getAttribute("fadeinmodel");
          if (fadeIn <= 0) {
            fadeIn = 300;
          }
        } else if (jqel.hasClass("fade-in-model")) {
          fadeIn = 300;
        }
        if (fadeIn) {
          jqel.fadeIn(fadeIn);
        }
        return fadeIn;
      },
      removemodel() {
        let fadeOut, jqel;
        if (!(jqel = me.modelElementForElement(this))) {
          return;
        }
        const el = jqel[0];
        if (el.hasAttribute("fadeoutmodel")) {
          fadeOut = +el.getAttribute("fadeinmodel");
          if (fadeOut <= 0) {
            fadeOut = 200;
          }
        } else if (jqel.hasClass("fade-out-model")) {
          fadeOut = 2000;
        }
        if (fadeOut) {
          jqel.fadeOut(fadeOut);
        }
        return fadeOut;
      }
    };
  }

  queueModelEvent(el, type, ifElementHasHandler) {
    let cb;
    if (
      ifElementHasHandler &&
      (!(cb = element.getAttribute("onchangemodel")) || typeof cb !== "string" || !this.getFunction(cb))
    ) {
      return;
    }

    const { modelEvents } = this;
    if (!modelEvents[type]) {
      modelEvents[type] = [];
    }
    modelEvents[type].push(el);
  }

  notifyModelChanges() {
    //if @_doDebugCall then return @debugCall("notifyModelChanges",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    let sels = "";
    for (let id in this.changedModels) {
      const model = this.changedModels[id];
      const sel = `.${model.class}__onchangemodel`;
      if (sels.length) {
        sels += `,${sel}`;
      } else {
        sels = sel;
      }
      if (model.fieldWatchers) {
        for (let field in model.fieldChanges) {
          var watchers;
          if ((watchers = model.fieldWatchers[field])) {
            for (let key in watchers) {
              //try TODO
              const watcher = watchers[key];
              if (typeof watcher === "function") {
                watcher(model, field);
              }
            }
          }
        }
      }
    }

    const me = this;
    $(sels)
      .filter(":not(.__deadModel)")
      .each(function() {
        return me.queueModelEvent(this, "changemodel");
      });
  }

  getFunction(fn) {
    let ret;
    if (typeof fn === "function") {
      return fn;
    }
    if (typeof fn !== "string") {
      return;
    }
    if (!this._functionLookup) {
      this._functionLookup = {};
    }
    if ((ret = this._functionLookup[fn]) !== undefined) {
      if (typeof ret === "function") {
        return ret;
      }
    } else {
      //try TODO
      ret = Function(fn);
      if (typeof ret !== "function") {
        ret = null;
      }
      return (this._functionLookup[fn] = ret);
    }
  }

  notifyModelElements() {
    let elements;
    const { modelEvents } = this;
    this.modelEvents = {};
    const delayedRemoves = {};
    for (let type of ["removemodel", "insertmodel", "changemodel"]) {
      if ((elements = modelEvents[type])) {
        for (let element of elements) {
          var cb;
          let cbret = undefined;
          if (
            (((cb = element.getAttribute(`on${type}`)) && typeof cb === "string") ||
              (cb = this.defaultModelCallbacks[type])) &&
            (cb = this.getFunction(cb))
          ) {
            try {
              cbret = cb.call(element);
            } catch (e) {
              WARN(`Calling a ${type} hook on an element threw an exception: ${e.message}\n\n>> ${e.stack}`);
            }
          }

          if (type === "removemodel") {
            if (cbret !== false) {
              cbret = 0;
            }
            if (typeof cbret === "number") {
              if (!delayedRemoves[cbret]) {
                delayedRemoves[cbret] = [];
              }
              delayedRemoves[cbret].push(element);
            }
          }
        }
      }
    }

    for (let delay in delayedRemoves) {
      elements = delayedRemoves[delay];
      delay = +delay;
      if (delay === 0) {
        $(elements).remove();
      } else {
        setTimeout(() => $(elements).remove(), delay);
      }
    }
  }
};
