// datapoint-cache-module
// package for the datapoint-cache module shared between clien and server

// implied dependencies

//const Connection = require('./db/postgresql-connection'); // via make arg: connection
//   uses getRowFields and updateRowFields

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

  makeCache: ({ connection, schema = undefined, appDbRowId = 1 }) => {
    schema = schema || new this.Schema();
    const cache = new this.DatapointCache({ schema, connection, appDbRowId });
    const templates = cache.templates;
    return { schema, connection, templates, cache };
  },
};
