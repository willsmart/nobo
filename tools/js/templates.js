const ConvertIds = require("./convert-ids");
const PublicApi = require("./public-api");

// API is auto-generated at the bottom from the public interface of this class

class Templates {
  // public methods
  static publicMethods() {
    return [
      "load",
      "findForView",
      "completeOutputKeysForView",
      "outputKeysForView",
      "findTemplateBy",
      "findDisplayedFieldBy",
      "findSubtemplateBy",
      "findTemplateChildBy"
    ];
  }

  async load({ cache }) {
    this.cache = cache;
    cache.setTemplates(this.publicApi);
    const schema = cache.schema;

    this.templatesByVariantClassOwnership = {};
    this.templatesById = {};
    this.subtemplatesById = {};
    this.templateChildrenById = {};
    this.templateDisplayedFieldsById = {};

    if (!(this.Template = schema.allTypes["Template"])) throw new Error("No Template type found");
    if (!(this.Subtemplate = schema.allTypes["Subtemplate"])) throw new Error("No Subtemplate type found");
    if (!(this.TemplateChild = schema.allTypes["TemplateChild"])) throw new Error("No TemplateChild type found");
    if (!(this.TemplateDisplayedField = schema.allTypes["TemplateDisplayedField"]))
      throw new Error("No TemplateDisplayedField type found");

    const rows = await cache.connection.getRowsFromDB({
      tableName: "template",
      fields: ["id"]
    });
    return Promise.all(rows.map(row => this.loadTemplatewithId(row.id)));
  }

  async loadTemplatewithId(templateId) {
    const thisTemplates = this;

    if (thisTemplates.templatesById[templateId]) return Promise(() => thisTemplates.templatesById[templateId]);

    let template = await thisTemplates.cache.getLatestViewVersion(
      ConvertIds.recomposeId({ typeName: "Template", dbRowId: templateId, variant: "complete" }),
      {
        outputKeyProvider(idInfo) {
          return Object.assign(
            {
              meForClients: { value: ConvertIds.recomposeId(Object.assign(idInfo, { variant: "default" })).viewId }
            },
            thisTemplates.completeOutputKeysForView(idInfo)
          );
        }
      }
    );

    const variant = template.variant || "default";
    const classFilter = template.classFilter || "any";
    const ownership = template.ownerOnly || false ? "private" : "public";
    const templatesByClassOwnership =
      thisTemplates.templatesByVariantClassOwnership[variant] ||
      (thisTemplates.templatesByVariantClassOwnership[variant] = {});
    const templatesByOwnership =
      templatesByClassOwnership[classFilter] || (templatesByClassOwnership[classFilter] = {});
    template = templatesByOwnership[ownership] || (templatesByOwnership[ownership] = template);

    thisTemplates.templatesById[templateId] = template;

    let promises = [];

    //console.log("\n\n\nTemplate "+templateId+"\n")
    const subtemplateViewIds = template.subtemplates;
    template.subtemplates = [];
    template.subtemplatesByVariant = {};

    //console.log(subtemplateViewIds)
    if (subtemplateViewIds) {
      subtemplateViewIds.forEach(id => {
        promises.push(
          thisTemplates.loadSubtemplateWithViewId(id).then(subtemplate => {
            template.subtemplates.push(subtemplate);
            template.subtemplatesByVariant[subtemplate.variant || "default"] = subtemplate;
          })
        );
      });
    }

    const templateChildViewIds = template.templateChildren;
    template.templateChildren = [];
    template.templateChildrenByVariantClassOwnership = {};

    //console.log(templateChildViewIds)
    if (templateChildViewIds) {
      templateChildViewIds.forEach(id => {
        promises.push(
          thisTemplates.loadTemplateChildWithViewId(id).then(child => {
            template.templateChildren.push(child);
            const variant = child.variant || "default";
            const classFilter = child.classFilter || "any";
            const ownership = child.ownerOnly || false ? "private" : "public";
            const childrenByClassOwnership =
              template.templateChildrenByVariantClassOwnership[variant] ||
              (template.templateChildrenByVariantClassOwnership[variant] = {});
            const childrenByOwnership =
              childrenByClassOwnership[classFilter] || (childrenByClassOwnership[classFilter] = {});
            if (!childrenByOwnership[ownership]) childrenByOwnership[ownership] = child;
          })
        );
      });
    }

    const displayedFieldViewIds = template.displayedFields;
    template.displayedFields = [];
    template.displayedFieldsByField = {};

    //console.log(displayedFieldViewIds)
    if (displayedFieldViewIds) {
      displayedFieldViewIds.forEach(id => {
        promises.push(
          thisTemplates.loadTemplateDisplayedFieldWithViewId(id).then(field => {
            if (!field.field) return;
            template.displayedFields.push(field);
            template.displayedFields[field.field] = field;
          })
        );
      });
    }

    return Promise.all(promises).then(() => template);
  }

