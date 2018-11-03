const ConvertIds = require('../../datapoints/convert-ids');
const CodeSnippet = require('../../general/code-snippet');

module.exports = function({ datapoint }) {
  const { fieldName, typeName, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey) {
    return;
  }

  if (fieldName == 'context') {
    let datapointState = {
      compiledGetter: undefined,
      rowId: undefined,
      variantTemplate: undefined,
      variant: undefined,
    };

    let firstTimeResolvers = [];

    function evaluateContext({ getDatapointValue, getRowObject, willRetry, newState }) {
      if (!newState) newState = Object.assign({}, datapointState);
      newState.resolvers = datapointState.resolvers;

      if (newState.variantTemplate == datapointState.variantTemplate) {
        newState.compiledGetter = datapointState.compiledGetter;
      } else if (!newState.variantTemplate) newState.compiledGetter = undefined;
      else {
        newState.compiledGetter = new CodeSnippet({
          code: newState.variantTemplate,
        });
      }

      if (newState.compiledGetter && newState.rowId) {
        newState.variant = String(
          newState.compiledGetter.safeEvaluate({
            getDatapointValue,
            getRowObject,
            rowId: newState.rowId,
          }).result
        );
      }

      if (!willRetry()) {
        datapointState = newState;
      }
      return { rowId: datapointState.rowId, variant: datapointState.variant };
    }

    return {
      getter: {
        fn: ({ getDatapointValue, getRowObject, willRetry }) => {
          if (firstTimeResolvers) {
            return new Promise(resolve => {
              firstTimeResolvers.push(resolve);
            });
          } else return evaluateContext({ getDatapointValue, getRowObject, willRetry });
        },
      },
      setter: {
        fn: (context, { getDatapointValue, getRowObject, willRetry }) => {
          let rowId, variant, variantTemplate;
          if (typeof context == 'string') {
            if (ConvertIds.rowRegex.test(context)) rowId = context;
            else if (ConvertIds.datapointRegex.test(context)) {
              ({ rowId, fieldName: variant } = ConvertIds.decomposeId({ datapointId: context }));
            }
          } else if (typeof context == 'object') {
            ({ rowId, variant, variantTemplate } = context);
            if (rowId && (typeof rowId != 'string' || !ConvertIds.rowRegex.test(rowId))) {
              rowId = undefined;
            }
            if (variant && (typeof variant != 'string' || !ConvertIds.fieldNameRegex.test(variant))) {
              rowId = undefined;
              variant = undefined;
            }
          }
          const ret = evaluateContext({
            getDatapointValue,
            getRowObject,
            willRetry,
            newState: { rowId, variant, variantTemplate },
          });
          if (!willRetry() && firstTimeResolvers) {
            const resolvers = firstTimeResolvers;
            firstTimeResolvers = undefined;
            for (const resolve of resolvers) resolve(ret);
          }
          return ret;
        },
      },
    };
  }
};
