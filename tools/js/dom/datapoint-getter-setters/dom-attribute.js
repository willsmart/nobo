const ChangeCase = require('change-case');
const CodeSnippet = require('../../general/code-snippet');

const fieldNamePrefix = 'attribute-',
  templateSuffix = '-template';

module.exports = function({ datapoint }) {
  const { fieldName, typeName, rowId, proxyKey } = datapoint;

  if (typeof document == 'undefined' || typeName != 'Dom' || !proxyKey) {
    return;
  }

  const paramCaseFieldName = ChangeCase.paramCase(fieldName);
  if (!paramCaseFieldName.startsWith(fieldNamePrefix)) return;

  const valueAttributeName = paramCaseFieldName.substring(fieldNamePrefix.length),
    templateAttributeName = valueAttributeName + templateSuffix,
    match = /^text-node-(\d+)$/.exec(valueAttributeName),
    textNodeIndex = match ? Number(match[1]) : undefined;

  if (valueAttributeName.endsWith(templateSuffix)) {
    return;
  }

  let datapointState = { template: '', compiledGetter: undefined };

  getValue = element => {
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

  setValue = (element, value) => {
    if (textNodeIndex !== undefined) {
      let value = '';
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
    const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' })),
      newState = { template: '', compiledGetter: undefined };

    if (willRetry()) return;

    let value = '';
    do {
      if (!element) break;

      if (!element.hasAttribute(templateAttributeName)) {
        value = getValue(element);
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
              rowId: element.getAttribute('nobo-row-id'),
            })
          )
        : '';
    } while (false);

    if (!willRetry()) {
      if (element) setValue(element, value);
      datapointState = newState;
    }

    return value;
  };

  return {
    getter: {
      fn: evaluate,
    },
    setter: {
      fn: (_newValue, { getDatapointValue, getRowObject }) => evaluate({ getDatapointValue, getRowObject }),
    },
  };
};
