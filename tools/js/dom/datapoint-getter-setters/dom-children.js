const ChangeCase = require('change-case');
const CodeSnippet = require('../../general/code-snippet');
const diffAny = require('../../general/diff');

const fieldNamePrefix = 'children';

let _nextElementId = 1;
function nextElementId() {
  return `id${_nextElementId++}`;
}

module.exports = ({ elementStore }) =>
  function({ datapoint }) {
    const { fieldName: childrenFieldName, typeName, rowId, proxyKey } = datapoint;

    if (typeof document == 'undefined' || typeName != 'Dom' || !proxyKey) {
      return;
    }

    const match = /^children([A-Z].*)$/.exec(childrenFieldName);
    if (!match) return;

    const fieldName = ChangeCase.camelCase(match[1]);

    let datapointState = { childTrees: [] };
    const childrenWorkingArray = [];

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

    evaluate = ({ getDatapointValue, willRetry }) => {
      const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' })),
        newState = { childTrees: undefined };

      if (willRetry()) return;

      do {
        if (!element) {
          childrenWorkingArray = [];
          break;
        }

        let childIds = getDatapointValue(
          ConvertIds.recomposeId({ rowId: element.getAttribute('nobo-row-id'), fieldName })
        );
        if (willRetry()) return;

        if (!Array.isArray(childIds)) childRowIds = [];
        childIds = childIds.filter(
          rowId =>
            typeof rowId == 'string' && (ConvertIds.rowRegex.test(rowId) || ConvertIds.datapointRegex.test(rowId))
        );

        const diff = diffAny(childrenWorkingArray.map(child => child.id), childIds);

        if (diff && diff.arrayDiff) {
          for (const { insertAt, deleteAt, value: id } of diff.arrayDiff) {
            if (insertAt !== undefined) {
              const { rowId, fieldName: variant } = ConvertIds.decomposeId({
                  rowId: ConvertIds.rowRegex.test(id) ? id : undefined,
                  datapointId: ConvertIds.datapointRegex.test(id) ? id : undefined,
                }),
                elementId = nextElementId();

              childrenWorkingArray.splice(insertAt, 0, {
                id,
                rowId,
                variant,
                elementId,
              });
            }

            if (deleteAt !== undefined) {
              childrenWorkingArray.splice(deleteAt, 1);
            }
          }
        }
      } while (false);

      for (const child of childrenWorkingArray) {
        child.tree = getDatapointValue(
          ConvertIds.recomposeId({ typeName: 'Dom', proxyKey: child.elementId, fieldName: 'tree' }).datapointId
        );
      }

      newState.childTrees = childrenWorkingArray.map(child => child.tree);

      if (!willRetry()) {
        datapointState = newState;
        const childRanges = childRangesForElement(element);
        const diff = diffAny(childRanges.map(([start]) => start), datapointState.childTrees.map(([start]) => start));

        if (diff && diff.arrayDiff) {
          for (const { insertAt, deleteAt, value: childRange } of diff.arrayDiff) {
            childRange[0].setAttribute('nobo-parent-uid', proxyKey);
            if (insertAt !== undefined) {
              insertChildRange({
                parent: element,
                before: insertAt < childRanges.length ? childRanges[insertAt][0] : undefined,
                childRange,
              });
            }
            if (deleteAt !== undefined) {
              deleteChildRange(childRanges[deleteAt]);
            }
          }
        }
      }

      return datapointState.childTrees;
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

function rangeForElement(element) {
  const parentId = parent.getAttribute('nobo-uid');
  if (!parentId) return [element, element];
  for (let child = parent.nextElementSibling, lastChildEnd = parent; child; child = lastChildEnd.nextElementSibling) {
    if (child.getAttribute('nobo-parent-uid') != parentId) break;
    lastChildEnd = rangeForElement(child)[1];
  }
  return [element, lastChildEnd];
}

function forEachChildRange(parent, fn) {
  const parentId = parent.getAttribute('nobo-uid');
  for (let child = parent.nextElementSibling, lastChildRange; child; child = lastChildRange[1].nextElementSibling) {
    if (child.getAttribute('nobo-parent-uid') != parentId) break;
    fn((lastChildRange = rangeForElement(child)));
  }
}

function childRangesForElement(parent) {
  const ranges = [];
  forEachChildRange(parent, range => ranges.push(range));
  return ranges;
}

function insertChildRange({ parent, before, childRange }) {
  for (
    let [child, end] = childRange, nextChild = child === end ? undefined : child.nextSibling;
    child;
    child = nextSibling, nextSibling = !child || child === end ? undefined : child.nextSibling
  ) {
    parent.insertBefore(child, before);
  }
}

function deleteChildRange([child, end]) {
  for (
    let nextChild = child === end ? undefined : child.nextSibling;
    child;
    child = nextSibling, nextSibling = !child || child === end ? undefined : child.nextSibling
  ) {
    if (child.parentNode) child.parentNode.removeChild(child);
  }
}
