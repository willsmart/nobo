const g_state = {};

module.exports = function({ datapoint }) {
  const { fieldName, typeName, proxyKey = 'default' } = datapoint;

  if (typeName !== 'State') return;

  datapoint._isClient = true;
  const state = g_state[proxyKey] || (g_state[proxyKey] = {}),
    datapointState = (state[fieldName] = {
      value: undefined,
    });
  datapoint.deletionCallbacks.push(() => {
    delete state[fieldName];
  });
  return {
    getter: {
      fn: () => datapointState.value,
    },
    setter: {
      fn: newValue => (datapointState.value = newValue),
    },
  };
};
