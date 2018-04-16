/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS203: Remove `|| {}` from converted for-own loops
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_dom;
if (!document.ModelDOM_classes) {
  document.ModelDOM_classes = {};
}
document.ModelDOM_classes.ModelDOM_dom = ModelDOM_dom = (function() {
  ModelDOM_dom = class ModelDOM_dom {
    static initClass() {
      $(document.body).on("appear", ".__offscreenModels", (event, nodes) =>
        //console.log("on appear", arguments)
        document.modelDOM.checkAppear()
      );

      $(document.body).on("disappear", ".__onscreenModels", (event, nodes) =>
        //console.log("on disappear", arguments)
        document.modelDOM.checkAppear()
      );
    }
    construct() {
      let id;
      this.refreshLocation = this.refreshLocation.bind(this);
      this.updateModels = this.updateModels.bind(this);
      this.updateTextAndAttributesOfModels = this.updateTextAndAttributesOfModels.bind(this);
      this.prepToRemakeModelsWithChangedDom = this.prepToRemakeModelsWithChangedDom.bind(this);
      this.remakeModelsWithChangedDom = this.remakeModelsWithChangedDom.bind(this);
      this.updateTextAndAttributesOfElement = this.updateTextAndAttributesOfElement.bind(this);
      this.insertChildModels = this.insertChildModels.bind(this);
      this.remakeModelElement = this.remakeModelElement.bind(this);
      this.removeDeletedModels = this.removeDeletedModels.bind(this);
      this.insertNewModelElement = this.insertNewModelElement.bind(this);
      this.insertNewModelElementChildren = this.insertNewModelElementChildren.bind(this);
      this.setupModelNodeSubtree = this.setupModelNodeSubtree.bind(this);
      this.overrideVariant = this.overrideVariant.bind(this);
      this.overrideModelId = this.overrideModelId.bind(this);
      let o = this.parseLocation(window.location.pathname);
      if (!(id = this.constructModelId(o))) {
        o = this.parseLocation("/app");
        id = this.constructModelId(o);
      }
      const location = this.constructLocation(o);
      window.history.replaceState({ modelId: id }, location, location);

      const that = this;
      this.nextElid = 1;
      $(document).ready(function() {
        that.applyModelDiff(that.model("root"), { page: [id] });
        return that.sendModels();
      });
    }

    refreshLocation(ifChanged) {
      let a, location, model, page;
      if (!(model = this.models["root"]) || !(a = model.fields["page"].array) || !a.length || !(page = a[0].model)) {
        return;
      }

      if (ifChanged) {
        if (
          (!this.changedModels["root"] || !model.fieldChanges["page"]) &&
          (!this.changedModels[page.id] || !page.fieldChanges["name"])
        ) {
          return;
        }
      }

      const name = typeof page.fields["name"] === "string" ? page.fields["name"] : "";
      const title = typeof page.fields["pageTitle"] === "string" ? page.fields["pageTitle"] : name;

      if (!(location = this.constructLocation(page))) {
        return;
      }
      document.title = title;
      const info = {
        modelId: page.id
      };
      return window.history.replaceState(info, location, location);
    }

    checkAppear() {
      let els;
      if ((els = $(".__offscreenModels:not(.__deadModel)").appear()).length) {
        //console.log("appeared", els)
        els.removeClass("__offscreenModels");
        return els.addClass("__onscreenModels");
      }
    }
    //      for el in els
    //        if ep = el.getAttribute('modelEndpoint')
    //          @usingEndpoint(ep)

    checkDisppear() {
      let els;
      if ((els = $(".__onscreenModels:not(.__deadModel)").appear()).length) {
        //console.log("disappeared", els)
        els.removeClass("__onscreenModels");
        return els.addClass("__offscreenModels");
      }
    }
    //      for el in els
    //        if ep = el.getAttribute('modelEndpoint')
    //          @stoppedUsingEndpoint(ep)

    updateModels() {
      if (!this.updateIndex) {
        this.updateIndex = 1;
      }
      this.commitQueuedOrphans();
      this.markOrphanModels();
      this.removeDeletedModels();
      this.deleteOrphanModels();
      this.prepToRemakeModelsWithChangedDom();
      this.refreshLocation(true);
      this.updateTextAndAttributesOfModels();
      this.notifyModelChanges();
      this.insertChildModels();
      this.remakeModelsWithChangedDom();
      this.clearModelChanges();
      this.notifyModelElements();
      this.periodicTasks();
      this.updateIndex++;
    }

    updateTextAndAttributesOfModels() {
      //if @_doDebugCall then return @debugCall("updateTextAndAttributesOfModels",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

      let sels = "";
      for (let id in this.changedModels) {
        const model = this.changedModels[id];
        for (let field in model.fieldChanges) {
          const sel = `.${model.class}__v-${this.sanitizeClassName(field, true)}`;
          if (sels.length) {
            sels += `,${sel}`;
          } else {
            sels = sel;
          }
        }
      }
      const me = this;
      $(sels)
        .filter(":not(.__deadModel)")
        .each(function() {
          return me.updateTextAndAttributesOfElement(this);
        });
    }

    prepToRemakeModelsWithChangedDom() {
      //if @_doDebugCall then return @debugCall("prepToRemakeModelsWithChangedDom",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

      let sels = "";
      for (let id in this.changedModels) {
        var f, sel;
        const model = this.changedModels[id];
        if (model.fieldChanges["dom"]) {
          if (!$.isPlainObject((f = model.fields["dom"])) || !f.array || !f.changes) {
            sel = `.${model.class}__dom`;
            if (sels.length) {
              sels += `,${sel}`;
            } else {
              sels = sel;
            }
          }
        } else if (model.fieldChanges["template"]) {
          if (
            $.isPlainObject((f = model.fields["template"])) &&
            f.array &&
            f.changes &&
            model.fields["dom"] === undefined
          ) {
            sel = `.${model.class}__dom`;
            if (sels.length) {
              sels += `,${sel}`;
            } else {
              sels = sel;
            }
          }
        }
      }

      const me = this;

      const remakeClass = `__remake_model__${this.updateIndex}`;
      $(sels)
        .filter(":not(.__deadModel)")
        .each(function() {
          const jqel = $(this);
          jqel.empty();
          return jqel.addClass(remakeClass);
        });
    }

    remakeModelsWithChangedDom() {
      //if @_doDebugCall then return @debugCall("remakeModelsWithChangedDom",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

      let jqels;
      const remakeClass = `__remake_model__${this.updateIndex}`;
      const me = this;
      (jqels = $(`.${remakeClass}`)).removeClass(remakeClass).removeClass("__remake_model__");
      jqels.each(function() {
        return me.remakeModelElement(this);
      });
    }

    updateTextAndAttributesOfElement(el, model) {
      //if @_doDebugCall then return @debugCall("updateTextAndAttributesOfElement",["el","model"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

      let modelEl;
      if (!(modelEl = this.modelElementForElement(el))) {
        return ERROR(
          "Can't update text and attributes of element since no parent model element could be determined by looking at its modelroot",
          el
        );
      }
      if (modelEl.hasClass("__deadModel")) {
        return;
      }

      if (!model && !(model = this.modelForElement(el))) {
        return ERROR(
          "Can't update text and attributes of element since no model was supplied, and the model could not be determined by looking at its classes",
          el
        );
      }

      const elid = modelEl[0].id;

      let textNodeIndex = 1;
      for (let node of el.childNodes) {
        if (node.nodeType === 3) {
          // text node
          var template;
          if ((template = el.getAttribute(`__template_textNode-${textNodeIndex}`))) {
            const s = this.templatedText(template, model.fields, elid, model.id);
            if (typeof s === "string" && s !== node.textContent) {
              node.textContent = s;
            }
          }
          textNodeIndex++;
        }
      }

      const regex = /^__template_attr_((?!__template_).+)$/;
      const addAttr = {};
      for (let attr of el.attributes) {
        if (attr.specified) {
          var match;

          if ((match = regex.exec(attr.name))) {
            addAttr[match[1]] = this.templatedText(attr.value, model.fields, elid, model.id);
          }
        }
      }

      for (let k of Object.keys(addAttr || {})) {
        const v = addAttr[k];
        el.setAttribute(k, v);
      }
    }

    insertChildModels() {
      //if @_doDebugCall then return @debugCall("insertChildModels",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

      let mapping;
      const sels = "";

      const mappings = [];
      for (let id in this.changedModels) {
        const model = this.changedModels[id];
        for (let field in model.fieldChanges) {
          var f;
          if ($.isPlainObject((f = model.fields[field])) && f.array && f.changes) {
            let prevIndex = f.markerIndex;
            let prevIsMarker = true;
            for (let index in f.changes) {
              const change = f.changes[index];
              if (change.type === "insert" || change.type === "edit") {
                var newMappings;

                const prevMappings = lastMappings || [];
                var lastMappings = [];
                for (let prevEl of $(`.${model.classAsChild}__${change.prevIndex}`).filter(":not(.__deadModel)")) {
                  const jqprevEl = $(prevEl);
                  if (
                    (newMappings = this.insertNewModelElement(
                      model,
                      jqprevEl,
                      undefined,
                      jqprevEl.parent(),
                      change.value,
                      undefined,
                      index,
                      field,
                      undefined,
                      true
                    ))
                  ) {
                    for (mapping of newMappings) {
                      lastMappings.push(mapping);
                    }
                    for (mapping of newMappings) {
                      mappings.push(mapping);
                    }
                  }
                }
                if (!prevIsMarker) {
                  for (let prevMapping of prevMappings) {
                    if (prevMapping.add.is(`.${model.classAsChild}__${change.prevIndex}`)) {
                      if (
                        (newMappings = this.insertNewModelElement(
                          model,
                          prevMapping.add,
                          undefined,
                          prevMapping.marker,
                          change.value,
                          undefined,
                          index,
                          field,
                          undefined,
                          true
                        ))
                      ) {
                        for (mapping of newMappings) {
                          lastMappings.push(mapping);
                        }
                        for (mapping of newMappings) {
                          mappings.push(mapping);
                        }
                      }
                    }
                  }
                }

                prevIndex = index;
                prevIsMarker = false;
              }
            }
          }
        }
      }

      // we need to add these after doing the other updates. Otherwise child collections that were made as part of making
      //  new nodes could potentially be updated using the diff for that collection
      for (mapping of mappings) {
        mapping.after.after(mapping.add);
      }
    }

    remakeModelElement(el) {
      //if @_doDebugCall then return @debugCall("remakeModelElement",["el"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

      let collectionIndex, index, jqel, jqwrapper, markerClass, model, overrideModel, parentEl, parentModel;
      if ((jqel = $(`#${el.id}`)).length !== 1 || jqel[0] !== el) {
        return;
      }

      if (!(jqwrapper = $(`#${el.id}_base`)).length) {
        jqwrapper = jqel;
      }
      const wrapper = jqwrapper[0];

      if (!(parentEl = wrapper.parentElement)) {
        return ERROR("Can't remake model element since the element supplied has no parent", el);
      }
      const jqparentEl = $(parentEl);

      if (!(collectionIndex = wrapper.getAttribute("__collectionindex"))) {
        return ERROR(
          "Can't remake model element since the element supplied has no __collectionindex attribute, which should point to the marker element to copy for the new node",
          el
        );
      }

      if (!(markerClass = wrapper.getAttribute("__markerClass"))) {
        return ERROR(
          "Can't remake model element since the element supplied has no __markerClass attribute, which should point to the marker element to copy for the new node",
          el
        );
      }

      if (!el.hasAttribute("collectionmodelid") || !el.hasAttribute("itemmodelid")) {
        return ERROR(
          "Can't remake model element since the element supplied has no model and parent model attributes",
          el
        );
      }

      if (
        !(model = this.models[el.getAttribute("itemmodelid")]) ||
        !(parentModel = this.models[el.getAttribute("collectionmodelid")])
      ) {
        return;
      }

      if (el.hasAttribute("overridemodelid")) {
        if (!(overrideModel = this.models[el.getAttribute("overridemodelid")])) {
          return;
        }
      }

      const clss = wrapper.className.split(/\s+/);
      const prfx = parentModel.classAsChild + "__";
      for (let cls of clss) {
        if (cls.substring(0, prfx.length) === prfx && /^\d+$/.test((index = cls.substring(prfx.length)))) {
          index = +index;
          break;
        }
      }

      //unless index!=undefined
      //  return ERROR("Can't remake model element since the element supplied has no index in its collection",el)

      const mappings = this.insertNewModelElement(
        parentModel,
        undefined,
        collectionIndex,
        jqparentEl,
        model,
        overrideModel,
        index,
        undefined,
        markerClass,
        false
      );
      for (let mapping of mappings) {
        if (!mapping.after) {
          jqwrapper.replaceWith(mapping.add);
        }
      }
    }

    removeDeletedModels() {
      //if @_doDebugCall then return @debugCall("removeDeletedModels",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

      let sels = "";
      for (let id in this.changedModels) {
        const model = this.changedModels[id];
        for (let field in model.fieldChanges) {
          var f, index, sel;
          let change = model.fieldChanges[field];
          if ($.isPlainObject((f = model.fields[field])) && f.array && f.changes) {
            for (index in f.changes) {
              change = f.changes[index];
              if (change.type === "delete" || change.type === "edit") {
                sel = `.${model.classAsChild}__${index}`;
                if (sels.length) {
                  sels += `,${sel}`;
                } else {
                  sels = sel;
                }
              }
            }
          } else if ($.isArray(change)) {
            for (index of change) {
              sel = `.${model.classAsChild}__${index}`;
              if (sels.length) {
                sels += `,${sel}`;
              } else {
                sels = sel;
              }
            }
          }
        }
      }

      if (sels.length) {
        const els = $(sels).filter(":not(.__deadModel)");
        els
          .find("*")
          .addBack()
          .addClass("__deadModel");
        for (let el of els) {
          this.queueModelEvent(el, "removemodel");
        }
      }
    }

    insertNewModelElement(
      parentModel,
      jqprevEl,
      collectionIndex,
      jqparentEl,
      model,
      overrideModel,
      index,
      field,
      markerClass,
      justReturnMapping,
      depth,
      inSubtemplateForModelIds
    ) {
      let cls, domInfo, jqmarker, jqnode, match, subtemplatePath, useModel, useParentModel;
      if (depth > 10) {
        die();
      }
      depth = (depth || 0) + 1;

      if (!collectionIndex) {
        let prevEl;
        if (jqprevEl.length !== 1) {
          return ERROR("Can't insert new model element since no unique prev element was supplied", jqprevEl);
        }
        if (!(collectionIndex = (prevEl = jqprevEl[0]).getAttribute("__collectionindex"))) {
          return ERROR(
            "Can't insert new model element since the prev element supplied has no __collectionindex attribute, which should point to the marker element to copy for the new node",
            jqprevEl
          );
        }
      }

      if (!markerClass) {
        markerClass = parentModel.classAsChild + "__" + this.markerIndex(field);
      }

      const markerCollectionClass = markerClass + "_collection-" + collectionIndex;
      if (jqparentEl.is(`.${markerCollectionClass}`)) {
        jqmarker = jqparentEl;
      } else {
        if ((jqmarker = jqparentEl.children(`.${markerCollectionClass}`)).length !== 1) {
          return ERROR(
            `Can't insert new model element since no unique marker node was found with class ${markerCollectionClass}`,
            jqmarker
          );
        }
      }

      const placeholderClass = markerClass + "_placeholder";

      if (jqmarker[0].hasAttribute("__subtemplatePath")) {
        subtemplatePath = jqmarker[0].getAttribute("__subtemplatePath");
      }

      let fieldSubstitutes = {};
      for (var attr of jqmarker[0].attributes) {
        if (attr.specified) {
          if (!(match = /^(\w+)_field$/.exec(attr.name))) {
            continue;
          }
          fieldSubstitutes[match[1]] = this.quickStartupTemplatedText(attr.value, model, parentModel, {}, elid);
        }
      }

      var elid = `model_${this.nextElid++}`;

      for (let overrideCount = 0; overrideCount < 10; overrideCount++) {
        var newOverrideModel;
        if (overrideCount === 10) {
          WARN("too many override variants/models");
          break;
        }
        domInfo = this.getModelDOM(overrideModel || model, subtemplatePath) || {
          dom: "<div/>",
          domModels: [overrideModel || model]
        };
        if (!(jqnode = $(domInfo.dom)) || jqnode.length !== 1) {
          jqnode = $("<div/>");
        }
        jqnode[0].id = elid;

        if (jqnode[0].hasAttribute("overridevariant")) {
          const overrideVariant = this.quickTemplatedText(
            jqnode[0].getAttribute("overridevariant"),
            model,
            fieldSubstitutes,
            elid
          );
          if (overrideVariant !== "<default>") {
            newOverrideModel = this.model(this.modelIdWithVariant(model.id, overrideVariant));
          }
        } else if (jqnode[0].hasAttribute("overridemodelid")) {
          const overrideModelId = this.quickTemplatedText(
            jqnode[0].getAttribute("overridemodelid"),
            model,
            fieldSubstitutes,
            elid
          );
          if (overrideModelId !== "<default>") {
            newOverrideModel = this.model(overrideModelId);
          }
        } else {
          break;
        }

        if (newOverrideModel === (overrideModel || model)) {
          break;
        }

        overrideModel = newOverrideModel;
      }

      // if it's a subtemplate, this dom should be inserted using the parent template's model and parent model
      if (jqmarker[0].hasAttribute("__usemodelid") && jqmarker[0].hasAttribute("__useparentmodelid")) {
        useModel = this.model(jqmarker[0].getAttribute("__usemodelid"));
        useParentModel = this.model(jqmarker[0].getAttribute("__useparentmodelid"));
      } else {
        useParentModel = parentModel;
        useModel = model;
      }

      fieldSubstitutes = {};
      for (attr of jqmarker[0].attributes) {
        if (attr.specified) {
          if (!(match = /^(\w+)_field$/.exec(attr.name))) {
            continue;
          }
          fieldSubstitutes[match[1]] = this.quickStartupTemplatedText(attr.value, useModel, useParentModel, {}, elid);
        }
      }

      jqnode[0].setAttribute("modelid", useModel.id);
      if (overrideModel) {
        jqnode[0].setAttribute("overridemodelid", overrideModel.id);
      }
      jqnode[0].setAttribute("parentmodelid", useParentModel.id);
      jqnode[0].setAttribute("itemmodelid", model.id);
      jqnode[0].setAttribute("collectionmodelid", parentModel.id);
      jqnode[0].removeAttribute("variant");

      if (overrideModel) {
        useModel = overrideModel;
      }

      if (useModel) {
        jqnode.addClass(useModel.class);
      }
      if (domInfo.domModels) {
        for (let domModel of domInfo.domModels) {
          jqnode.addClass(domModel.class + "__dom");
        }
      }

      const jqwrapped = jqnode;

      if (!jqmarker.hasClass(placeholderClass)) {
        let jqplaceholderEl, style, styleTemplate;
        const jqwrapper = jqmarker.clone();
        jqwrapper[0].removeAttribute("variant");
        if ((style = jqmarker[0].getAttribute("_style"))) {
          jqwrapper[0].removeAttribute("_style");
          jqwrapper[0].setAttribute("style", style);
        }
        if ((styleTemplate = jqmarker[0].getAttribute("__template_attr__style"))) {
          jqwrapper[0].removeAttribute("__template_attr__style");
          jqwrapper[0].setAttribute("__template_attr_style", styleTemplate);
        }

        jqwrapper.removeClass(markerClass);
        jqwrapper.removeClass(markerCollectionClass);
        jqwrapper.css("display", "");
        jqwrapper[0].id = elid + "_base";

        if ((jqplaceholderEl = jqwrapper.find(`.${placeholderClass}`)).length) {
          for (cls of jqplaceholderEl[0].className.split(/\s+/)) {
            if (cls && cls !== placeholderClass) {
              jqnode.addClass(cls);
            }
          }
          for (attr of jqplaceholderEl[0].attributes) {
            if (attr.specified && attr.name !== "class") {
              jqnode[0].setAttribute(attr.name, attr.value);
            }
          }
          jqplaceholderEl.replaceWith(jqnode);
        }

        jqnode = jqwrapper;
      }

      jqnode[0].setAttribute("__collectionindex", collectionIndex);
      jqnode[0].setAttribute("__markerClass", markerClass);

      const usingParentModel = useModel.type === "Template";
      if (useModel) {
        this.setupModelNodeSubtree(
          useModel,
          useParentModel,
          usingParentModel,
          jqnode,
          false,
          undefined,
          elid,
          [1],
          fieldSubstitutes,
          domInfo.templateModel,
          subtemplatePath,
          {}
        );
      }

      const clss = jqmarker[0].className.split(/\s+/);
      for (cls of clss) {
        if (/^__childOf(?:(?!__marker-).)*$/.test(cls)) {
          jqnode.addClass(cls);
        }
      }

      const ret = [{ add: jqnode, after: jqprevEl, marker: jqmarker }];
      this.queueModelEvent(jqnode[0], "insertmodel");
      if (jqwrapped[0] !== jqnode[0]) {
        this.queueModelEvent(jqwrapped[0], "insertmodel");
      }

      if (useModel) {
        this.insertNewModelElementChildren(useModel, jqnode, justReturnMapping, depth, inSubtemplateForModelIds, ret);
      }
      if (useParentModel && useModel !== useParentModel) {
        this.insertNewModelElementChildren(
          useParentModel,
          jqnode,
          justReturnMapping,
          depth,
          inSubtemplateForModelIds,
          ret
        );
      }
      if (domInfo.templateModel) {
        this.insertNewModelElementChildren(
          domInfo.templateModel,
          jqnode,
          justReturnMapping,
          depth,
          inSubtemplateForModelIds,
          ret
        );
      }

      if (index === undefined) {
        index = "single";
      }
      for (var mapping of ret) {
        if (parentModel) {
          mapping.add.addClass(parentModel.classAsChild + "__" + index);
        }
      }

      if (!justReturnMapping) {
        for (mapping of ret) {
          if (mapping.after) {
            mapping.after.after(mapping.add);
          }
        }
      }

      return ret;
    }

    insertNewModelElementChildren(model, jqnode, justReturnMapping, depth, inSubtemplateForModelIds, ret) {
      let childMarkerEl, jqpar, jqprevChildEl, mappings, subtemplates;
      if (!ret) {
        ret = [];
      }
      if (!model) {
        return;
      }
      let childMarkerSel = `.${model.classAsChild}__${this.markerIndex()}`;
      for (var childField in model.fields) {
        const f = model.fields[childField];
        if (childField !== "subtemplates" && f.array) {
          var m;

          childMarkerSel = `.${model.classAsChild}__${f.markerIndex}`;
          if (jqnode.is(childMarkerSel)) {
            jqprevChildEl = jqnode;
            for (m of f.array) {
              if (
                (mappings = this.insertNewModelElement(
                  model,
                  jqprevChildEl,
                  undefined,
                  jqnode,
                  m.model,
                  undefined,
                  m.index,
                  childField,
                  undefined,
                  justReturnMapping,
                  depth,
                  inSubtemplateForModelIds
                ))
              ) {
                jqprevChildEl = mappings[0].add;
                for (let mapping of mappings) {
                  ret.push(mapping);
                }
              }
            }
          } else {
            for (childMarkerEl of jqnode.find(childMarkerSel)) {
              jqprevChildEl = $(childMarkerEl);
              jqpar = jqprevChildEl.parent();
              for (m of f.array) {
                if (
                  (mappings = this.insertNewModelElement(
                    model,
                    jqprevChildEl,
                    undefined,
                    jqpar,
                    m.model,
                    undefined,
                    m.index,
                    childField,
                    undefined,
                    false,
                    depth,
                    inSubtemplateForModelIds
                  ))
                ) {
                  jqprevChildEl = mappings[0].add;
                }
              }
            }
          }
        }
      }
      if ((subtemplates = model.fields.subtemplates)) {
        for (let subtemplatePath in subtemplates) {
          const template = subtemplates[subtemplatePath];
          if (!(inSubtemplateForModelIds && inSubtemplateForModelIds[model.id])) {
            const markerClass =
              model.classAsChild +
              "__" +
              this.markerIndex("subtemplates") +
              "__" +
              this.sanitizeClassName(subtemplatePath, true);
            childMarkerSel = `.${markerClass}`;
            if (!jqnode.is(childMarkerSel)) {
              for (childMarkerEl of jqnode.find(childMarkerSel)) {
                jqprevChildEl = $(childMarkerEl);
                jqpar = jqprevChildEl.parent();
                if (!inSubtemplateForModelIds) {
                  inSubtemplateForModelIds = {};
                }
                inSubtemplateForModelIds[model.id] = true;
                if (
                  (mappings = this.insertNewModelElement(
                    model,
                    jqprevChildEl,
                    childMarkerEl.getAttribute("__collectionindex"),
                    jqpar,
                    model,
                    undefined,
                    undefined,
                    childField,
                    markerClass,
                    false,
                    depth,
                    inSubtemplateForModelIds
                  ))
                ) {
                  jqprevChildEl = mappings[0].add;
                }
                delete inSubtemplateForModelIds[model.id];
              }
            }
          }
        }
      }
      return ret;
    }

    setupModelNodeSubtree(
      model,
      parentModel,
      usingParentModel,
      jqnode,
      isDesc,
      field,
      elid,
      acollectionIndex,
      fieldSubstitutes,
      template,
      subtemplatePath,
      modelChildIndexesByField
    ) {
      //if @_doDebugCall then return @debugCall("setupModelNodeSubtree",["model","parentModel","usingParentModel","jqnode","isDesc","field","elid","acollectionIndex","fieldSubstitutes","template","subtemplatePath","modelChildIndexesByField"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

      let cls, isMarker, isPlaceholder, startupFields;
      if (jqnode.length !== 1 || (isDesc && jqnode.hasClass("modelStop"))) {
        return;
      }
      const node = jqnode[0];

      if (jqnode.hasClass("using-this-model")) {
        usingParentModel = false;
      } else if (jqnode.hasClass("using-parent-model")) {
        usingParentModel = true;
      }

      if (usingParentModel) {
        jqnode.attr("using-parent-model", "1");
      }

      const usingModel = usingParentModel ? parentModel : model;

      const hasValueFields = {};
      const addAttr = {};
      const addClasses = {};

      addAttr["modelroot"] = elid;
      const clss = node.className.split(/\s+/);

      // setup model containers, any node marked with a class like users-model-child will be seen as a marker for an array of children under that field,
      // unless it is prefixed with 'subtemplate-uses-' which simply ensures that field exists in the incoming model (and is available for subtemplates to use)

      if (field === undefined) {
        let collectionIndex, markerClass, match, style;
        for (cls of clss) {
          if ((match = /^(?!subtemplate-uses-)([\w_]*)-model-child$/.exec(cls))) {
            break;
          }
        }
        if (match) {
          let index;
          field = match[1];
          if ((index = modelChildIndexesByField[field])) {
            index += 1;
            modelChildIndexesByField[field] = index;
            field += `-${index}`;
          } else {
            modelChildIndexesByField[field] = 1;
          }
        } else {
          for (cls of clss) {
            if ((match = /^model-child$/.exec(cls))) {
              break;
            }
          }
          if (match) {
            field = null;

            if (node.hasAttribute("fieldasmodelchild")) {
              field = node.getAttribute("fieldasmodelchild");

              if ((startupFields = this.startupTemplateFields(field))) {
                field = this.templatedText(
                  field,
                  fieldSubstitutes || {},
                  elid,
                  usingModel.id,
                  parentModel,
                  startupFields
                );
                addAttr["fieldasmodelchild"] = field;
              }
            }
          }
        }

        if (field !== undefined) {
          markerClass = model.classAsChild + "__" + this.markerIndex(field);
          collectionIndex = acollectionIndex[0]++;
          if (!jqnode.find(".model-placeholder").length) {
            addClasses["model-placeholder"] = true;
            addClasses[markerClass + "_placeholder"] = true;
            isPlaceholder = true;
          }
          addClasses[markerClass] = true;
          addClasses[markerClass + "_collection-" + collectionIndex] = true;
          addAttr["__markerClass"] = markerClass;
          addAttr["__collectionindex"] = collectionIndex;
          if ((style = jqnode[0].getAttribute("style"))) {
            jqnode[0].setAttribute("_style", style);
          }
          jqnode[0].setAttribute("style", "display:none;");
          jqnode.removeClass(cls);
          isMarker = true;

          // setup model subtemplates, any node marked with a class like users-subtemplate will be seen as a marker for an array of children under that field, the difference being that they are the children of the template
        } else if (template) {
          for (cls of clss) {
            if ((match = /^(\w*)-subtemplate$/.exec(cls))) {
              break;
            }
          }
          if (match) {
            field = match[1];
            if (node.hasAttribute("model")) {
              if (template) {
                markerClass = template.classAsChild + "__" + this.markerIndex(field);
                collectionIndex = acollectionIndex[0]++;
                if (!jqnode.find(".subtemplate-placeholder").length) {
                  addClasses["subtemplate-placeholder"] = true;
                  addClasses[markerClass + "_placeholder"] = true;
                  isPlaceholder = true;
                }
                addClasses[markerClass] = true;
                addClasses[markerClass + "_collection-" + collectionIndex] = true;
                addAttr["__markerClass"] = markerClass;
                addAttr["__collectionindex"] = collectionIndex;
                //addAttr["__usemodelid"] = node.hasAttribute
                //addAttr["__useparentmodelid"] = parentModel.id
                if ((style = jqnode[0].getAttribute("style"))) {
                  jqnode[0].setAttribute("_style", style);
                }
                jqnode[0].setAttribute("style", "display:none;");
                jqnode.removeClass(cls);
                isMarker = true;
              }
            } else {
              const newPath = (subtemplatePath ? subtemplatePath + " " : "") + field;
              markerClass = model.classAsChild + "__" + this.markerIndex("subtemplates");
              markerClass =
                model.classAsChild +
                "__" +
                this.markerIndex("subtemplates") +
                "__" +
                this.sanitizeClassName(newPath, true);
              collectionIndex = acollectionIndex[0]++;
              if (!jqnode.find(".model-placeholder").length) {
                addClasses["model-placeholder"] = true;
                addClasses[markerClass + "_placeholder"] = true;
                isPlaceholder = true;
              }
              addClasses[markerClass] = true;
              addClasses[markerClass + "_collection-" + collectionIndex] = true;
              addAttr["__subtemplatePath"] = newPath;
              addAttr["__markerClass"] = markerClass;
              addAttr["__collectionindex"] = collectionIndex;
              if ((style = jqnode[0].getAttribute("style"))) {
                jqnode[0].setAttribute("_style", style);
              }
              jqnode[0].setAttribute("style", "display:none;");
              jqnode.removeClass(cls);
              isMarker = true;
            }
          }
        }
      } else if (jqnode.hasClass("model-placeholder")) {
        addClasses[model.classAsChild + "__" + this.markerIndex(field) + "_placeholder"] = true;
        isPlaceholder = true;
      } else if (jqnode.hasClass("subtemplate-placeholder") && template) {
        addClasses[template.classAsChild + "__" + this.markerIndex(field) + "_placeholder"] = true;
        isPlaceholder = true;
      }

      if (isPlaceholder) {
        jqnode.empty();
      } else {
        let f, f2, fields, hasSubs, value;
        if (!isMarker) {
          // setup templates for attributes and textnodes that need replacing based on the model value

          for (let attr of node.attributes) {
            if (attr.specified) {
              ({ value } = attr);
              if (/^__template_/.test(attr.name)) {
                continue;
              }

              if ((startupFields = this.startupTemplateFields(value))) {
                value = this.templatedText(
                  value,
                  fieldSubstitutes || {},
                  elid,
                  usingModel.id,
                  parentModel,
                  startupFields
                );
                addAttr[attr.name] = value;
              }

              if (!(fields = this.templateFields(value))) {
                continue;
              }
              if (fieldSubstitutes) {
                hasSubs = false;
                for (f of fields) {
                  if ((hasSubs = fieldSubstitutes[f.field] !== undefined)) {
                    break;
                  }
                }
                if (hasSubs) {
                  value = this.templatedText(value, fieldSubstitutes, elid, usingModel.id, parentModel, fields, true);
                  if (!(fields = this.templateFields(value))) {
                    addAttr[attr.name] = value;
                    continue;
                  }
                }
              }

              addAttr[`__template_attr_${attr.name}`] = value;
              addAttr[attr.name] = this.templatedText(
                value,
                usingModel.fields,
                elid,
                usingModel.id,
                parentModel,
                fields
              );
              for (f of fields) {
                hasValueFields[f.field] = true;
                if (f.defFields) {
                  for (f2 of f.defFields) {
                    hasValueFields[f2.field] = true;
                  }
                }
              }
            }
          }
        }

        let textNodeIndex = 1;
        for (let child of node.childNodes) {
          if (child.nodeType === 3) {
            // text node
            const thisindex = textNodeIndex++;
            value = child.textContent;

            if ((startupFields = this.startupTemplateFields(value))) {
              value = this.templatedText(
                value,
                fieldSubstitutes || {},
                elid,
                usingModel.id,
                parentModel,
                startupFields
              );
              child.textContent = value;
            }

            if (!(fields = this.templateFields(value))) {
              continue;
            }
            if (fieldSubstitutes) {
              hasSubs = false;
              for (f of fields) {
                if ((hasSubs = fieldSubstitutes[f.field] !== undefined)) {
                  break;
                }
              }
              if (hasSubs) {
                value = this.templatedText(value, fieldSubstitutes, elid, usingModel.id, parentModel, fields, true);
                if (!(fields = this.templateFields(value))) {
                  child.textContent = value;
                  continue;
                }
              }

              addAttr[`__template_textNode-${thisindex}`] = value;
              child.textContent = this.templatedText(
                value,
                usingModel.fields,
                usingModel.id,
                parentModel,
                elid,
                fields
              );
              for (f of fields) {
                hasValueFields[f.field] = true;
                if (f.defFields) {
                  for (f2 of f.defFields) {
                    hasValueFields[f2.field] = true;
                  }
                }
              }
            }
          } else if (child.nodeType === 1) {
            // element
            this.setupModelNodeSubtree(
              model,
              parentModel,
              usingParentModel,
              $(child),
              true,
              field,
              elid,
              acollectionIndex,
              fieldSubstitutes,
              template,
              subtemplatePath,
              modelChildIndexesByField
            );
          }
        }
      }

      // mark which values this node is concerned with
      for (field in hasValueFields) {
        addClasses[usingModel.class + "__v-" + this.sanitizeClassName(field, true)] = true;
      }

      if (node.hasAttribute("onchangemodel")) {
        addClasses[usingModel.class + "__onchangemodel"] = true;
      }

      // actually set the attributes and classes
      for (let k in addAttr) {
        const v = addAttr[k];
        node.setAttribute(k, v);
      }
      for (cls in addClasses) {
        jqnode.addClass(cls);
      }
    }

    overrideVariant(el, variant) {
      let jqel, model, overrideModelId;
      el = this.getTargetIfEvent(el);

      if (
        !(jqel = this.modelElementForElement(el)) ||
        !(model = this.modelForElement(jqel[0])) ||
        !(overrideModelId = this.modelIdWithVariant(model.id, variant))
      ) {
        return false;
      }
      this.overrideModelId(el, overrideModelId);
      return false;
    }

    overrideModelId(el, overrideModelId) {
      let jqel, model, overrideModel, overrideModelIdWas, overrideModelWas;
      el = this.getTargetIfEvent(el);

      if (!(jqel = this.modelElementForElement(el)) || !(model = this.modelForElement(jqel[0]))) {
        return false;
      }
      el = jqel[0];

      if (el.hasAttribute("overridemodelid")) {
        overrideModelIdWas = el.getAttribute("overridemodelid");
      }
      if (overrideModelId === overrideModelIdWas) {
        return false;
      }

      el.setAttribute("overridemodelid", overrideModelId);

      if (overrideModelIdWas && (overrideModelWas = model.overrideVariants[overrideModelIdWas])) {
        delete model.overrideVariants[overrideModelIdWas];
        this.unlinkModels(model, overrideModelWas);
      }

      if (overrideModelId && (overrideModel = this.model(overrideModelId))) {
        model.overrideVariants[overrideModelId] = overrideModel;
        this.linkModels(model, overrideModel);
      }

      jqel.addClass("__remake_model__");
      jqel.addClass(`__remake_model__${this.updateIndex}`);
      if (!Object.getOwnPropertyNames(this.needModels).length) {
        this.updateModels();
      }
      return false;
    }
  };
  ModelDOM_dom.initClass();
  return ModelDOM_dom;
})();
