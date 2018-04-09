const ChangeCase = require("change-case");

const typeNameRegex = /([a-z0-9]+(?:_[a-z0-9]+)*)/,
  dbRowIdRegex = /([1-9][0-9]*)/,
  variantRegex = /([a-z0-9]+(?:_[a-z0-9]+)*)/,
  fieldNameRegex = /([a-z0-9]+(?:_[a-z0-9]+)*)/,
  // Pointer to a row in the DB
  //   captures:
  //      [1]: typename in snake_case
  //      [2]: row id as an integer string
  rowRegex = new RegExp(`${typeNameRegex.source}__${dbRowIdRegex.source}`),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  //      [4]: variant in snake_case
  viewRegex = new RegExp(`(${rowRegex.source})__${variantRegex.source}`),
  // Pointer to a particular field of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  //      [4]: field name in snake_case
  datapointRegex = new RegExp(`(${rowRegex.source})__#~?${fieldNameRegex.source}`),
  // at some levels the system uses 'proxy' and 'proxyable' row ids
  // eg, when retrieving a model like 'user__me' the 'me' is a proxy row id
  proxyKeyRegex = /([a-z][a-z0-9]*(?:_[a-z0-9]+)*)/,
  proxyableRowIdRegex = new RegExp(`(?:${dbRowIdRegex.source}|${proxyKeyRegex.source})`),
  // Pointer to a row in the DB, or a proxy to one
  //   captures:
  //      [1]: typename in snake_case
  //      [2]: row id as an integer string
  //      [3]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  proxyableRowRegex = new RegExp(`${typeNameRegex.source}__${proxyableRowIdRegex.source}`),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  //      [4]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  //      [5]: variant in snake_case
  proxyableViewRegex = new RegExp(`(${proxyableRowRegex.source})__${variantRegex.source}`);

// datapoints are never proxied

// API
module.exports = {
  // deconstructs a string id into its component parts or throws if not possible
  //  arguments object with one key of:
  //    rowId, proxyableRowId, viewId, proxyableViewId, datapointId
  decomposeId,
  ensureDecomposed,

  // reconstructs string ids from their component parts or throws if not possible
  recomposeId,

  // export the regexes as part of the public API
  typeNameRegex,
  dbRowIdRegex,
  variantRegex,
  fieldNameRegex,
  rowRegex,
  viewRegex,
  datapointRegex,
  proxyKeyRegex,
  proxyableRowIdRegex,
  proxyableRowRegex,
  proxyableViewRegex
};

// deconstructs a string id into its component parts or throws if not possible
//  arguments object with one key of:
//    rowId, proxyableRowId, viewId, proxyableViewId, datapointId
function decomposeId({ rowId, proxyableRowId, viewId, proxyableViewId, datapointId, relaxed }) {
  if (viewId) {
    if (relaxed && rowRegex.test(viewId)) {
      viewId += "__default";
    }
    return stringToView(viewId);
  }
  if (datapointId) return stringToDatapoint(datapointId);
  if (rowId) return stringToRow(rowId);
  if (proxyableViewId) {
    if (relaxed && proxyableRowRegex.test(proxyableViewId)) {
      proxyableViewId += "__default";
    }
    return stringToProxyableView(proxyableViewId);
  }
  if (proxyableRowId) return stringToProxyableRow(proxyableRowId);
  throw new Error("No id to decompose");
}

function ensureDecomposed({ typeName }) {
  return typeName === undefined ? decomposeId(arguments[0]) : arguments[0];
}