  async loadSubtemplateWithViewId(subtemplateViewId) {
    const thisTemplates = this;

    if (thisTemplates.subtemplatesById[subtemplateViewId]) return thisTemplates.subtemplatesById[subtemplateViewId];

    const subtemplate = await thisTemplates.cache.getLatestViewVersion({ viewId: subtemplateViewId });
    thisTemplates.subtemplatesById[subtemplateViewId] = subtemplate;
    return subtemplate;
  }

  async loadTemplateChildWithViewId(childViewId) {
    const thisTemplates = this;

    if (thisTemplates.templateChildrenById[childViewId]) return thisTemplates.templateChildrenById[childViewId];

    const child = await thisTemplates.cache.getLatestViewVersion({ viewId: childViewId });
    thisTemplates.templateChildrenById[childViewId] = child;
    return child;
  }

  async loadTemplateDisplayedFieldWithViewId(fieldViewId) {
    const thisTemplates = this;

    if (thisTemplates.templateDisplayedFieldsById[fieldViewId])
      return thisTemplates.templateDisplayedFieldsById[fieldViewId];

    const field = await thisTemplates.cache.getLatestViewVersion({ viewId: fieldViewId });
    thisTemplates.templateDisplayedFieldsById[fieldViewId] = field;
    return field;
  }

  findForView(viewIdInfo) {
    const givenVariantClass = function(viewIdInfo, templatesByOwnership) {
      if (!templatesByOwnership) return;
      return templatesByOwnership["private"] || templatesByOwnership["public"];
    };

    const givenVariant = function(viewIdInfo, templatesByClassOwnership) {
      if (!templatesByClassOwnership) return;
      return (
        givenVariantClass(viewIdInfo, templatesByClassOwnership[viewIdInfo.typeName]) ||
        givenVariantClass(viewIdInfo, templatesByClassOwnership["any"])
      );
    };

    if (viewIdInfo.variant && viewIdInfo.variant != "default") {
      return (
        givenVariant(viewIdInfo, this.templatesByVariantClassOwnership[viewIdInfo.variant]) ||
        givenVariant(viewIdInfo, this.templatesByVariantClassOwnership["default"])
      );
    } else {
      return givenVariant(viewIdInfo, this.templatesByVariantClassOwnership["default"]);
    }
  }

  outputKeysForView(viewIdInfo) {
    const thisTemplates = this;

    if (viewIdInfo.variant == "complete") {
      return thisTemplates.completeOutputKeysForView(viewIdInfo);
    }

    const type = this.cache.schema.allTypes[viewIdInfo.typeName];
    if (!type) throw new Error(`No type "${viewIdInfo.typeName}"`);

    const template = this.findForView(viewIdInfo);
    if (!template) throw new Error(`No suitable template found for "${viewIdInfo.viewId}"`);

    const ret = {};

    template.displayedFields.forEach(displayedField => {
      const field = type.fields[displayedField.field];
      if (!field || field.isId) return;
      ret[displayedField.field] = {
        datapointId: field.getDatapointId({ dbRowId: viewIdInfo.dbRowId })
      };
    });
    template.templateChildren.forEach(child => {
      const field = type.fields[child.modelField];
      if (!field) return;
      const info = {
        datapointId: field.getDatapointId({ dbRowId: viewIdInfo.dbRowId })
      };
      if (field.isId) {
        info.variant = child.variant || "default";
      }

      ret[child.domField || child.modelField] = info;
    });

    if (viewIdInfo.typeName != "Template") {
      ret.template = {
        value: [template.meForClients]
      };
      ret.subtemplates = { value: {} };
      thisTemplates._addViewSubtemplates(viewIdInfo, template, "", ret.subtemplates.value);
    } else {
      thisTemplates._addTemplateViewSubtemplates(viewIdInfo, ret);
    }

    return ret;
  }

