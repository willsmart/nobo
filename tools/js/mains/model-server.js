// model_server
// © Will Smart 2018. Licence: MIT

const fs = require('fs');
const processArgs = require('../general/process-args');

const WebSocketServer = require('../web-socket-server');
const Connection = require('../db/postgresql-connection');
const DbDatapointConnection = require('../db/db-datapoint-connection');
const DatapointCache = require('../datapoint-cache');

(async function() {
  var args = processArgs();

  console.log('Load a model from the db');
  console.log('   args: ' + JSON.stringify(args));

  const connectionFilename = 'db/connection.json';

  let connection;
  try {
    const connectionInfo = JSON.parse(fs.readFileSync(connectionFilename, 'utf8'));
    connection = new Connection(connectionInfo);
  } catch (err) {
    console.log(`
    ${err}
    
    Please check that the connection info in the ${connectionFilename} file is correct
`);
    return;
  }

  const schema = await connection.schemaLayoutConnection.currentSchema,
    datapointConnection = new DbDatapointConnection({ schema, connection }),
    cache = new DatapointCache({ schema, datapointConnection });

  await connection.dbListener.listenForDatapointChanges({
    cache,
  });
  console.log('Listening for DB model changes');

  if (args['--prompter']) {
    await connection.dbListener.startDBChangeNotificationPrompter({
      cache,
    });
    console.log('Listening and responding as the DB change notification prompter');
  } else {
    console.log(
      "This server hasn't been started as the DB change notification prompter (there must be, but can only be one). To start as the DBCNP use the '--prompter' command line flag"
    );
  }
  const wsserver = new WebSocketServer({
    cache,
  });
  await wsserver.start();
})();
