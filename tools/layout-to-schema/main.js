const SchemaDefn = require("../js/schema");
const Connection = require("../js/pg_connection");
const SchemaToSQL = require("../js/schema_to_postgresql.js");
const processArgs = require("../js/process_args");
const strippedValues = require("../js/stripped_values");
const addYamlFileToSchema = require("../js/add_yaml_file_to_schema");

var args = processArgs();

console.log("Convert a model layout to a db schema");
console.log("   args: " + JSON.stringify(args));

const connection = new Connection({
  host: "127.0.0.1",
  database: "test2",
  username: "postgres",
  password: " 8rw4rhfw84y3fubweuf27..."
});

var schema = new SchemaDefn();
addYamlFileToSchema({ filename: "base-layout.yaml", schema });

if (!args.drop) {
  let args = processArgs();
  for (var index = 1; ; index++) {
    let layoutKey = "layoutfile" + (index == 1 ? "" : index);
    if (args[layoutKey]) {
      addYamlFileToSchema({ filename: args[layoutKey], schema });
    } else break;
  }
}

console.log("Tables:\n" + JSON.stringify(strippedValues(schema.allTypes), null, 2));

connection
  .getCurrentLayoutFromDB({ allowEmpty: true })
  .then(res => {
    let sql;
    if (!(res && Array.isArray(res.source))) res = undefined;

    if (res === undefined) {
      sql = SchemaToSQL.getCreationSql({ schema: schema, retrigger: args.retrigger });
    } else {
      var wasSchema = new SchemaDefn();
      wasSchema.loadSource(res.source);
      console.log("DB Tables:\n" + JSON.stringify(strippedValues(wasSchema.allTypes), null, 2));

      if (args.renew) {
        sql = SchemaToSQL.getDropSql({ schema: wasSchema }) + SchemaToSQL.getCreationSql({ schema: schema });
      } else {
        sql = SchemaToSQL.getDiffSql({ schema: schema, fromSchema: wasSchema, retrigger: args.retrigger });
      }
    }

    const fs = require("fs");
    const sqlFilename = "schema.sql";
    fs.writeFile(sqlFilename, sql, function(err) {
      if (err) {
        return console.log(err);
      } else {
        console.log("Saved sql to " + sqlFilename);
      }
    });

    if (args.save) {
      connection.saveLayoutToDB({
        sql: sql,
        source: schema.source,
        version: "1"
      });
    } else {
      console.log("SQL:\n" + sql);
    }
  })
  .catch(err => {
    console.log(err);
  });
