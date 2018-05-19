// convert_ids
// © Will Smart 2018. Licence: MIT

// This module allows string ids to be converted to and from the various data pointer types used by nobo
// The types include:
//
//  rowId : a pointer to a particular row in a db table.
//          Made up of a snake_case table name and the id value for the row joined by double underscores
//          eg. user__1
//
//  datapointId : a pointer to a particular field value in a db table.
//          Made up of a rowId and a snake_case field name, joined by double underscores
//          eg. user__1__name
//          Note that link values are also seen as datapoints.
//          So user__1__posts could well be an array of rowId's for posts
//
// PROXIES
//  proxyRowId : a proxy pointer to a particular row in a db table as understood by a particular client.
//          Made up of a snake_case table name and a snake_case proxy key joined by double underscores
//          eg. user__me
//          In the case of user__me, the proxy key 'me' could be mapped to the current user's id
//          If logged out, user__me could be made to redirect to some other row, like app__default
//
// GENERAL
//  proxyableRowId : all rowId's and proxyRowId's are proxyableRowId's
//          This allows code to deal with both cases generally if need be
//

const typeNameRegex = /([a-z0-9]+(?:_[a-z0-9]+)*)/,
  dbRowIdRegex = /([1-9][0-9]*)/,
  fieldNameRegex = /([a-z0-9]+(?:_[a-z0-9]+)*)/,
  // Pointer to a row in the DB
  //   captures:
  //      [1]: typename in snake_case
  //      [2]: row id as an integer string
  rowRegex = new RegExp(`^${typeNameRegex.source}__${dbRowIdRegex.source}$`),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  datapointRegex = new RegExp(`^(${typeNameRegex.source}__${dbRowIdRegex.source})__~?${fieldNameRegex.source}$`),
  // at some levels the system uses 'proxy' and 'proxyable' row ids
  // eg, when retrieving a model like 'user__me' the 'me' is a proxy row id
  proxyKeyRegex = /([a-z][a-z0-9]*(?:_[a-z0-9]+)*)/,
  proxyableRowIdRegex = new RegExp(`(?:${dbRowIdRegex.source}|${proxyKeyRegex.source})`),
  // Pointer to a row in the DB, or a proxy to one
  //   captures:
  //      [1]: typename in snake_case
  //      [2]: row id as an integer string
  //      [3]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  proxyableRowRegex = new RegExp(`^${typeNameRegex.source}__${proxyableRowIdRegex.source}$`);
// Pointer to a particular expression of a row in the db
//   captures:
//      [1]: the row string
//      [2]: typename in snake_case
//      [3]: row id as an integer string
//      [4]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")

// datapoints are never proxied

// API
module.exports = {
  // deconstructs a string id into its component parts or throws if not possible
  // arguments object with one key of:
  //   rowId, proxyableRowId, datapointId
  decomposeId,

  // similar, but will return the supplied argument unchanged if it already has typeName defined
  ensureDecomposed,

  // reconstructs string ids from their component parts or throws if not possible
  recomposeId,

  // export the regexes as part of the public API
  typeNameRegex,
  dbRowIdRegex,
  fieldNameRegex,
  rowRegex,
  datapointRegex,
  proxyKeyRegex,
  proxyableRowIdRegex,
  proxyableRowRegex
};

const ChangeCase = require("change-case");

// deconstructs a string id into its component parts or throws if not possible
//  arguments object with one key of:
//    rowId, proxyableRowId, datapointId
function decomposeId({
  rowId,
  proxyableRowId,
  datapointId,
  relaxed
}) {
  if (datapointId) return stringToDatapoint(datapointId);
  if (rowId) return stringToRow(rowId);
  if (proxyableRowId) return stringToProxyableRow(proxyableRowId);
  throw new Error("No id to decompose");
}

function ensureDecomposed({
  typeName
}) {
  return typeName === undefined ? decomposeId(arguments[0]) : arguments[0];
}

// reconstructs string ids from their component parts or throws if not possible
// you can provide more than one argument, in which case they are combined with the last taking precidence
function recomposeId({
  typeName,
  dbRowId,
  proxyKey,
  fieldName
}) {
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

  if (dbRowId) {
    if (!dbRowIdRegex.test(dbRowId)) throw new Error("Db row id has invalid characters or format");
    ret.dbRowId = +dbRowId;
    ret.rowId = ret.proxyableRowId = `${ret.typeName}__${ret.dbRowId}`;

    if (fieldName) {
      ret.fieldName = ChangeCase.snakeCase(fieldName);
      if (!fieldNameRegex.test(ret.fieldName)) throw new Error("Field name has invalid characters or format");

      ret.datapointId = `${ret.rowId}__${ret.fieldName}`;
    }
  } else if (proxyKey) {
    ret.proxyKey = proxyKey;
    if (!proxyKeyRegex.test(ret.proxyKey)) throw new Error("Proxy key has invalid characters or format");
    ret.proxyRowId = ret.proxyableRowId = `${ret.typeName}__${ret.proxyKey}`;
  } else throw new Error("Must have either a dbRowId or a proxyKey");

  ret.typeName = ChangeCase.pascalCase(ret.typeName);
  if (ret.fieldName) ret.fieldName = ChangeCase.camelCase(ret.fieldName);

  return ret;
}

// Helper methods for applying the regexes

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

  return Object.assign({
      proxyableRowId: rowId,
      typeName: ChangeCase.pascalCase(match[1])
    },
    match[2] ? {
      rowId: rowId,
      dbRowId: +match[2]
    } : {
      proxyRowId: rowId,
      proxyKey: match[3]
    }
  );
}