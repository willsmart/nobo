const makeClassWatchable = require('../../general/watchable');
const PublicApi = require('../../general/public-api');

class DatapointDbConnection {
  static publicMethods() {
    return ['schema', 'dbConnection', 'queueGet', 'queueGetExists', 'queueSet', 'queueSetExists'];
  }

  constructor({ schema, dbConnection }) {
    const connection = this;

    Object.assign(connection, {
      _schema: schema,
      _dbConnection: dbConnection,
      queuedGets: {},
      queuedSets: {},
      getDelay: 10,
      setDelay: 10,
    });
  }

  get schema() {
    return this._schema;
  }

  get dbConnection() {
    return this._dbConnection;
  }

  queueGetExists({ typeName, dbRowId, resolve }) {
    return this.queueGet({
      field: { enclosingType: { name: typeName }, name: 'id' },
      dbRowId,
      resolve: resolve
        ? value => {
            resolve(Boolean(value));
          }
        : undefined,
    });
  }

  queueSetExists({ typeName, dbRowId, newValue, resolve }) {
    return this.queueSet({
      field: { enclosingType: { name: typeName }, name: '*' },
      dbRowId,
      newValue,
      resolve: resolve
        ? value => {
            resolve(Boolean(value));
          }
        : undefined,
    });
  }

  queueGet({ field, dbRowId, resolve }) {
    const connection = this,
      { queuedGets } = connection,
      forType = queuedGets[field.enclosingType.name] || (queuedGets[field.enclosingType.name] = {}),
      forRow = forType[dbRowId] || (forType[dbRowId] = {}),
      resolves = forRow[field.name] || (forRow[field.name] = []);
    if (resolve) resolves.push(resolve);

    connection.queueGetJob();
  }

  queueSet({ field, dbRowId, newValue, resolve }) {
    const connection = this,
      { queuedSets } = connection,
      forType = queuedSets[field.enclosingType.name] || (queuedSets[field.enclosingType.name] = {}),
      forRow = forType[dbRowId] || (forType[dbRowId] = {}),
      forCell = forRow[field.name] || (forRow[field.name] = { resolves: [], newValue });
    if (resolve) forCell.resolves.push(resolve);
    forCell.newValue = newValue;

    connection.queueSetJob();
  }

  queueGetJob() {
    const connection = this,
      { getDelay } = connection;
    if (connection._getJobTimeout) return;
    connection._getJobTimeout = setTimeout(() => {
      connection.goGetJob();
    }, getDelay);
  }

  queueSetJob() {
    const connection = this,
      { setDelay } = connection;
    if (connection._setJobTimeout) return;
    connection._setJobTimeout = setTimeout(() => {
      connection.goSetJob();
    }, setDelay);
  }

  goGetJob() {
    const connection = this,
      { dbConnection, schema } = connection;

    if (connection._getJobTimeout) {
      clearTimeout(connection._getJobTimeout);
    }

    const queuedGets = connection.queuedGets,
      promises = [];
    connection.queuedGets = {};

    for (const [typeName, forType] of Object.entries(queuedGets)) {
      const type = schema.allTypes[typeName];
      for (let [dbRowId, forRow] of Object.entries(forType)) {
        dbRowId = Number(dbRowId);
        promises.push(
          dbConnection
            .getRowFields({
              type,
              dbRowId,
              fields: Object.keys(forRow).map(fieldName => ({ name: fieldName })),
            })
            .then(row => {
              for (const [fieldName, resolves] of Object.entries(forRow)) {
                const value = row ? row[fieldName] : undefined;
                for (const resolve of resolves) resolve(value);
              }
            })
        );
      }
    }

    Promise.all(promises)
      .then(restartJob)
      .catch(restartJob);

    function restartJob() {
      connection._getJobTimeout = undefined;
      if (Object.keys(connection.queuedGets).length) {
        connection.queueGetJob();
      }
    }
  }

  goSetJob() {
    const connection = this,
      { dbConnection, schema } = connection;

    if (connection._setJobTimeout) {
      clearTimeout(connection._setJobTimeout);
    }

    const queuedSets = connection.queuedSets,
      promises = [];
    connection.queuedSets = {};

    for (const [typeName, forType] of Object.entries(queuedSets)) {
      const type = schema.allTypes[typeName];
      for (let [dbRowId, forRow] of Object.entries(forType)) {
        dbRowId = Number(dbRowId);
        promises.push(
          dbConnection
            .updateRowFields({
              type,
              dbRowId,
              fields: Object.entries(forRow).map(([fieldName, { newValue }]) => ({ name: fieldName, value: newValue })),
            })
            .then(({ rowCount }) => {
              for (const { newValue, resolves } of Object.values(forRow)) {
                for (const resolve of resolves) resolve(newValue);
              }
            })
        );
      }
    }

    Promise.all(promises)
      .then(restartJob)
      .catch(restartJob);

    function restartJob() {
      connection._setJobTimeout = undefined;
      if (Object.keys(connection.queuedSets).length) {
        connection.queueSetJob();
      }
    }
  }
}

makeClassWatchable(DatapointDbConnection);

// API is the public facing class
module.exports = PublicApi({
  fromClass: DatapointDbConnection,
  hasExposedBackDoor: true, // note that the __private backdoor is used by this class, leave this as true
});
