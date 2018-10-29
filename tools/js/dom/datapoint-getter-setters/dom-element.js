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
      const match = /^id([A-Z0-9][A-Za-z0-9]*)$/.exec(proxyKey);
      if (match) {
        const elementId = ChangeCase.paramCase(match[1]);

        evaluateElement = () => {
          const element = typeof document == 'undefined' ? undefined : document.getElementById(elementId);
          if (element) element.setAttribute('nobo-uid', proxyKey);
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
        const defaultDom = '<div>...</div>';

        let datapointState = { dom: undefined, element: undefined };

        evaluateElement = ({ getDatapointValue, willRetry }) => {
          newState = { dom: undefined, element: undefined };

          do {
            const { rowId: sourceRowId, variant } =
              getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'context' }).datapointId) || {};

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
              newState.element.setAttribute('nobo-uid', proxyKey);
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
