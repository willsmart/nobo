const makeClassWatchable = require('../../general/watchable');
const Datapoint = require('../../datapoints/datapoint/datapoint');
const PublicApi = require('../../general/public-api');
const StateVar = require('../../general/state-var');
const RowChangeTrackers = require('../../datapoints/row-change-trackers');
const Templates = require('../../datapoints/templates');

class DatapointCache {
  static publicMethods() {
    return [
      'templates',
      'schema',
      'isClient',
      'datapointDbConnection',
      'getExistingDatapoint',
      'getOrCreateDatapoint',
      'forgetDatapoint',
      'unforgetDatapoint',
      'datapoints',
      'uninitedDatapoints',

      'watch',
      'stopWatching',
    ];
  }

  constructor({ schema, htmlToElement, datapointDbConnection, appDbRowId = 1, isClient = false }) {
    const cache = this;

    Object.assign(cache, {
      _datapointDbConnection: datapointDbConnection,
      _schema: schema,
      datapointsById: {},
      deletionLists: [undefined],
      deletionListByDatapointId: {},
      deletionDelaySeconds: 30,
      _stateVar: new StateVar({ cache }),
      _rowChangeTrackers: new RowChangeTrackers({ cache }),
      _isClient: isClient,
    });

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

  get datapointDbConnection() {
    return this._datapointDbConnection;
  }

  get schema() {
    return this._schema;
  }

  get templates() {
    return this._templates;
  }

  get datapoints() {
    return Object.values(this.datapointsById);
  }

  get uninitedDatapoints() {
    const ret = {};
    for (const [datapointId, datapoint] of Object.entries(this.datapointsById)) {
      if (!datapoint.initialized) {
        ret[datapointId] = datapoint;
      }
    }
    return ret;
  }

  getExistingDatapoint(datapointId) {
    return this.datapointsById[datapointId];
  }

  getOrCreateDatapoint(datapointId) {
    const cache = this,
      { datapointsById } = cache,
      existingDatapoint = datapointsById[datapointId];
    if (existingDatapoint) return existingDatapoint;

    const { schema, datapointDbConnection, templates, stateVar } = cache;
    const datapoint = (datapointsById[datapointId] = new Datapoint({
      cache,
      schema,
      datapointDbConnection,
      templates,
      stateVar,
      datapointId,
    }));
    cache.notifyListeners('oncreate', datapoint);
    return datapoint;
  }

  forgetDatapoint(datapointId) {
    const cache = this,
      { deletionLists, deletionListByDatapointId } = cache;
    if (deletionListByDatapointId[datapointId]) return;
    const currentList = deletionLists[0] || (deletionLists[0] = {});
    currentList[datapointId] = true;
    deletionListByDatapointId[datapointId] = currentList;

    if (cache.deletionTickTimeout) return;
    cache.deletionTickTimeout = setTimeout(() => cache.deletionTick(), 1000);
  }

  unforgetDatapoint(datapointId) {
    const cache = this,
      { deletionListByDatapointId } = cache;
    if (!deletionListByDatapointId[datapointId]) return;
    delete deletionListByDatapointId[datapointId][datapointId];
    delete deletionListByDatapointId[datapointId];
  }

  deletionTick() {
    const cache = this,
      { deletionLists, deletionListByDatapointId, deletionDelaySeconds, datapointsById } = cache;
    deletionLists.unshift(undefined);

    if (deletionLists.length <= deletionDelaySeconds) return;

    const deletionList = deletionLists.pop();
    if (!deletionList) return;
    for (const datapointId of Object.keys(deletionList)) {
      datapointsById[datapointId].ondeletion();
      delete deletionListByDatapointId[datapointId];
      delete datapointsById[datapointId];
    }
    if (deletionLists.find(list => list)) {
      cache.deletionTickTimeout = setTimeout(() => cache.deletionTick(), 1000);
    }
  }
}

makeClassWatchable(DatapointCache);

// API is the public facing class
module.exports = PublicApi({
  fromClass: DatapointCache,
  hasExposedBackDoor: true, // note that the __private backdoor is used by this class, leave this as true
});
