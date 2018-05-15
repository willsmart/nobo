const ConvertIds = require("./convert-ids");
const PublicApi = require("./general/public-api");

// API is auto-generated at the bottom from the public interface of this class

class TemplateLocator {
  // public methods
  static publicMethods() {
    return ["completeOutputKeysForView", "outputKeysForView", "load"];
  }

  constructor({
    cache
  }) {
    const thisTemplates = this

    this.cache = cache;
    this.templateHolderId = 1

    this.templatesByVariantClassOwnership = {}

    this.listenForTemplateListChanges()

    this.subtemplateCallbackKey = this.cache.uniqueCallbackKey('TemplateLocator.subtemplates')
    this.childrenCallbackKey = this.cache.uniqueCallbackKey('TemplateLocator.children')
    this.displayedFieldsCallbackKey = this.cache.uniqueCallbackKey('TemplateLocator.displayedFields')

    this.cache.associateDatapointCallback({
      callbackKey: this.subtemplateCallbackKey, 
      callback:(valuesById=> {
        thisTemplates.subtemplatesChanged(valuesById)
      })
    })

    this.cache.associateDatapointCallback({
      callbackKey: this.childrenCallbackKey, 
      callback:(valuesById=> {
        thisTemplates.childrenChanged(valuesById)
      })
    })

    this.cache.associateDatapointCallback({
      callbackKey: this.displayedFieldsCallbackKey, 
      callback:(valuesById=> {
        thisTemplates.displayedFieldsChanged(valuesById)
      })
    })
  }

  get templateListDatapointId() {
    return ConvertIds.recomposeId({
      typeName: 'TemplateHolder',
      dbRowId: 1,
      fieldName: 'templates'
    }).datapointId
  }

  templateSubtemplatesDatapointId({dbRowId}) {
    return ConvertIds.recomposeId({
      typeName: 'Template',
      dbRowId,
      fieldName: 'subtemplates'
    }).datapointId
  }

  templateChildrenDatapointId({dbRowId}) {
    return ConvertIds.recomposeId({
      typeName: 'Template',
      dbRowId,
      fieldName: 'children'
    }).datapointId
  }

  templateDisplayedFieldsDatapointId({dbRowId}) {
    return ConvertIds.recomposeId({
      typeName: 'Template',
      dbRowId,
      fieldName: 'displayedFields'
    }).datapointId
  }

  listenForTemplateListChanges() {
    const datapointId = this.templateListDatapointId
    const callbackKey = this.cache.uniqueCallbackKey('TemplateLocator.templates')

    this.cache.associateDatapointCallback({
      callbackKey, 
      callback:(valuesById=> {
        const value = valuesById[this.datapointId]
        if (Array.isArray(value)) {
          thisTemplates.templateListChanged(value)
        }
      })
    })

    this.cache.watchDatapoint({callbackKey, datapointId})
  }

  templateListChanged(templateRowIds) {
    const thisTemplates = this

    const newRowIds = {}
    for (const rowId of templateRowIds) {
      newRowIds[rowId] = true
      if (!thisTemplates.templateRowIds[rowId]) {
        this.processNewTemplate({rowId})
      }
    }

    for (const rowId of Object.keys(this.templateRowIds)) {
      if (!newRowIds[rowId]) {
        processDeletedTemplate({rowId})
      }
    }
  }

  processNewTemplate({rowId}) {
    const thisTemplates = this

    if (thisTemplates.templateRowIds[rowId]) return;
    thisTemplates.templateRowIds[rowId] = true

    this.cache.watchDatapoint({
      callbackKey: thisTemplates.subtemplateCallbackKey, 
      datapointId: thisTemplates.templateSubtemplatesDatapointId
    })
    this.cache.watchDatapoint({
      callbackKey: thisTemplates.childrenCallbackKey, 
      datapointId: thisTemplates.templateChildrenDatapointId
    })
    this.cache.watchDatapoint({
      callbackKey: thisTemplates.displayedFieldsCallbackKey, 
      datapointId: thisTemplates.templateDisplayedFieldsDatapointId
    })
  }

  processDeletedTemplate({rowId}) {
    const thisTemplates = this

    if (!thisTemplates.templateRowIds[rowId]) return;
    delete thisTemplates.templateRowIds[rowId]

    this.cache.stopWatchingDatapoint({
      callbackKey: thisTemplates.subtemplateCallbackKey, 
      datapointId: thisTemplates.templateSubtemplatesDatapointId
    })
    this.cache.stopWatchingDatapoint({
      callbackKey: thisTemplates.childrenCallbackKey, 
      datapointId: thisTemplates.templateChildrenDatapointId
    })
    this.cache.stopWatchingDatapoint({
      callbackKey: thisTemplates.displayedFieldsCallbackKey, 
      datapointId: thisTemplates.templateDisplayedFieldsDatapointId
    })
  }


  subtemplatesChanged(valuesById) {
    for ([datapointId, value] of Object.entries(valuesById)) {
      const id = ConvertIds.decomposeId({datapointId})
      
    }
  }


