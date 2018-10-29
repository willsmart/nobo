const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const diffAny = require('../../general/diff');
const { childRangesForElement, insertChildRange, deleteChildRange } = require('../dom-functions');

let _nextElementId = 2;
function nextElementId() {
  return `seq${_nextElementId++}`;
}

module.exports = function({ datapoint }) {
  const { fieldName: childrenFieldName, typeName, rowId, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey) {
    return;
  }

  const match = /^children([A-Z].*)$/.exec(childrenFieldName);
  if (!match) return;

  const fieldName = ChangeCase.camelCase(match[1]);

  let datapointState = { childTrees: [] };
  const childrenWorkingArray = [];

  evaluate = ({ getDatapointValue, setDatapointValue, willRetry }) => {
    const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId),
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
        rowId => typeof rowId == 'string' && (ConvertIds.rowRegex.test(rowId) || ConvertIds.datapointRegex.test(rowId))
      );

      const diff = diffAny(childrenWorkingArray.map(child => child.id), childIds);

      if (diff && diff.arrayDiff) {
        for (const { insertAt, deleteAt, value: id } of diff.arrayDiff) {
          if (insertAt !== undefined) {
            const childProxyKey = nextElementId(),
              contextDatapointId = ConvertIds.recomposeId({
                typeName: 'Dom',
                proxyKey: childProxyKey,
                fieldName: 'context',
              }),
              contextDatapointInfo = ConvertIds.rowRegex.test(id)
                ? { rowId: id }
                : ConvertIds.decomposeId({ datapointId: id });

            setDatapointValue(contextDatapointId, {
              rowId: contextDatapointInfo.rowId,
              variant: contextDatapointInfo.fieldName,
            });

            childrenWorkingArray.splice(insertAt, 0, {
              elementId: nextElementId(),
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
        ConvertIds.recomposeId({
          typeName: 'Dom',
          proxyKey: child.elementId,
          fieldName: 'tree',
        }).datapointId
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
