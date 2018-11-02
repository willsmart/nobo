const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const { rangeForElement } = require('../dom-functions');

module.exports = function({ datapoint }) {
  const { fieldName, typeName, rowId, proxyKey: baseProxyKey } = datapoint;

  if (typeName != 'Dom' || !baseProxyKey) {
    return;
  }

  if (fieldName == 'tree') {
    const match = /^(\w+?)(?:_lid_([0-9]\d*))?$/.exec(baseProxyKey),
      lid = match[2] ? Number(match[2]) : undefined;

    if (lid !== undefined) return;

    evaluateTree = ({ getDatapointValue, willRetry }) => {
      const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId);
      if (!element) return;

      forEachLid(element, (element, lid) => {
        const proxyKey = `${baseProxyKey}_lid_${lid}`;

        for (let attributeIndex = element.attributes.length - 1; attributeIndex >= 0; attributeIndex--) {
          const { name } = element.attributes[attributeIndex];
          if (name.endsWith('-template')) {
            const fieldName = ChangeCase.camelCase(`attribute-${name.substring(0, name.length - '-template'.length)}`);
            getDatapointValue(ConvertIds.recomposeId({ typeName, proxyKey, fieldName }).datapointId);
          }
        }

        for (let classIndex = element.classList.length - 1; classIndex >= 0; classIndex--) {
          const name = element.classList[classIndex];
          if (name.endsWith('-model-child')) {
            getDatapointValue(ConvertIds.recomposeId({ typeName, proxyKey, fieldName: 'children' }).datapointId);
            break;
          }
        }
      });

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

function forEachLid(element, fn, lid = 1) {
  fn(element, lid);
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (child.hasAttribute('sourcetemplate') || !child.hasAttribute('nobo-lid')) continue;

    const childLid = Number(child.getAttribute('nobo-lid'));
    forEachLid(child, fn, childLid);
  }
}
