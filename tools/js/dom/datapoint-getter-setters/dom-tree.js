const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const { rangeForElement } = require('../dom-functions');

module.exports = function({ datapoint, cache }) {
  const { fieldName, typeName, rowId, proxyKey: baseProxyKey } = datapoint;

  if (typeName != 'Dom' || !baseProxyKey) {
    return;
  }

  if (fieldName == 'tree') {
    const match = /^(\w+?)(?:_lid_([0-9]\d*))?$/.exec(baseProxyKey),
      lid = match[2] ? Number(match[2]) : undefined;

    if (lid !== undefined) return;

    evaluateTree = ({ getDatapointValue, referenceDatapoint, willRetry }) => {
      const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId);
      if (!element) return;

      referenceDatapoint(
        ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'initializedElement' }).datapointId
      );

      forEachLid(element, (element, lid) => {
        const proxyKey = `${baseProxyKey}_lid_${lid}`;

        for (let attributeIndex = element.attributes.length - 1; attributeIndex >= 0; attributeIndex--) {
          const { name } = element.attributes[attributeIndex];
          if (name.endsWith('-template')) {
            if (/^on[a-z]/.test(name)) {
              const eventName = name.substring(0, name.length - '-template'.length);
              element.removeAttribute(eventName);
              element[eventName] = function(event) {
                cache
                  .getOrCreateDatapoint(
                    ConvertIds.recomposeId({ typeName, proxyKey, fieldName: `attribute_${eventName}` }).datapointId
                  )
                  .validate({ eventContext: event });
              };
            } else {
              const fieldName = ChangeCase.camelCase(
                `attribute-${name.substring(0, name.length - '-template'.length)}`
              );
              if (!/-lazy$|-event$/.test(name)) {
                referenceDatapoint(ConvertIds.recomposeId({ typeName, proxyKey, fieldName }).datapointId);
              }
            }
          }
        }

        for (let classIndex = element.classList.length - 1; classIndex >= 0; classIndex--) {
          const name = element.classList[classIndex];
          if (name.endsWith('-model-child')) {
            referenceDatapoint(ConvertIds.recomposeId({ typeName, proxyKey, fieldName: 'children' }).datapointId);
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
        fn: (_newValue, options) => evaluateTree(options),
      },
    };
  }
};

function forEachLid(element, fn, lid = 1) {
  fn(element, lid);
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (!child.hasAttribute('nobo-lid')) continue;
    const childLid = Number(child.getAttribute('nobo-lid'));
    if (childLid == 1) continue;

    forEachLid(child, fn, childLid);
  }
}