// reconstructs string ids from their component parts or throws if not possible
function recomposeId({ typeName, dbRowId, proxyKey, fieldName, variant }) {
  if (arguments.length != 1) {
    const combined = {};
    Array.prototype.forEach.call(arguments, argument => Object.assign(combined, argument));
    return recomposeId(combined);
  }

  if (!typeName) throw new Error("Can't recompose without typeName");

  const ret = {
    typeName: ChangeCase.snakeCase(typeName)
  };
  if (!typeNameRegex.test(ret.typeName)) throw new Error("Type name has invalid characters or format");

  if (variant) {
    ret.variant = ChangeCase.snakeCase(variant);
    if (!variantRegex.test(ret.variant)) throw new Error("Variant has invalid characters or format");
  }

  if (dbRowId) {
    if (!dbRowIdRegex.test(dbRowId)) throw new Error("Db row id has invalid characters or format");
    ret.dbRowId = +dbRowId;
    ret.rowId = ret.proxyableRowId = `${ret.typeName}__${ret.dbRowId}`;

    if (fieldName) {
      ret.fieldName = ChangeCase.snakeCase(fieldName);
      if (!fieldNameRegex.test(ret.fieldName)) throw new Error("Field name has invalid characters or format");

      ret.datapointId = `${ret.rowId}__#${ret.fieldName}`;
    }
    if (ret.variant) {
      ret.viewId = ret.proxyableViewId = `${ret.rowId}__${ret.variant}`;
    }
  } else if (proxyKey) {
    ret.proxyKey = proxyKey;
    if (!proxyKeyRegex.test(ret.proxyKey)) throw new Error("Proxy key has invalid characters or format");
    ret.proxyRowId = ret.proxyableRowId = `${ret.typeName}__${ret.proxyKey}`;

    if (ret.variant) {
      ret.proxyViewId = ret.proxyableViewId = `${ret.proxyRowId}__${ret.variant}`;
    }
  } else throw new Error("Must have either a dbRowId or a proxyKey");

  ret.typeName = ChangeCase.pascalCase(ret.typeName);
  if (ret.fieldName) ret.fieldName = ChangeCase.camelCase(ret.fieldName);
  if (ret.variant) ret.variant = ChangeCase.camelCase(ret.variant);

  return ret;
}

function stringToRow(rowId) {
  const match = rowRegex.exec(rowId);
  if (!match) throw new Error(`Bad row id ${rowId}`);

  return {
    rowId: rowId,
    proxyableRowId: rowId, // strictly, this row is proxyable too, and therefore has a proxyable id
    //  similar in methods below
    typeName: ChangeCase.pascalCase(match[1]),
    dbRowId: +match[2]
  };
}

function stringToView(viewId) {
  const match = viewRegex.exec(viewId);
  if (!match) {
    throw new Error(`Bad view id ${viewId}`);
  }

  return {
    viewId: viewId,
    proxyableViewId: viewId,
    rowId: match[1],
    proxyableRowId: match[1],

    typeName: ChangeCase.pascalCase(match[2]),
    dbRowId: +match[3],
    variant: ChangeCase.camelCase(match[4])
  };
}

function stringToDatapoint(datapointId) {
  const match = datapointRegex.exec(datapointId);
  if (!match) throw new Error(`Bad datapoint id ${datapointId}`);

  return {
    datapointId: datapointId,

    rowId: match[1],
    proxyableRowId: match[1],

    typeName: ChangeCase.pascalCase(match[2]),
    dbRowId: +match[3],
    fieldName: ChangeCase.camelCase(match[4])
  };
}

function stringToProxyableRow(rowId) {
  const match = proxyableRowRegex.exec(rowId);
  if (!match) throw new Error(`Bad row id ${rowId}`);

  return Object.assign(
    {
      proxyableRowId: rowId,
      typeName: ChangeCase.pascalCase(match[1])
    },
    match[2]
      ? {
          rowId: rowId,
          dbRowId: +match[2]
        }
      : {
          proxyRowId: rowId,
          proxyKey: match[3]
        }
  );
}

function stringToProxyableView(viewId) {
  const match = proxyableViewRegex.exec(viewId);
  if (!match) {
    throw new Error(`Bad view id ${viewId}`);
  }

  return Object.assign(
    {
      proxyableViewId: viewId,
      proxyableRowId: match[1],
      typeName: ChangeCase.pascalCase(match[2]),
      variant: ChangeCase.camelCase(match[5])
    },
    match[3]
      ? {
          viewId: viewId,
          rowId: match[1],
          dbRowId: +match[3]
        }
      : {
          proxyViewId: viewId,
          proxyRowId: match[1],
          proxyKey: match[4]
        }
  );
}
