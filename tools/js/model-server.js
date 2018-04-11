// model-server/main
// © Will Smart 2018. Licence: MIT

const SchemaDefn = require("../common-js/schema");
const WebSocketServer = require("../common-js/web-socket-server");
const ModelCache = require("../common-js/model_cache");
const Templates = require("../common-js/templates");
const Connection = require("../common-js/pg_connection");
const fs = require("fs");
const processArgs = require("../common-js/process_args");

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

  const schema = new SchemaDefn();
  const cache = new ModelCache({
    schema: schema,
    connection: connection
  });

  const layout = await connection.getCurrentLayoutFromDB();
  if (!layout && layout.source) throw new Error("No layout");

  schema.clear();
  schema.loadSource(layout.source);

  const templates = new Templates();
  await templates.load({ cache });

  if (args.model) {
    const model = await cache.getLatestViewVersion({ proxyableViewId: args.model });
    console.log("Model: " + JSON.stringify(model));
  }

  await connection.listenForViewChanges({ cache });
  console.log("Listening for DB model changes");

  if (args["--prompter"]) {
    await connection.startDBChangeNotificationPrompter({ cache });
    console.log("Listening and responding as the DB change notification prompter");
  } else {
    console.log(
      "This server hasn't been started as the DB change notification prompter (there must be, but can only be one). To start as the DBCNP use the '--prompter' command line flag"
    );
  }
  const wsserver = new WebSocketServer({ cache });
  wsserver.start();
})();