  template_holder_id() {
    return ConvertIds.recomposeId({
      typeName: 'TemplateHolder',
      dbRowId: 1,
      variant: 'complete'
    })
  }

  template_id({
    dbRowId
  }) {
    return ConvertIds.recomposeId({
      typeName: 'Template',
      dbRowId,
      variant: 'complete'
    })
  }

  async load() {
    const thisTemplates = this
    const schema = this.cache.schema;

    this.templatesByVariantClassOwnership = {};

    if (!(this.Template = schema.allTypes["Template"])) throw new Error("No Template type found");
    if (!(this.Subtemplate = schema.allTypes["Subtemplate"])) throw new Error("No Subtemplate type found");
    if (!(this.TemplateChild = schema.allTypes["TemplateChild"])) throw new Error("No TemplateChild type found");
    if (!(this.TemplateDisplayedField = schema.allTypes["TemplateDisplayedField"]))
      throw new Error("No TemplateDisplayedField type found");

    this.cache.addNewViewVersionCallback({
      key: "template-locator",
      callback: async function (viewIds) {
        await thisTemplates.newVersionAvailableForViews(viewIds);
      }
    });

    const rows = await cache.connection.getRowsFromDB({
      tableName: "template",
      fields: ["id"]
    });
    return Promise.all(rows.map(row => this.loadTemplatewithId(row.id)));
  }

  async newVersionAvailableForViews(viewIds) {
    const thisTemplates = this

    const templateHolders = viewIds.filter(id => id.typeName == 'TemplateHolder' && id.dbRowId == thisTemplates.templateHolderId)
    const templates = viewIds.filter(id => id.typeName == 'Template')
    if (!templateHolders.length && !templates.length) return

    if (templateHolders.length) {
      const allTemplateRowIds = await thisTemplates.getAllTemplateRowIds()

    }
  }

  async getAllTemplateRowIds() {
    const thisTemplates = this

    const datapointId = thisTemplates.cache.schema.allTypes['TemplateHolder'].fields['templates'].getDatapointId(thisTemplates.templateHolderId)
    const templateRowIds = await this.cache.getDatapointValue({
      datapointId
    })
    return templateRowIds.sort()
  }
  async loadTemplatewithId(templateId) {
    const thisTemplates = this;

    let template = await thisTemplates.cache.getLatestViewVersion(
      ConvertIds.recomposeId({
        typeName: "Template",
        dbRowId: templateId,
        variant: "complete"
      }), {
        outputKeyProvider(idInfo) {
          return Object.assign({
              meForClients: {
                value: ConvertIds.recomposeId(Object.assign(idInfo, {
                  variant: "default"
                })).viewId
              }
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

    let promises = [];

    //console.log("\n\n\nTemplate "+templateId+"\n")
    const subtemplateViewIds = template.subtemplates;
    template.subtemplates = [];
    template.subtemplatesByVariant = {};

    //console.log(subtemplateViewIds)
    if (subtemplateViewIds) {
      subtemplateViewIds.forEach(id => {
        promises.push(
          thisTemplates.cache.getLatestViewVersion({
            viewId: id
          }).then(subtemplate => {
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
          thisTemplates.cache.getLatestViewVersion({
            viewId: id
          }).then(child => {
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

  findForView(viewIdInfo) {
    const givenVariantClass = function (viewIdInfo, templatesByOwnership) {
      if (!templatesByOwnership) return;
      return templatesByOwnership["private"] || templatesByOwnership["public"];
    };

    const givenVariant = function (viewIdInfo, templatesByClassOwnership) {
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
        datapointId: field.getDatapointId({
          dbRowId: viewIdInfo.dbRowId
        })
      };
    });
    template.templateChildren.forEach(child => {
      const field = type.fields[child.modelField];
      if (!field) return;
      const info = {
        datapointId: field.getDatapointId({
          dbRowId: viewIdInfo.dbRowId
        })
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
      ret.subtemplates = {
        value: {}
      };
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

    const datapointId = thisTemplates.cache.schema.allTypes[this.Template].fields['subtemplates'].getDatapointId(viewIdInfo)
    const subtemplates = await this.cache.getDatapointValue({
      datapointId
    })

    subtemplates.forEach(subtemplate => {
      if (!subtemplate.modelView) return;

      let subviewIdInfo = ConvertIds.decomposeId({
        proxyableViewId: subtemplate.modelView,
        relaxed: true
      });
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

      addToOutputKeys[subtemplate.domField] = {
        value: [subviewIdInfo.proxyableViewId]
      };
    });
  }

  completeOutputKeysForView({
    typeName,
    dbRowId
  }) {
    const thisTemplates = this;

    const type = thisTemplates.cache.schema.allTypes[typeName];
    const outputKeys = {};
    Object.keys(type.fields).forEach(fieldName => {
      const field = type.fields[fieldName];
      outputKeys[fieldName] = {
        datapointId: field.getDatapointId({
          dbRowId: dbRowId
        })
      };
      if (field.isId) {
        outputKeys[fieldName].variant = "complete";
      }
    });

    return outputKeys;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: TemplateLocator,
  hasExposedBackDoor: true
});