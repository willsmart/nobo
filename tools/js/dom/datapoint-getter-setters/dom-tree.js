const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const { rangeForElement } = require('../dom-functions');

module.exports = function({ datapoint }) {
  const { fieldName, typeName, rowId, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey) {
    return;
  }

  if (fieldName == 'tree') {
    evaluateTree = ({ getDatapointValue, willRetry }) => {
      const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId);
      if (!element) return;

      for (let attributeIndex = element.attributes.length - 1; attributeIndex >= 0; attributeIndex--) {
        const { name } = element.attributes[attributeIndex];
        if (name.endsWith('-template')) {
          const fieldName = ChangeCase.camelCase(`attribute-${name.substring(0, name.length - '-template'.length)}`);
          getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName }));
        }
      }

      for (let classIndex = element.classList.length - 1; classIndex >= 0; classIndex--) {
        const name = element.classList[classIndex];
        if (name.endsWith('-model-child')) {
          const fieldName = ChangeCase.camelCase(`children-${name.substring(0, name.length - '-model-child'.length)}`);
          getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName }));
          break;
        }
      }

      if (willRetry()) return;

      return rangeForElement(element);
    };

    return {
      getter: {
        fn: evaluateTree,
      },
      setter: {
        fn: (_newValue, { getDatapointValue }) => evaluateTree({ getDatapointValue }),
      },
    };
  }
};
