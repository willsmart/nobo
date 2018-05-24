const ConvertIds = require("./convert-ids");
const PublicApi = require("./general/public-api");
const mapValues = require("./general/map-values");

// API is auto-generated at the bottom from the public interface of this class

class Templates {
  // public methods
  static publicMethods() {
    return ["load", "getTemplateReferencingDatapoint", "cache"];
  }

  constructor({
    cache,
    appDbRowId = 1
  }) {
    const templates = this

    templates._cache = cache
    templates.appDbRowId = appDbRowId
    templates.templatesByRowId = {}
    templates.templatesByVariantClassOwnership = {}
    templates.bubbledTemplatesByVariantClassOwnership = {}

    this.callbackKey = cache.getOrCreateDatapoint({
      datapointId: this.appTemplatesDatapointId
    }).watch({
      onvalid: (datapoint) => {
        if (Array.isArray(datapoint.valueIfAny)) {
          templates.setTemplateRowIds({
            rowIds: datapoint.valueIfAny
          })
        }
      }
    })
  }

  get appTemplatesDatapointId() {
    return ConvertIds.recomposeId({
      typeName: 'App',
      dbRowId: this.appDbRowId,
      fieldName: 'templates'
    }).datapointId
  }

  appTemplateDatapointId({
    variant,
    classFilter,
    ownerOnly
  }) {
    return ConvertIds.recomposeId({
      typeName: 'App',
      dbRowId: this.appDbRowId,
      fieldName: `useTemplate_${variant?`V_${variant}_`:''}${classFilter?`C_${classFilter}_`:''}${ownerOnly?'_private':''}`
    }).datapointId
  }

  get cache() {
    return this._cache
  }

  setTemplateRowIds({
    rowIds
  }) {
    const templates = this

    const missing = mapValues(templates.templatesByRowId, () => true)
    for (const rowId of rowIds) {
      if (templates.templatesByRowId[rowId]) {
        delete missing[rowId];
        continue
      }
      templates.templatesByRowId[rowId] = new Template({
        templates,
        rowId
      })
    }

    for (const rowId of Object.keys(missing)) {
      templates.templatesByRowId[rowId].delete()
      delete templates.templatesByRowId[rowId]
    }
  }

  getTemplateReferencingDatapoint({
    variant,
    classFilter,
    ownerOnly
  }) {
    return this.treeNode({
      canCreate: true,
      variant,
      classFilter,
      ownerOnly
    }).datapoint
  }

  removeFromTemplatesTree({
    variant,
    classFilter,
    ownerOnly
  }) {
    this.addToTemplatesTree({
      variant,
      classFilter,
      ownerOnly
    })
  }

  addToTemplatesTree({
    template,
    variant,
    classFilter,
    ownerOnly
  }) {
    const templates = this,
      node = templates.treeNode({
        canCreate: true,
        variant,
        classFilter,
        ownerOnly
      }),
      templateWas = node.template
    if (templateWas === template) return

    for (const child of node.subtree) {
      if (child.template === templateWas) {
        if (template) {
          child.template = template
          child.datapoint.invalidate({
            queueValidationJob: true
          })
        } else {
          const useParent = child.parents.find((parent) => parent.template),
            useTemplate = (useParent ? useParent.template : undefined)

          if (child.template !== useTemplate) {
            child.template = useTemplate
            child.datapoint.invalidate({
              queueValidationJob: true
            })
          }
        }
      }
    }
  }

