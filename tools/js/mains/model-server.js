// model_server
// © Will Smart 2018. Licence: MIT

const SchemaDefn = require("../schema");
const WebSocketServer = require("../web-socket-server");
const DatapointCache = require("../datapoint-cache");
const Templates = require("../templates");
const Connection = require("../db/postgresql-connection");
const fs = require("fs");
const processArgs = require("../general/process-args");

(async function() {
  var args = processArgs();

  console.log("Load a model from the db");
  console.log("   args: " + JSON.stringify(args));

  const connectionFilename = "db/connection.json";

  let connection;
  try {
    const connectionInfo = JSON.parse(fs.readFileSync(connectionFilename, "utf8"));
    connection = new Connection(connectionInfo);
  } catch (err) {
    console.log(`
    ${err}
    
    Please check that the connection info in the ${connectionFilename} file is correct
`);
    return;
  }

  const schema = await connection.schemaLayoutConnection.currentSchema;

  const cache = new DatapointCache({
    schema,
    connection
  });

  await connection.dbListener.listenForDatapointChanges({
    cache
  });
  console.log("Listening for DB model changes");

  if (args["--prompter"]) {
    await connection.dbListener.startDBChangeNotificationPrompter({
      cache
    });
    console.log("Listening and responding as the DB change notification prompter");
  } else {
    console.log(
      "This server hasn't been started as the DB change notification prompter (there must be, but can only be one). To start as the DBCNP use the '--prompter' command line flag"
    );
  }
  const wsserver = new WebSocketServer({
    cache
  });
  await wsserver.start();
})();
