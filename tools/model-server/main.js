const SchemaDefn = require("../common-js/schema");
const WebSocketServer = require("../common-js/web-socket-server");
const ModelCache = require("../common-js/model_cache");
const Templates = require("../common-js/templates");
const Connection = require("../common-js/pg_connection");

const Sleep = require("sleep");
const processArgs = require("../common-js/process_args");

(async function() {
  var args = processArgs();

  console.log("Load a model from the db");
  console.log("   args: " + JSON.stringify(args));

  try {
    const connection = new Connection({
      host: "127.0.0.1",
      database: "test2",
      username: "postgres",
      password: " 8rw4rhfw84y3fubweuf27..."
    });
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

    if (args.listen) {
      await connection.listenForViewChanges(cache);
    }

    if (args.wss) {
      const wsserver = new WebSocketServer({ cache });
      wsserver.start();
    }
  } catch (err) {
    console.log(err.stack);
    return;
  }
})();
