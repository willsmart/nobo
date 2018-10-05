const PageState = require('../../../client/page-state');

module.exports = function({ datapoint }) {
  const { fieldName, proxyKey, typeName } = datapoint;

  if (typeName !== 'Page' || proxyKey !== 'default') return;

  datapoint._isClient = true;
  if (fieldName == 'items') {
    return {
      getter: {
        fn: () => {
          const state = PageState.currentWindowState;
          return state && state.pageDatapointId ? [state.pageDatapointId] : [];
        },
      },
      setter: {
        fn: items => {
          if (Array.isArray(items)) {
            PageState.global.visit(items.length && typeof items[0] == 'string' ? items[0] : undefined);
          }
          return items;
        },
      },
    };
  }
};
