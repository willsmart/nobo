const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const CodeSnippet = require('../../general/code-snippet');
const { decomposeDatapointProxyKey } = require('../dom-functions');

const fieldNamePrefix = 'attribute-',
  templateSuffix = '-template';

module.exports = function({ datapoint }) {
  const { fieldName, typeName, rowId, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey) {
    return;
  }

  const { baseProxyKey } = decomposeDatapointProxyKey(proxyKey);

  const paramCaseFieldName = ChangeCase.paramCase(fieldName);
  if (!paramCaseFieldName.startsWith(fieldNamePrefix)) return;

  const valueAttributeName = paramCaseFieldName.substring(fieldNamePrefix.length),
    templateAttributeName = valueAttributeName + templateSuffix,
    match = /^textnode(\d+)$/.exec(valueAttributeName),
    textNodeIndex = match ? Number(match[1]) : undefined;

  if (valueAttributeName.endsWith(templateSuffix)) {
    return;
  }

  let datapointState = { template: '', compiledGetter: undefined };

  getValue = (element, valueAttributeName, textNodeIndex) => {
    if (textNodeIndex !== undefined) {
      let value = '';
      for (
        let child = element.firstChild, thisTextNodeIndex = -1, inTextNode = false;
        child;
        child = child.nextSibling
      ) {
        if (child.nodeType != 3) {
          if (inTextNode) {
            if (thisTextNodeIndex == textNodeIndex) break;
            inTextNode = false;
          }
          continue;
        }
        if (!inTextNode) {
          thisTextNodeIndex++;
          inTextNode = true;
        }
        if (thisTextNodeIndex == textNodeIndex) {
          value += child.textContent;
        }
      }
      return value;
    }
    return element.getAttribute(valueAttributeName) || '';
  };

  setValue = (element, valueAttributeName, textNodeIndex, value) => {
    if (textNodeIndex !== undefined) {
      for (
        let child = element.firstChild,
          nextChild = child ? child.nextSibling : undefined,
          thisTextNodeIndex = -1,
          inTextNode = false;
        child;
        child = nextChild, nextChild = child ? child.nextSibling : undefined
      ) {
        if (child.nodeType != 3) {
          if (inTextNode) {
            if (thisTextNodeIndex == textNodeIndex) break;
            inTextNode = false;
          }
          continue;
        }
        if (!inTextNode) {
          thisTextNodeIndex++;
          inTextNode = true;
          child.textContent = value;
        } else if (thisTextNodeIndex == textNodeIndex) {
          child.parentNode.removeChild(child);
        }
      }
    } else {
      element.setAttribute(valueAttributeName, value);
    }
  };

  evaluate = ({ getDatapointValue, getRowObject, willRetry }) => {
    const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId),
      { rowId: sourceRowId } =
        getDatapointValue(
          ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'context' }).datapointId
        ) || {},
      newState = { template: '', compiledGetter: undefined };

    if (willRetry()) return;

    let value = '',
      needsSet = true;
    do {
      if (!element) break;

      if (!element.hasAttribute(templateAttributeName)) {
        value = getValue(element, valueAttributeName, textNodeIndex);
        needsSet = false;
        break;
      }

      newState.template = element.getAttribute(templateAttributeName);

      newState.compiledGetter =
        newState.template == datapointState.template
          ? datapointState.compiledGetter
          : new CodeSnippet({
              code: newState.template,
            });

      value = newState.compiledGetter
        ? String(
            newState.compiledGetter.evaluate({
              getDatapointValue,
              getRowObject,
              rowId: sourceRowId,
            })
          )
        : '';
    } while (false);

    if (!willRetry()) {
      if (element && needsSet) setValue(element, valueAttributeName, textNodeIndex, value);
      datapointState = newState;
    }

    return value;
  };

  datapoint.autovalidates = true;
  return {
    getter: {
      fn: evaluate,
    },
    setter: {
      fn: (_newValue, { getDatapointValue, getRowObject }) => evaluate({ getDatapointValue, getRowObject }),
    },
  };
};