  treeNode({
    canCreate = false,
    variant,
    classFilter,
    ownerOnly
  }) {
    const templates = this

    function newTreeNode({
      variant,
      classFilter,
      ownerOnly,
      parents
    }) {
      const node = {
        variant,
        classFilter,
        ownerOnly,
        parents
      }
      node.subtree = [node]
      for (const parent of parents) parent.subtree.push(node)
      node.datapoint = templates.cache.getOrCreateDatapoint({
        datapointId: templates.appTemplateDatapointId({
          variant,
          classFilter,
          ownerOnly
        })
      })
      node.datapoint.setVirtualField({
        isId: true,
        isMultiple: false,
        getterFunction: () => {
          return node.template ? [node.template.rowId] : []
        }
      })
      node.datapoint.invalidate({
        queueValidationJob: true
      })
      node.callbackKey = node.datapoint.watch({})
      return node
    }


    let tree = templates.tree
    if (!tree) {
      if (!canCreate) return;
      tree = templates.tree = newTreeNode({
        parents: []
      })
    }
    if (ownerOnly) {
      if (!tree.private) {
        if (canCreate) {
          tree.private = newTreeNode({
            ownerOnly,
            parents: [tree]
          })
        } else return
      }
      tree = tree.private
    }

    function withClassFilter({
      node,
      classFilter
    }) {
      if (!classFilter) return node;
      if (node.classFilters && node.classFilters[classFilter]) return node.classFilters[classFilter]
      if (!canCreate) return

      const parents = node.parents.slice()
      for (const parent of node.parents) {
        parents.unshift(withClassFilter({
          node: parent,
          classFilter
        }))
      }
      parents.unshift(node)

      if (!node.classFilters) node.classFilters = {}
      return node.classFilters[classFilter] = newTreeNode({
        classFilter,
        variant: node.variant,
        ownerOnly: node.ownerOnly,
        parents
      })
    }

    function withVariant({
      node,
      variant
    }) {
      if (!variant) return node;
      if (node.variants && node.variants[variant]) return node.variants[variant]
      if (!canCreate) return

      const parents = node.parents.slice()
      for (const parent of node.parents) {
        parents.unshift(withVariant({
          node: parent,
          variant
        }))
      }
      parents.unshift(node)

      if (!node.variants) node.variants = {}
      return node.variants[variant] = newTreeNode({
        classFilter: classFilter,
        variant,
        ownerOnly: node.ownerOnly,
        parents
      })
    }

    return withVariant({
      variant,
      node: withClassFilter({
        classFilter,
        node: tree
      })
    })
  }

}

class Template {
  constructor({
    templates,
    rowId
  }) {
    const template = this,
      cache = templates.cache

    template.templates = templates
    template.datapoints = {}
    const callbackKey = template.callbackKey = `${templates.callbackKey}:${rowId}`

    Object.assign(template, ConvertIds.decomposeId({
      rowId
    }))

    for (const fieldName of ['classFilter', 'ownerOnly', 'variant']) {
      const datapoint = template.datapoints[fieldName] = cache.getOrCreateDatapoint(ConvertIds.recomposeId(template, {
        fieldName
      }))
      const callbackProperty = `${fieldName}Changed`
      datapoint.watch({
        callbackKey,
        onvalid: () => {
          template.refreshInTemplatesTree()
        },
        oninvalid: () => {
          template.refreshInTemplatesTree()
        }
      })
    }

    template.refreshInTemplatesTree()
  }

  refreshInTemplatesTree() {
    const template = this,
      templates = template.templates

    const vcoWas = template._variantClassFilterOwnership,
      vco = template.variantClassFilterOwnership
    if (vco) vco.template = template

    if (vco) {
      if (vcoWas) {
        if (vco.variant == vcoWas.variant && vco.classFilter == vcoWas.classFilter && vco.ownerOnly == vcoWas.ownerOnly) {
          return
        }
        templates.removeFromTemplatesTree(vcoWas)
      }
      templates.addToTemplatesTree(vco)
      template._variantClassFilterOwnership = vco
    } else {
      if (vcoWas) templates.removeFromTemplatesTree(vcoWas)
      delete template._variantClassFilterOwnership
    }
  }

  get variantClassFilterOwnership() {
    return this.valuesOfDatapoints({
      fieldNames: ['variant', 'classFilter', 'ownerOnly'],
      allOrNothing: true
    })
  }

  valuesOfDatapoints({
    fieldNames,
    allOrNothing = false
  }) {
    const template = this
    const ret = {}
    let hasInvalid = false
    for (const fieldName of fieldNames) {
      const datapoint = template.datapoints[fieldName]

      if (!datapoint || datapoint.invalid) hasInvalid = true;
      else ret[fieldName] = datapoint.valueIfAny
    }
    if (hasInvalid) {
      template.templates.cache.queueValidationJob()
      if (allOrNothing) return
    }

    return ret
  }

  delete() {
    const template = this,
      templates = template.templates,
      callbackKey = template.callbackKey

    for (const datapoint of Object.values(template.datapoints)) {
      datapoint.stopWatching({
        callbackKey
      })
    }
    template.datapoints = {}
    templates.removeFromTemplatesTree(vcoWas)
  }

}

// API is the public facing class
module.exports = PublicApi({
  fromClass: Templates,
  hasExposedBackDoor: true
});