const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const { templateDatapointIdForRowAndVariant } = require('../dom-functions');

module.exports = ({ htmlToElement }) =>
  function({ datapoint }) {
    const { fieldName, typeName, rowId, proxyKey } = datapoint;

    if (typeName != 'Dom' || !proxyKey) {
      return;
    }

    if (fieldName == 'element') {
      const match = /^(id_(\w+?))(?:_lid_([0-9]\d*))?$/.exec(proxyKey);
      if (match) {
        const baseProxyKey = match[1],
          elementId = ChangeCase.paramCase(match[2]),
          lid = match[3] ? Number(match[3]) : undefined;

        evaluateElement = ({ getDatapointValue, willRetry }) => {
          if (lid !== undefined) {
            const baseElement = getDatapointValue(
              ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'element' }).datapointId
            );
            if (willRetry() || !baseElement) return;
            const element = lid == 1 ? baseElement : findLid(baseElement, lid);
            if (element) element.setAttribute('nobo-uid', proxyKey);
            return element;
          }

          const element = typeof document == 'undefined' ? undefined : document.getElementById(elementId);
          return element;
        };

        return {
          getter: {
            fn: evaluateElement,
          },
          setter: {
            fn: (_newValue, { getDatapointValue }) => evaluateElement({ getDatapointValue }),
          },
        };
      } else {
        const match = /^(\w+?)(?:_lid_([0-9]\d*))?$/.exec(proxyKey),
          baseProxyKey = match[1],
          lid = match[2] ? Number(match[2]) : undefined;

        const defaultDom = '<div>...</div>';

        let datapointState = { dom: undefined, element: undefined };

        evaluateElement = ({ getDatapointValue, willRetry }) => {
          if (lid !== undefined) {
            const baseElement = getDatapointValue(
              ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'element' }).datapointId
            );
            if (willRetry() || !baseElement) return;
            const element = lid == 1 ? baseElement : findLid(baseElement, lid);
            if (element) element.setAttribute('nobo-uid', proxyKey);
            return element;
          }

          newState = { dom: undefined, element: undefined };

          do {
            const { rowId: sourceRowId, variant } =
              getDatapointValue(
                ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'context' }).datapointId
              ) || {};

            if (sourceRowId) {
              const template = getDatapointValue(templateDatapointIdForRowAndVariant(sourceRowId, variant));

              if (Array.isArray(template) && template.length == 1) {
                newState.dom = getDatapointValue(
                  ConvertIds.recomposeId({ rowId: template[0], fieldName: 'dom' }).datapointId
                );
              }
            }

            if (willRetry()) return;

            if (!newState.dom || typeof newState.dom != 'string') newState.dom = defaultDom;

            if (newState.dom == datapointState.dom) newState.element = datapointState.element;
            else {
              newState.element = htmlToElement(newState.dom);
              if (!newState.element) {
                newState.dom = defaultDom;
                newState.element = htmlToElement(newState.dom);
              }
              newState.element.setAttribute('nobo-rowid', sourceRowId);
              newState.element.setAttribute('nobo-variant', variant || 'default');
            }
          } while (false);

          if (!willRetry()) {
            datapointState = newState;
          }

          return datapointState.element;
        };

        return {
          getter: {
            fn: evaluateElement,
          },
          setter: {
            fn: (_newValue, { getDatapointValue }) => evaluateElement({ getDatapointValue }),
          },
        };
      }
    }
  };

function findLid(element, lid) {
  const elLid = element.getAttribute('nobo-lid');
  if (!elLid) return;
  if (Number(elLid) == lid) return element;

  return findLidChild(element, lid);
}

function findLidChild(element, lid) {
  let prevChild;
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (!child.hasAttribute('nobo-lid')) continue;
    const childLid = Number(child.getAttribute('nobo-lid'));
    if (childLid == 1) continue;

    if (childLid == lid) return child;
    if (prevChild && childLid > lid) {
      return findLidChild(prevChild, lid);
    }
    prevChild = child;
  }
  if (prevChild) {
    return findLidChild(prevChild, lid);
  }
}
