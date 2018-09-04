// datapoint-cache
// © Will Smart 2018. Licence: MIT

// This is the central datapoint cache used by nobo
// Datapoints can be marked as 'invalid' via invalidateDatapoint (i.e. need to be reloaded from the db)
//   This should be called in response to a signal from the db
// They can also be marked as updated via updateDatapointValue (i.e. a new valud should be written to the db)

const PublicApi = require('./general/public-api');
const makeClassWatchable = require('./general/watchable');
const StateVar = require('./general/state-var');
const RowChangeTrackers = require('./row-change-trackers');

const Datapoint = require('./datapoint');
const Templates = require('./templates');

// other implied dependencies

//const Schema = require('./schema'); // via constructor arg: schema
//   uses allTypes and fieldForDatapoint

//const DbDatapointConnection = require('./db/db-datapoint-connection'); // via constructor arg: datapointConnection
//   uses validateDatapoionts and commitDatapoints

class NullDatapointConnection {
  constructor({ cache }) {
    this.cache = cache;
  }

  validateDatapoints({ datapoints }) {
    datapoints.forEach(datapoint => {
      datapoint.validate({ value: datapoint.valueIfAny });
    });
  }

  commitDatapoints({ datapoints }) {
    datapoints.forEach(datapoint => {
      if (datapoint.__private.updated) {
        datapoint.commit({ updateIndex: datapoint.__private.updateIndex, keepNewValue: true });
      }
    });
  }
}
// API is auto-generated at the bottom from the public interface of this class
class DatapointCache {
  // public methods
  static publicMethods() {
    return [
      'getExistingDatapoint',
      'getOrCreateDatapoint',
      'validateNewlyInvalidDatapoints',
      'validateAll',
      'queueValidationJob',
      'commitNewlyUpdatedDatapoints',

      'datapoints',
      'templates',
      'stateVar',
      'rowChangeTrackers',

      'isClient',

      'watch',
      'stopWatching',
    ];
  }

  constructor({ schema, htmlToElement, datapointConnection, appDbRowId = 1, isClient = false }) {
    const cache = this;

    cache._isClient = isClient;
    cache.schema = schema;
    cache.datapointConnection = datapointConnection || new NullDatapointConnection({ cache });
    cache.datapointsById = {};
    cache.newlyInvalidDatapointIds = [];
    cache.newlyUpdatedDatapointIds = [];
    cache.newlyValidDatapoints = [];
    cache._stateVar = new StateVar({ cache });
    cache._rowChangeTrackers = new RowChangeTrackers({ cache });

    if (!isClient) {
      cache._templates = new Templates({ cache, htmlToElement, appDbRowId });
    }
  }

  get rowChangeTrackers() {
    return this._rowChangeTrackers;
  }

  get stateVar() {
    return this._stateVar;
  }

  get isClient() {
    return this._isClient;
  }

  get datapoints() {
    return Object.values(this.datapointsById);
  }

  get templates() {
    return this._templates;
  }

  forgetDatapoint({ datapointId }) {
    const cache = this;

    delete cache.datapointsById[datapointId];
  }

  queueValidationJob({ delay = 1 } = {}) {
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

  async validateAll() {
    while (true) {
      if (!(await this.validateNewlyInvalidDatapoints()).length) break;
    }
  }

  validateNewlyInvalidDatapoints() {
    const cache = this;

    if (cache._validateTimeout) {
      clearTimeout(cache._validateTimeout);
      delete cache._validateTimeout;
    }

    const datapoints = cache.newlyInvalidDatapointIds
      .map(datapointId => cache.datapointsById[datapointId])
      .filter(datapoint => datapoint);

    cache.newlyInvalidDatapointIds = [];

    let promise =
      cache.datapointConnection.validateDatapoints({ datapoints }) ||
      Promise.all(
        datapoints
          .map(datapoint => {
            datapoint = datapoint.__private;
            if (datapoint.invalid)
              return new Promise(resolve => {
                if (!datapoint.invalid) resolve();
                else {
                  datapoint.watchingOneShotResolvers = datapoint.watchingOneShotResolvers || [];
                  datapoint.watchingOneShotResolvers.push(resolve);
                }
              });
          })
          .filter(promise => promise)
      );

    return promise.then(() => {
      const newlyValidDatapoints = cache.newlyValidDatapoints;
      cache.newlyValidDatapoints = [];
      cache.notifyListeners('onvalid', {
        newlyValidDatapoints,
      });
      return newlyValidDatapoints;
    });
  }

  queueUpdateJob({ delay = 10 } = {}) {
    const cache = this;

    if (delay <= 0) {
      cache.commitNewlyUpdatedDatapoints();
      return;
    }

    if (cache._updateTimeout) return;
    cache._updateTimeout = setTimeout(() => {
      delete cache._updateTimeout;
      cache.commitNewlyUpdatedDatapoints();
    }, delay);
  }

  async updateAll() {
    while (true) {
      if (!(await this.commitNewlyUpdatedDatapoints()).length) break;
    }
  }

  commitNewlyUpdatedDatapoints({ returnWait = true } = {}) {
    const cache = this;

    if (cache._updateTimeout) {
      clearTimeout(cache._updateTimeout);
      delete cache._updateTimeout;
    }

    const datapoints = cache.newlyUpdatedDatapointIds
      .map(datapointId => cache.datapointsById[datapointId])
      .filter(datapoint => datapoint);

    cache.newlyUpdatedDatapointIds = [];

    let promise = cache.datapointConnection.commitDatapoints({ datapoints });

    if (returnWait && !promise) {
      promise = Promise.all(
        datapoints
          .map(datapoint => {
            datapoint = datapoint.__private;
            if (datapoint.updated)
              return new Promise(resolve => {
                if (!datapoint.updated) resolve();
                else {
                  datapoint.watchingCommitOneShotResolvers = datapoint.watchingCommitOneShotResolvers || [];
                  datapoint.watchingCommitOneShotResolvers.push(resolve);
                }
              });
          })
          .filter(promise => promise)
      );
    }
    return promise;
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
      isClient: cache.isClient,
      schema: cache.schema,
      templates: cache.templates,
      datapointId,
    }));
  }
}

makeClassWatchable(DatapointCache);

// API is the public facing class
module.exports = PublicApi({
  fromClass: DatapointCache,
  hasExposedBackDoor: true,
});
