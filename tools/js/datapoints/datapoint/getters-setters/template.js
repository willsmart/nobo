const ChangeCase = require('change-case');

module.exports = function({ datapoint, templates }) {
  const { fieldName, typeName, datapointId } = datapoint;

  if (!templates) return;

  let match = /^dom((?:[A-Z]\w*)?)$/.exec(fieldName);
  if (match) {
    const variant = ChangeCase.camelCase(match[1]),
      templateRefDatapointId = templates.getTemplateReferencingDatapoint({
        variant,
        classFilter: typeName,
        ownerOnly: false,
      }).datapointId;

    return {
      getter: {
        fn: ({ getDatapointValue }) => {
          const templateRow = getDatapointValue(templateRefDatapointId);
          return templateRow ? templateRow.dom : undefined;
        },
      },
      setter: {
        fn: (newValue, { getDatapointValue }) => {
          const templateRow = getDatapointValue(templateRefDatapointId);
          return templateRow ? (templateRow.dom = newValue) : undefined;
        },
      },
    };
  }

  match = /^template((?:[A-Z]\w*)?)$/.exec(fieldName);
  if (match) {
    const variant = ChangeCase.camelCase(match[1]),
      templateRefDatapointId = templates.getTemplateReferencingDatapoint({
        variant,
        classFilter: typeName,
        ownerOnly: false,
      }).datapointId;

    datapoint._isId = true;

    return {
      getter: {
        fn: ({ getDatapointValue }) => {
          return getDatapointValue(templateRefDatapointId);
        }, // TODO make this an id
      },
      setter: {
        fn: (_newValue, { getDatapointValue }) => getDatapointValue(templateRefDatapointId),
      },
    };
  }

  if (typeName == 'App' && fieldName.startsWith('useTemplate')) {
    datapoint._isId = true;

    return {
      getter: {
        fn: () => {
          const rowId = templates.referencedTemplateRowIdForTemplateDatapointId(datapointId);
          return rowId ? [rowId] : [];
        },
      },
    };
  }
};