  _addViewSubtemplates(viewIdInfo, template, prefix, addTo) {
    const thisTemplates = this;

    template.subtemplates.forEach(subtemplate => {
      if (subtemplate.modelView) return;
      const subviewIdInfo = ConvertIds.recomposeId({
        typeName: viewIdInfo.typeName,
        dbRowId: viewIdInfo.dbRowId,
        variant: subtemplate.variant
      });

      const subtemplateTemplate = thisTemplates.findForView(subviewIdInfo);
      if (!subtemplateTemplate) {
        console.log(
          `Could not find appropriate template for the ${subtemplate.domField} subtemplate of view ${viewIdInfo.viewId}`
        );
        return;
      }

      const key = prefix + subtemplate.domField;
      addTo[key] = subtemplateTemplate.meForClients;

      thisTemplates._addViewSubtemplates(subviewIdInfo, subtemplateTemplate, key + " ", addTo);
    });
  }

  _addTemplateViewSubtemplates(viewIdInfo, addToOutputKeys) {
    const thisTemplates = this;

    const template = thisTemplates.templatesById[viewIdInfo.dbRowId];
    if (!template) {
      throw new Error(`Could not find template with row ${viewIdInfo.dbRowId}`);
    }

    template.subtemplates.forEach(subtemplate => {
      if (!subtemplate.modelView) return;

      let subviewIdInfo = ConvertIds.decomposeId({ proxyableViewId: subtemplate.modelView, relaxed: true });
      if (!subviewIdInfo) {
        console.log(
          `Could not parse the modelView '${subtemplate.modelView}' for the ${
            subtemplate.domField
          } subtemplate of view ${viewIdInfo.viewId}`
        );
        return;
      }

      subviewIdInfo.variant = subtemplate.variant || "default";
      subviewIdInfo = ConvertIds.recomposeId(subviewIdInfo);

      addToOutputKeys[subtemplate.domField] = { value: [subviewIdInfo.proxyableViewId] };
    });
  }

  completeOutputKeysForView({ typeName, dbRowId }) {
    const thisTemplates = this;

    const type = thisTemplates.cache.schema.allTypes[typeName];
    const outputKeys = {};
    Object.keys(type.fields).forEach(fieldName => {
      const field = type.fields[fieldName];
      outputKeys[fieldName] = {
        datapointId: field.getDatapointId({ dbRowId: dbRowId })
      };
      if (field.isId) {
        outputKeys[fieldName].variant = "complete";
      }
    });

    return outputKeys;
  }

  findTemplateBy({ variant, classFilter, ownerOnly }) {
    const thisTemplates = this;

    const id = Object.keys(thisTemplates.templatesById).find(id => {
      const template = thisTemplates.templatesById[id];
      return template.variant == variant && template.classFilter == classFilter && template.ownerOnly == ownerOnly;
    });

    return id === undefined ? undefined : thisTemplates.templatesById[id];
  }

  findDisplayedFieldBy({ templateId, field }) {
    return this.templatesById[templateId].displayedFieldsByField[field];
  }

  findSubtemplateBy({ templateId, domField }) {
    const thisTemplates = this,
      template = this.templatesById[templateId];

    const id = Object.keys(template.subtemplates).find(id => {
      const subtemplate = template.subtemplates[id];
      return subtemplate.domField == domField;
    });

    return id === undefined ? undefined : template.subtemplates[id];
  }

  findTemplateChildBy({ templateId, domField }) {
    const thisTemplates = this,
      template = this.templatesById[templateId];

    const id = Object.keys(template.templateChildren).find(id => {
      const child = template.templateChildren[id];
      return child.domField == domField;
    });

    return id === undefined ? undefined : template.templateChildren[id];
  }
}

// API is the public facing class
module.exports = PublicApi({ fromClass: Templates, hasExposedBackDoor: true });
