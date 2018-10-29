const ConvertIds = require('../../datapoints/convert-ids');

module.exports = function({ datapoint }) {
  const { fieldName, typeName, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey) {
    return;
  }

  if (fieldName == 'context') {
    return {
      getter: {
        fn: () => datapoint.valueIfAny || { rowId: undefined, variant: undefined },
      },
      setter: {
        fn: context => {
          let rowId, variant;
          if (typeof context == 'string') {
            if (ConvertIds.rowRegex.test(context)) rowId = context;
            else if (ConvertIds.datapointRegex.test(context)) {
              ({ rowId, fieldName: variant } = ConvertIds.decomposeId({ datapointId: context }));
            }
          } else if (typeof context == 'object') {
            ({ rowId, variant } = context);
            if (rowId && (typeof rowId != 'string' || !ConvertIds.rowRegex.test(rowId))) {
              rowId = undefined;
            }
            if (variant && (typeof variant != 'string' || !ConvertIds.fieldNameRegex.test(variant))) {
              rowId = undefined;
              variant = undefined;
            }
          }
          return { rowId, variant };
        },
      },
    };
  }
};
