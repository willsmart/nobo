// datapoint-cache-module
// package for the datapoint-cache module shared between clien and server

// implied dependencies

//const DbDatapointConnection = require('./db/db-datapoint-connection'); // via make arg: datapointConnection
//   uses validateDatapoionts and commitDatapoints

module.exports = {
  ChangeCase: require('change-case'),
  vm: require('vm'), // CodeSnippet
  jsep: require('jsep'), // CodeSnippet

  clone: require('./general/clone'),
  PublicApi: require('./general/public-api'),
  mapValues: require('./general/map-values'),
  strippedValues: require('./general/stripped-values'),
  makeClassWatchable: require('./general/watchable'),
  CodeSnippet: require('./general/code-snippet'),

  ConvertIds: require('./convert-ids'),
  Datapoint: require('./datapoint'),
  DatapointCache: require('./datapoint-cache'),
  Templates: require('./templates'),
  Schema: require('./schema'),

  makeCache: ({ datapointConnection, schema = undefined, appDbRowId = 1 }) => {
    schema = schema || new this.Schema();
    const cache = new this.DatapointCache({ schema, datapointConnection, appDbRowId });
    const templates = cache.templates;
    return { schema, datapointConnection, templates, cache };
  },
};
