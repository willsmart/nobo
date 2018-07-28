const ConvertIds = require('./convert-ids');
const PublicApi = require('./general/public-api');
const mapValues = require('./general/map-values');

// API is auto-generated at the bottom from the public interface of this class

class RequiredDatapoints {
  // public methods
  static publicMethods() {
    return ['forView'];
  }

  constructor({ cache }) {
    const requiredDatapoints = this;

    requiredDatapoints.cache = cache;
    requiredDatapoints.templates = cache.templates;
  }

  async forView({ rowId, ownerOnly = false, variant, rowProxy }) {
    const requiredDatapoints = this,
      ret = {},
      promises = [];
    requiredDatapoints._forView({ rowId, ownerOnly, variant, ret, promises, rowProxy });
    while (promises.length) {
      const promisesCopy = promises.slice();
      promises.splice(0, promises.length);
      await Promise.all(promisesCopy);
    }
    return ret;
  }

  getOrCreateDatapoint({ datapointId, rowProxy }) {
    const datapointInfo = rowProxy.makeConcrete({ datapointId });
    if (!datapointInfo) return;
    return this.cache.getOrCreateDatapoint({ datapointId: datapointInfo.datapointId });
  }

  _forView({ rowId, ownerOnly = false, variant, ret = {}, promises = [], rowProxy }) {
    const requiredDatapoints = this,
      { templates } = requiredDatapoints;

    const templateDatapointId = ConvertIds.recomposeId({ rowId, fieldName: `template_${variant || ''}` }).datapointId,
      templateDatapoint = requiredDatapoints.getOrCreateDatapoint({ datapointId: templateDatapointId, rowProxy });
    if (!templateDatapoint) return;
    ret[templateDatapointId] = { callbackKey: templateDatapoint.watch({}) };

    if (templateDatapoint.invalid) {
      promises.push(templateDatapoint.value.then(templateRowIds => handleTemplateRowIds(templateRowIds)));
    } else {
      handleTemplateRowIds(templateDatapoint.valueIfAny);
    }

    function handleTemplateRowIds(templateRowIds) {
      if (!(Array.isArray(templateRowIds) && templateRowIds.length == 1)) return;
      const templateRowId = templateRowIds[0],
        template = templates.template({ rowId: templateRowId });
      if (!template) return;

      const domDatapointId = ConvertIds.recomposeId({ rowId: templateRowId, fieldName: 'dom' }).datapointId,
        domDatapoint = requiredDatapoints.getOrCreateDatapoint({ datapointId: domDatapointId, rowProxy });
      if (domDatapoint) {
        ret[domDatapointId] = { callbackKey: domDatapoint.watch({}) };
        if (domDatapoint.invalid) {
          promises.push(domDatapoint.value);
        }
      }

      for (const fieldName of template.displayedFields) {
        const datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId;
        const datapoint = requiredDatapoints.getOrCreateDatapoint({ datapointId, rowProxy });
        if (!datapoint) continue;
        ret[datapointId] = { callbackKey: datapoint.watch({}) };
        if (datapoint.invalid) {
          promises.push(datapoint.value);
        }
      }
      for (const { fieldName, variants } of template.children) {
        const datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId;
        const datapoint = requiredDatapoints.getOrCreateDatapoint({ datapointId, rowProxy });
        if (!datapoint) continue;
        ret[datapointId] = { callbackKey: datapoint.watch({}) };
        if (datapoint.invalid) {
          promises.push(datapoint.value.then(children => handleChildren(children)));
        } else {
          handleChildren(datapoint.valueIfAny);
        }

        function handleChildren(children) {
          if (!Array.isArray(children)) return;
          for (const variant of variants) {
            for (const childRowOrDatapointId of children) {
              let childRowId,
                childVariant = variant;
              if (ConvertIds.rowRegex.test(childRowOrDatapointId)) {
                childRowId = childRowOrDatapointId;
                childVariant = variant;
              } else {
                const datapointInfo = ConvertIds.decomposeId({ datapointId: childRowOrDatapointId });
                if (!(datapointInfo.rowId && datapointInfo.fieldName)) continue;
                childRowId = datapointInfo.rowId;
                childVariant = datapointInfo.fieldName;
              }
              requiredDatapoints._forView({ rowId: childRowId, variant: childVariant, ret, promises, rowProxy });
            }
          }
        }
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: RequiredDatapoints,
  hasExposedBackDoor: true,
});
