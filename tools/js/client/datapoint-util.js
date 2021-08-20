const ConvertIds = require('../datapoints/convert-ids');

let nextLocalId = 1;
window.newdp = (typeName, fieldName) => {
  const datapointInfo = ConvertIds.recomposeId({ typeName, proxyKey: `l${nextLocalId++}`, fieldName });
  return datapointInfo.datapointId || datapointInfo.rowId;
};
