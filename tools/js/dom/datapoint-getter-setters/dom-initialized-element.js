const ConvertIds = require('../../datapoints/convert-ids');

module.exports = function({ datapoint, cache }) {
  const { fieldName, typeName, rowId, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey) {
    return;
  }

  if (fieldName == 'initializedElement') {
    const match = /^(\w+?)(?:_lid_([1-9]\d*))$/.exec(proxyKey);
    if (match) return;

    datapoint.autovalidates = true;

    let datapointState = { element: undefined };

    evaluateInitializedElement = ({ getDatapointValue, willRetry }) => {
      const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId),
        context =
          getDatapointValue(ConvertIds.recomposeId({ typeName, proxyKey, fieldName: 'context' }).datapointId) || {};

      if (element) {
        if (willRetry()) return;

        forEachDescendent = fn => {
          forEachLid(element, (el, lid) => {
            fn(el, ConvertIds.recomposeId({ typeName, proxyKey: `${proxyKey}_lid_${lid}` }));
          });
        };

        // Use this callback to do any initialization of an element dom tree that depends on other datapoints
        // Handlers to this should be idempotent
        cache.notifyListeners('ongetelement', {
          datapoint,
          cache,
          getDatapointValue,
          context,
          willRetry,
          forEachDescendent,
          root: element,
        });

        if (element != datapointState.element) {
          // use this callback to perform a one-time init on the new dom tree
          cache.notifyListeners('onnewelement', {
            datapoint,
            cache,
            root: element,
            forEachDescendent,
          });
        }
      }

      if (willRetry()) return;
      datapointState = { element };
      return element;
    };

    return {
      getter: {
        fn: evaluateInitializedElement,
      },
      setter: {
        fn: (_newValue, { getDatapointValue }) => evaluateInitializedElement({ getDatapointValue }),
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
