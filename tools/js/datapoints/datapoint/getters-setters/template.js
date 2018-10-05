const ChangeCase = require('change-case');

module.exports = function({ datapoint, templates }) {
  const { fieldName, typeName, datapointId } = datapoint;

  if (!templates) return;

  let match = /^dom(\w*)$/.exec(fieldName);
  if (match) {
    const variant = ChangeCase.camelCase(match[1]),
      names = {
        template: {
          '.datapointId': templates.getTemplateReferencingDatapoint({
            variant,
            classFilter: typeName,
            ownerOnly: false,
          }).datapointId,
          dom: {},
        },
      };

    return {
      getter: {
        names,
        fn: ({ template }) => template.dom,
      },
      setter: {
        names,
        fn: ({ template, newValue }) => (template.dom = newValue),
      },
    };
  }

  match = /^template(\w*)$/.exec(fieldName);
  if (match) {
    const variant = ChangeCase.camelCase(match[1]),
      names = {
        template: {
          '.datapointId': templates.getTemplateReferencingDatapoint({
            variant,
            classFilter: typeName,
            ownerOnly: false,
          }).datapointId,
        },
      };

    return {
      getter: {
        names,
        fn: ({ template }) => template.id,
      },
      setter: {
        names,
        fn: ({ template }) => template.id,
      },
    };
  }

  if (typeName == 'App' && fieldName.startsWith('useTemplate_')) {
    return {
      getter: {
        names,
        fn: () => {
          const rowId = templates.referencedTemplateRowIdForTemplateDatapointId(datapointId);
          return rowId ? [rowId] : [];
        },
      },
    };
  }
};
