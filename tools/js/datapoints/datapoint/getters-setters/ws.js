const PageState = require('../../../client/page-state');

module.exports = function({ datapoint,cache, schema }) {
  const { fieldName, proxyKey, typeName } = datapoint,
  type = schema.allTypes[typeName];

  if (!cache.isClient || !type) return;

  const field = type.getField(fieldName);
  if (!field) return;

    return {
      getter: {
        fn: () => {
          new Promise(resolve => {
            datapointDbConnection.queueGet({ field, dbRowId, resolve });
          }),
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
