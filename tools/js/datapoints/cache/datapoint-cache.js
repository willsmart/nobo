const requirePath = path => require(`../../${path}`);
const makeClassWatchable = requirePath('general/watchable');
const Datapoint = requirePath('datapoints/cache/datapoint-cache');

class Datapoint {
  static publicMethods() {
    return ['getExistingDatapoint', 'getOrCreateDatapoint', 'forgetDatapoint', 'unforgetDatapoint'];
  }

  constructor({ schema, datapointDbConnection, templates }) {
    const cache = this;

    Object.assign(cache, {
      _datapointDbConnection: datapointDbConnection,
      _schema: schema,
      _templates: templates,
      datapointsById: {},
      deletionLists: [undefined],
      deletionListByDatapointId: {},
      deletionDelaySeconds: 30,
    });
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

  getExistingDatapoint(datapointId) {
    return this.datapointsById[datapointId];
  }

  getOrCreateDatapoint(datapointId) {
    const cache = this,
      { datapointsById } = cache,
      existingDatapoint = datapointsById[datapointId];
    if (existingDatapoint) return existingDatapoint;

    const { schema, datapointDbConnection, templates } = cache;
    return (datapointsById[datapointId] = new Datapoint({
      cache,
      schema,
      datapointDbConnection,
      templates,
      datapointId,
    }));
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
      datapointsById[datapointId].clearDependencies();
      delete deletionListByDatapointId[datapointId];
      delete datapointsById[datapointId];
    }
    if (deletionLists.find(list => list)) {
      cache.deletionTickTimeout = setTimeout(() => cache.deletionTick(), 1000);
    }
  }
}

makeClassWatchable(Datapoint);

// API is the public facing class
module.exports = PublicApi({
  fromClass: Datapoint,
  hasExposedBackDoor: true, // note that the __private backdoor is used by this class, leave this as true
});
