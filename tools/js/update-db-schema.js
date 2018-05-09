// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const DbSchemaUpdater = require("./db-schema-updater");
const processArgs = require("./process-args");
const fs = require("fs");
const {
  promisify
} = require("util");
const writeFile_p = promisify(fs.writeFile);

(async function () {
  var args = processArgs();

  if (args.dryRun === undefined) args.dryRun = true;

  if (!args.quiet)
    console.log(`Convert a model layout to a db schema
  Available options: 
      dryRun (defaults to true), 
      retrigger : replace the triggers for all tables, 
      renew: drop and remake the database schema, 
      drop: drop all user supplied tables (reduces the db down to the base tables), 
      quiet
  args: ${JSON.stringify(args)}
  `);

  try {
    let updater = new DbSchemaUpdater({
      path: args.path
    });
    // note implicit optional flag arguments: dryRun, retrigger, renew, renewAll, drop, quiet
    let {
      sql
    } = await updater.performUpdate(args);

    if (args.sqlfile) {
      await writeFile_p(args.sqlfile, sql);
      console.log(`Saved sql to '${args.sqlfile}'`);
    }
  } catch (err) {
    console.log(`Failed to update schema:
${err.stack}
`);
  }
})();