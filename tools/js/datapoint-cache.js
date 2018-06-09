// datapoint-cache
// © Will Smart 2018. Licence: MIT

// This is the central datapoint cache used by nobo
// Datapoints can be marked as 'invalid' via invalidateDatapoint (i.e. need to be reloaded from the db)
//   This should be called in response to a signal from the db
// They can also be marked as updated via updateDatapointValue (i.e. a new valud should be written to the db)

const PublicApi = require('./general/public-api');
const makeClassWatchable = require('./general/watchable');

const Datapoint = require('./datapoint');
const Templates = require('./templates');

// other implied dependencies

//const Schema = require('./schema'); // via constructor arg: schema
//   uses allTypes and fieldForDatapoint

//const Connection = require('./db/postgresql-connection'); // via constructor arg: connection
//   uses getRowFields and updateRowFields

// API is auto-generated at the bottom from the public interface of this class
class DatapointCache {
  // public methods
  static publicMethods() {
    return [
      'getExistingDatapoint',
      'getOrCreateDatapoint',
      'validateNewlyInvalidDatapoints',
      'queueValidationJob',
      'commitNewlyUpdatedDatapoints',

      'templates',

      'watch',
      'stopWatching',
    ];
  }

  constructor({ schema, connection, appDbRowId = 1 }) {
    const cache = this;

    cache.schema = schema;
    cache.connection = connection;
    cache._templates = new Templates({ cache, appDbRowId });
    cache.datapointsById = {};
    cache.newlyInvalidDatapointIds = [];
    cache.newlyUpdatedDatapointIds = [];
    cache.newlyValidDatapoints = [];
  }

  get templates() {
    return this._templates;
  }

  forgetDatapoint({ datapointId }) {
    const cache = this;

    delete cache.datapointsById[datapointId];
  }

  queueValidationJob({ delay = 100 } = {}) {
    const cache = this;

    if (delay <= 0) {
      cache.validateNewlyInvalidDatapoints();
      return;
    }

    if (cache._validateTimeout) return;
    cache._validateTimeout = setTimeout(() => {
      delete cache._validateTimeout;
      cache.validateNewlyInvalidDatapoints();
    }, delay);
  }

  validateNewlyInvalidDatapoints({ delay } = {}) {
    const cache = this;

    if (cache._validateTimeout) {
      clearTimeout(cache._validateTimeout);
      delete cache._validateTimeout;
    }

    if (delay > 0) {
      delay = delay === true ? 100 : +delay;

      if (cache._validateTimeout) return;
      cache._validateTimeout = setTimeout(() => {
        delete cache._validateTimeout;
        cache.validateNewlyInvalidDatapoints();
      }, delay);
    }

    if (cache._validateTimeout) {
      clearTimeout(cache._validateTimeout);
      delete cache._validateTimeout;
    }

    const datapoints = cache.newlyInvalidDatapointIds
      .map(datapointId => cache.datapointsById[datapointId])
      .filter(datapoint => datapoint);

    cache.newlyInvalidDatapointIds = [];

    return cache.validateDatapoints(datapoints);
  }

  commitNewlyUpdatedDatapoints() {
    const cache = this;

    const datapoints = cache.newlyUpdatedDatapointIds
      .map(datapointId => cache.datapointsById[datapointId])
      .filter(datapoint => datapoint);

    cache.newlyUpdatedDatapointIds = [];

    return cache.commitDatapoints(datapoints);
  }

  getExistingDatapoint({ datapointId }) {
    return this.datapointsById[datapointId];
  }

  getOrCreateDatapoint({ datapointId }) {
    const cache = this;

    let datapoint = cache.datapointsById[datapointId];
    if (datapoint) return datapoint;

    return (cache.datapointsById[datapointId] = new Datapoint({
      cache,
      schema: cache.schema,
      templates: cache.templates,
      datapointId,
    }));
  }

  validateDatapoints(datapoints) {
    const cache = this;

    if (!datapoints.length) return;

    const schema = cache.schema;
    const connection = cache.connection;

    const fieldsByRowByType = {};
    datapoints.forEach(datapoint => {
      if (!datapoint.invalid) return;
      const field = datapoint.fieldIfAny;
      if (!field || field.get) {
        if (!datapoint.invalidDependencyDatapointCount) {
          datapoint.validate();
        }
        return;
      }

      const fieldsByRow = fieldsByRowByType[datapoint.typeName] || (fieldsByRowByType[datapoint.typeName] = {});
      const fields = fieldsByRow[datapoint.dbRowId] || (fieldsByRow[datapoint.dbRowId] = []);
      fields.push(field);
    });

    const promises = [];
    Object.keys(fieldsByRowByType).forEach(typeName => {
      const type = schema.allTypes[typeName];
      const fieldsByRow = fieldsByRowByType[typeName];

      Object.keys(fieldsByRow).forEach(dbRowId => {
        const fields = fieldsByRow[dbRowId];

        promises.push(
          connection
            .getRowFields({
              type,
              dbRowId,
              fields,
            })
            .then(row => {
              fields.forEach(field => {
                const datapoint = cache.getExistingDatapoint({
                  datapointId: field.getDatapointId({
                    dbRowId,
                  }),
                });
                if (datapoint)
                  datapoint.validate({
                    value: row[field.name],
                  });
              });
            })
        );
      });
    });

    return Promise.all(promises).then(() => {
      const newlyValidDatapoints = cache.newlyValidDatapoints;
      cache.newlyValidDatapoints = [];
      cache.notifyListeners('onvalid', {
        newlyValidDatapoints,
      });
    });
  }

  commitDatapoints(datapoints) {
    if (!datapoints.length) return;

    const cache = this;
    const schema = cache.schema;
    const connection = cache.connection;

    const fieldsByRowByType = {};
    datapoints.forEach(datapoint => {
      if (!datapoint.updated) return;

      let field;
      try {
        field = schema.fieldForDatapoint(datapoint);
      } catch (err) {
        console.log(err);

        delete datapoint.updated;
        delete datapoint.newValue;
        return;
      }

      const fieldsByRow = fieldsByRowByType[datapoint.typeName] || (fieldsByRowByType[datapoint.typeName] = {});
      const fields = fieldsByRow[datapoint.dbRowId] || (fieldsByRow[datapoint.dbRowId] = []);
      fields.push({
        name: field.name,
        value: datapoint.newValue,
        field: field,
        datapointId: datapoint.datapointId,
      });
    });

    const promises = [];
    Object.keys(fieldsByRowByType).forEach(typeName => {
      const type = schema.allTypes[typeName];
      const fieldsByRow = fieldsByRowByType[typeName];
      Object.keys(fieldsByRow).forEach(dbRowId => {
        const fieldInfos = fieldsByRow[dbRowId];

        promises.push(
          connection
            .updateRowFields({
              type: type,
              dbRowId,
              fields: fieldInfos,
            })
            .then(() => {
              fieldInfos.forEach(fieldInfo => {
                const datapoint = cache.datapointsById[fieldInfo.datapointId];
                delete datapoint.updated;
                delete datapoint.newValue;
              });
            })
        );
      });
    });

    return Promise.all(promises);
  }
}

makeClassWatchable(DatapointCache);

// API is the public facing class
module.exports = PublicApi({
  fromClass: DatapointCache,
  hasExposedBackDoor: true,
});
