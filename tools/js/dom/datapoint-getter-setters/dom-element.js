const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');

module.exports = ({ elementsById, htmlToElement }) =>
  function({ datapoint }) {
    const { fieldName, typeName, rowId, proxyKey } = datapoint;

    if (typeof document == 'undefined' || typeName != 'Dom' || !proxyKey || !proxyKey.startsWith('id')) {
      return;
    }

    if (fieldName == 'element') {
      const defaultDom = '<div>...</div>',
        { rowId, variant = '' } = elementsById[proxyKey] || {};

      let datapointState = { dom: undefined, element: undefined };

      evaluateElement = ({ getDatapointValue, willRetry }) => {
        newState = { dom: undefined, element: undefined };

        do {
          if (rowId) {
            const template = getDatapointValue(
              ConvertIds.recomposeId({ rowId, fieldName: `template${ChangeCase.pascalCase(variant)}` }).datapointId
            );
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
            newState.element.setAttribute('nobo-uid', id);
            newState.element.setAttribute('nobo-row-id', rowId);
            newState.element.setAttribute('nobo-variant', variant);
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

    if (fieldName == 'tree') {
      evaluateTree = ({ getDatapointValue, willRetry }) => {
        const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }));
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
            const fieldName = ChangeCase.camelCase(
              `children-${name.substring(0, name.length - '-model-child'.length)}`
            );
            getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName }));
            break;
          }
        }

        if (willRetry()) return;

        const start = element,
          end = start;
        forEachChildRange(element, ([_childStart, childEnd]) => (end = childEnd));
        return [start, end];
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
