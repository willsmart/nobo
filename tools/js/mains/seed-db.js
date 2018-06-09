// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const DbSeeder = require('../db/db-seeder');
const processArgs = require('../general/process-args');
const fs = require('fs');
const { promisify } = require('util');
const writeFile_p = promisify(fs.writeFile);

(async function() {
  var args = processArgs();

  if (!args.quiet)
    console.log(`Insert or update the DB content using the seeds files
  Available options: 
      quiet
  args: ${JSON.stringify(args)}
  `);

  try {
    let seeder = new DbSeeder({
      path: args.path,
    });
    await seeder.insertSeeds();
  } catch (err) {
    console.log(`Failed to update schema:
${err.stack}.
`);
  }
})();
