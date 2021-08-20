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
    textNodeIndex = match ? Number(match[1]) : undefined,
    isEvent = /^on[a-z]|-event$/.test(valueAttributeName),
    isLazy = isEvent || /-lazy$/.test(valueAttributeName);

  if (isEvent) datapoint.isEvent = true;
  datapoint.autovalidates = !isLazy;

  if (valueAttributeName.endsWith(templateSuffix)) {
    return;
  }

  let datapointState = { template: '', compiledGetter: undefined, eventCount: 0 };

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
          child.textContent = asString(value);
        } else if (thisTextNodeIndex == textNodeIndex) {
          child.parentNode.removeChild(child);
        }
      }
    } else if (typeof value == 'function') {
      element.removeAttribute(valueAttributeName);
      element[ChangeCase.camelCase(valueAttributeName)] = value;
    } else {
      element.setAttribute(valueAttributeName, asString(value));
    }
  };

  evaluateAttribute = ({ getDatapointValue, getRowObject, willRetry, eventContext, evaluationState }) => {
    const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId),
      { rowId: sourceRowId } =
        getDatapointValue(
          ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'context' }).datapointId
        ) || {},
      newState = { template: '', compiledGetter: undefined, eventCount: datapointState.eventCount + 1 };

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
        ? isEvent
          ? newState.compiledGetter.evaluate({
              getDatapointValue,
              getRowObject,
              event: eventContext,
              rowId: sourceRowId,
              evaluationState,
            })
          : newState.compiledGetter.safeEvaluate({
              getDatapointValue,
              getRowObject,
              rowId: sourceRowId,
            }).result
        : '';
    } while (false);

    if (!willRetry()) {
      if (element && needsSet && !isEvent) setValue(element, valueAttributeName, textNodeIndex, value);
      datapointState = newState;
    }

    return isEvent ? datapointState.eventCount : value;
  };

  return {
    getter: {
      fn: evaluateAttribute,
    },
    setter: {
      fn: (_newValue, options) => evaluateAttribute(options),
    },
  };
};

function asString(value) {
  switch (typeof value) {
    case 'object':
      try {
        return JSON.stringify(value);
      } catch (error) {
        return 'object';
      }
    case 'function':
      return typeof value;
    default:
      return String(value);
  }
}
