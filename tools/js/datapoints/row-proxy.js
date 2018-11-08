const PublicApi = require('../general/public-api');
const ConvertIds = require('./convert-ids');

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const appDbRowId = 1;

class RowProxy {
  // public methods
  static publicMethods() {
    return ['chainPolicy', 'basePolicy', 'userIdPolicy', 'clientLocalDbRowIdPolicy', 'makeConcrete'];
  }

  constructor({ policy } = {}) {
    this.policy = RowProxy.basePolicy;
    if (policy) this.policy = RowProxy.chainPolicy(policy, this.policy);
  }

  static chainPolicy(a, b) {
    return {
      fromConcrete: function() {
        let ret = a.fromConcrete.apply(RowProxy, arguments);
        if (!ret) ret = b.fromConcrete.apply(RowProxy, arguments);
        return ret;
      },
      fromProxy: function() {
        let ret = a.fromProxy.apply(RowProxy, arguments);
        if (!ret) ret = b.fromProxy.apply(RowProxy, arguments);
        return ret;
      },
    };
  }

  static get basePolicy() {
    return {
      fromConcrete: () => undefined,
      fromProxy: ({ typeName, proxyKey }) => {
        if (typeName == 'App' && proxyKey == 'default') return { dbRowId: appDbRowId };
      },
    };
  }

  static userIdPolicy({ userId, cache, schema }) {
    return {
      fromConcrete: () => undefined,
      fromProxy: ({ typeName, proxyKey }) => {
        if (typeName == 'User' && proxyKey == 'default') {
          return userId ? { dbRowId: userId } : { typeName: 'App', dbRowId: appDbRowId };
        }
      },
    };
  }

  // semi-async
  static clientLocalDbRowIdPolicy({ data, dbConnection }) {
    const typeDBRowIds = (data.typeDBRowIds = {});
    function getLocalDbRowId({ typeName, proxyKey }) {
      if (typeDBRowIds[proxyKey]) return typeDBRowIds[proxyKey];

      return dbConnection.allocateDbRowId({ typeName }).then(dbRowId => (typeDBRowIds[proxyKey] = dbRowId));
    }

    return {
      fromConcrete: () => undefined,
      fromProxy: ({ typeName, proxyKey }) => {
        if (!dbConnection) return;
        if (/^l\d+$/.test(proxyKey)) {
          const dbRowId = getLocalDbRowId({ typeName, proxyKey });
          if (dbRowId.then) {
            return dbRowId.then(dbRowId => ({ typeName, dbRowId: dbRowId }));
          } else return { typeName, dbRowId: dbRowId };
        }
      },
    };
  }

  makeConcrete({ rowId, datapointId }) {
    let datapointInfo = ConvertIds.decomposeId({ rowId, datapointId });
    if (!datapointInfo) return;
    if (datapointInfo.dbRowId) {
      const infoFromPolicy = this.policy.fromConcrete(datapointInfo);
      if (!infoFromPolicy) return datapointInfo;
      else if (infoFromPolicy.then) return infoFromPolicy.then(dealWithInfoFromPolicy);
      else return dealWithInfoFromPolicy(infoFromPolicy);

      function dealWithInfoFromPolicy(infoFromPolicy) {
        return ConvertIds.recomposeId(
          Object.assign(
            { typeName: datapointInfo.typeName, dbRowId: datapointInfo.dbRowId, fieldName: datapointInfo.fieldName },
            infoFromPolicy || {}
          )
        );
      }
    } else {
      const infoFromPolicy = this.policy.fromProxy(datapointInfo);
      if (!infoFromPolicy) return;
      else if (infoFromPolicy.then) return infoFromPolicy.then(dealWithInfoFromPolicy);
      else return dealWithInfoFromPolicy(infoFromPolicy);

      function dealWithInfoFromPolicy(infoFromPolicy) {
        const info = Object.assign(
          { typeName: datapointInfo.typeName, fieldName: datapointInfo.fieldName },
          infoFromPolicy || {}
        );
        return info.dbRowId === undefined ? undefined : ConvertIds.recomposeId(info);
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: RowProxy,
  hasExposedBackDoor: true,
});
