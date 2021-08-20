const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const diffAny = require('../../general/diff');
const {
  childRangesForElement,
  insertChildRange,
  deleteChildRange,
  decomposeDatapointProxyKey,
} = require('../dom-functions');

let _nextElementId = 2;
function nextElementId() {
  return `seq${_nextElementId++}`;
}

module.exports = function({ datapoint }) {
  const { fieldName: childrenFieldName, typeName, rowId, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey || childrenFieldName != 'children') {
    return;
  }

  const { baseProxyKey } = decomposeDatapointProxyKey(proxyKey);

  let datapointState = { childTrees: [] };
  const childrenWorkingArray = [];

  evaluateChildren = ({ getDatapointValue, setDatapointValue, willRetry }) => {
    const regex = /^([a-z0-9-]+)-model-child$/;
    classNames = (getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'attribute_class' }).datapointId) || '')
      .split(/ /g)
      .filter(v => regex.test(v))
      .sort();
    if (willRetry()) return;
    if (!classNames.length) return [];

    const fieldName = ChangeCase.camelCase(regex.exec(classNames[0])[1]);

    const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId),
      newState = { childTrees: undefined },
      { rowId: sourceRowId } =
        getDatapointValue(
          ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'context' }).datapointId
        ) || {};

    if (willRetry()) return;

    do {
      if (!element) {
        childrenWorkingArray = [];
        break;
      }

      let childIds = sourceRowId
        ? getDatapointValue(ConvertIds.recomposeId({ rowId: sourceRowId, fieldName }).datapointId, {
            convertIdsToCDOs: false,
          })
        : [];

      if (!Array.isArray(childIds)) childIds = [];
      childIds = childIds.filter(
        rowId => typeof rowId == 'string' && (ConvertIds.rowRegex.test(rowId) || ConvertIds.datapointRegex.test(rowId))
      );

      const diff = diffAny(childrenWorkingArray, childIds, (a, b) => a.id == b);

      const childVariantTemplate = element.getAttribute('child-variant-template'),
        childVariant = childVariantTemplate ? undefined : element.getAttribute('child-variant');

      if (willRetry()) return;

      if (diff && diff.arrayDiff) {
        for (let { insertAt, deleteAt, at, value: id } of diff.arrayDiff) {
          if (at !== undefined) {
            insertAt = at;
            deleteAt = at;
          }
          if (deleteAt !== undefined) {
            childrenWorkingArray.splice(deleteAt, 1);
          }
          if (insertAt !== undefined) {
            const childProxyKey = nextElementId(),
              contextDatapointId = ConvertIds.recomposeId({
                typeName: 'Dom',
                proxyKey: childProxyKey,
                fieldName: 'context',
              }).datapointId,
              contextDatapointInfo = ConvertIds.rowRegex.test(id)
                ? { rowId: id }
                : ConvertIds.decomposeId({ datapointId: id });

            setDatapointValue(contextDatapointId, {
              rowId: contextDatapointInfo.rowId,
              variant: contextDatapointInfo.fieldName || childVariant,
              variantTemplate: contextDatapointInfo.fieldName ? undefined : childVariantTemplate,
            });

            childrenWorkingArray.splice(insertAt, 0, {
              id,
              elementId: childProxyKey,
            });
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
      const diff = diffAny(childRanges, datapointState.childTrees, (a, b) => a[0] === b[0]);

      if (diff && diff.arrayDiff) {
        for (let { insertAt, deleteAt, at, value: newChildRange } of diff.arrayDiff) {
          if (at !== undefined) {
            insertAt = at;
            deleteAt = at;
          }
          if (deleteAt !== undefined) {
            deleteChildRange(childRanges.splice(deleteAt, 1)[0]);
          }
          if (insertAt !== undefined) {
            newChildRange[0].setAttribute('nobo-parent-uid', proxyKey);
            insertChildRange({
              parent: element,
              after: insertAt ? childRanges[insertAt - 1][1] : element,
              childRange: newChildRange,
            });
            childRanges.splice(insertAt, 0, newChildRange);
          }
        }
      }
    }

    return datapointState.childTrees;
  };

  datapoint.autovalidates = true;
  return {
    getter: {
      fn: evaluateChildren,
    },
    setter: {
      fn: (_newValue, options) => evaluateChildren(options),
    },
  };
};
