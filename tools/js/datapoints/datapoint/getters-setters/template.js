module.exports = function({ datapoint, templates }) {
  const { fieldName } = datapoint;

  let match = /^dom(\w*)$/.exec(fieldName);
  if (templates && match) {
    const variant = ChangeCase.camelCase(match[1]),
      names = {
        template: {
          '.datapointId': templates.getTemplateReferencingDatapoint({
            variant,
            classFilter: datapoint.typeName,
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

  match = /^template(\w*)$/.exec(datapoint.fieldName);
  if (templates && match) {
    const variant = ChangeCase.camelCase(match[1]),
      names = {
        template: {
          '.datapointId': templates.getTemplateReferencingDatapoint({
            variant,
            classFilter: datapoint.typeName,
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
};
