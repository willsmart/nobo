// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const SchemaDefn = require("./schema");
const Connection = require("./postgresql-connection");
const SchemaToSQL = require("./postgresql-schema.js");
const processArgs = require("./process-args");
const strippedValues = require("./stripped-values");
const fs = require("fs");
const { promisify } = require("util");
const YAML = require("yamljs");

const readFile_p = promisify(fs.readFile);
const writeFile_p = promisify(fs.writeFile);
const readdir_p = promisify(fs.readdir);

(async function() {
  var args = processArgs();

  console.log("Convert a model layout to a db schema");
  console.log("   args: " + JSON.stringify(args));

  const layoutFileRegex = /\.(?:yaml|yml|YAML|YML|json)$/;
  const baseLayoutFileRegex = /(?:^|\/)base-layout\.(?:yaml|yml|YAML|YML|json)$/;
  const layoutDir = "db/layout";
  const connectionFilename = "db/connection.json";

  let connection;
  try {
    const connectionInfo = JSON.parse(await readFile_p(connectionFilename));
    connection = new Connection(connectionInfo);
  } catch (err) {
    console.log(`
    ${err}
    
    Please check that the connection info in the ${connectionFilename} file is correct
`);
    return;
  }

  var schema = new SchemaDefn();

  const layoutFiles = (await readdir_p(layoutDir))
    .filter(filename => layoutFileRegex.test(filename))
    .sort((a, b) => {
      if (baseLayoutFileRegex.test(a)) return -1;
      if (baseLayoutFileRegex.test(b)) return 1;

      return a < b ? -1 : a > b ? 1 : 0;
    })
    .map(filename => `${layoutDir}/${filename}`);

  layoutFiles.forEach(filename => {
    const isBase = baseLayoutFileRegex.test(filename);
    if (!isBase && args.drop) return;

    let layout;
    if (filename.endsWith(".json")) {
      layout = JSON.parse(fs.readFileSync(filename));
    } else {
      layout = YAML.load(filename);
    }
    schema.addLayout(layout);
  });

  //console.log("Tables:\n" + JSON.stringify(strippedValues(schema.allTypes), null, 2));

  let layoutWas = await connection.getCurrentLayoutFromDB({
    allowEmpty: true
  });
  let sql;
  if (!(layoutWas && Array.isArray(layoutWas.source))) layoutWas = undefined;

  if (layoutWas === undefined) {
    sql = SchemaToSQL.getCreationSql({
      schema: schema,
      retrigger: args.retrigger
    });
  } else {
    var wasSchema = new SchemaDefn();
    wasSchema.loadSource(layoutWas.source);
    //console.log("DB Tables:\n" + JSON.stringify(strippedValues(wasSchema.allTypes), null, 2));

    if (args.renew) {
      sql =
        SchemaToSQL.getDropSql({
          schema: wasSchema
        }) +
        SchemaToSQL.getCreationSql({
          schema: schema
        });
    } else {
      sql = SchemaToSQL.getDiffSql({
        schema: schema,
        fromSchema: wasSchema,
        retrigger: args.retrigger
      });
    }
  }

  if (args.sqlfile) {
    await writeFile_p(args.sqlfile, sql);
    console.log(`Saved sql to '${args.sqlfile}'`);
  }

  if (!sql) {
    console.log(`Database structure is already up to date. Nothing to do`);
  } else if (args["--save"]) {
    console.log(`Adjusting the DB schema to match the provided layout files...`);
    await connection.saveLayoutToDB({
      sql: sql,
      source: schema.source,
      version: "1"
    });
    console.log("All done!");
  } else {
    console.log(`SQL:
${sql}
    
This is a dry run, so I didn't actually save anything.

To run the listed SQL on the database, ensure the connection parameters in connection.json are correct, and provide the '--save' command line flag
`);
  }
})();
