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

  async forView({ rowId, ownerOnly = false, variant }) {
    const requiredDatapoints = this,
      ret = {},
      promises = [];
    requiredDatapoints._forView({ rowId, ownerOnly, variant, ret, promises });
    while (promises.length) {
      const promisesCopy = promises.slice();
      promises.splice(0, promises.length);
      await Promise.all(promisesCopy);
    }
    return ret;
  }

  _forView({ rowId, ownerOnly = false, variant, ret = {}, promises = [] }) {
    const requiredDatapoints = this,
      { templates, cache } = requiredDatapoints;

    const templateDatapointId = ConvertIds.recomposeId({ rowId, fieldName: `template_${variant || ''}` }).datapointId,
      templateDatapoint = cache.getOrCreateDatapoint({ datapointId: templateDatapointId });
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
        domDatapoint = cache.getOrCreateDatapoint({ datapointId: domDatapointId });
      ret[domDatapointId] = { callbackKey: domDatapoint.watch({}) };
      if (domDatapoint.invalid) {
        promises.push(domDatapoint.value);
      }

      for (const fieldName of template.displayedFields) {
        const datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId;
        const datapoint = cache.getOrCreateDatapoint({ datapointId });
        ret[datapointId] = { callbackKey: datapoint.watch({}) };
        if (datapoint.invalid) {
          promises.push(datapoint.value);
        }
      }
      for (const { fieldName, variants } of template.children) {
        const datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId;
        const datapoint = cache.getOrCreateDatapoint({ datapointId });
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
              if (ConvertIds.proxyableRowIdRegex.test(childRowOrDatapointId)) {
                childRowId = childRowOrDatapointId;
                childVariant = variant;
              } else {
                const datapointInfo = ConvertIds.decomposeId({ proxyableDatapointId: childRowOrDatapointId });
                if (!(datapointInfo.proxyableRowId && datapointInfo.fieldName)) continue;
                childRowId = datapointInfo.proxyableRowId;
                childVariant = datapointInfo.fieldName;
              }
              requiredDatapoints._forView({ rowId: childRowId, variant: childVariant, ret, promises });
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
