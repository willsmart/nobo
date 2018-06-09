// db-schema-updater
// © Will Smart 2018. Licence: MIT

const PublicApi = require('../general/public-api');
const SchemaDefn = require('../schema');
const Connection = require('../db/postgresql-connection');
const SchemaToSQL = require('../db/postgresql-schema.js');
const fs = require('fs');
const { promisify } = require('util');
const YAML = require('yamljs');
const DbSeeder = require('./db-seeder');

const readFile_p = promisify(fs.readFile);
const writeFile_p = promisify(fs.writeFile);
const readdir_p = promisify(fs.readdir);

const layoutFileRegex = /\.(?:yaml|yml|YAML|YML|json)$/;
const baseLayoutFileRegex = /(?:^|\/)base-layout\.(?:yaml|yml|YAML|YML|json)$/;

// API is auto-generated at the bottom from the public interface of this class

class DbSchemaUpdater {
  // public methods
  static publicMethods() {
    return ['performUpdate', 'schema', 'baseSchema', 'connection'];
  }

  constructor({ connection = undefined, path = 'db', verbose } = {}) {
    this.verbose = verbose;
    this.path = path;
    this._connection = connection;
    this.connectionFilename = fs.realpathSync(`${path}/connection.json`);
    if (fs.existsSync(`${path}/layout`)) {
      this.layoutDir = fs.realpathSync(`${path}/layout`);
    }
    if (fs.existsSync('db/layout')) {
      this.rootLayoutDir = fs.realpathSync(`db/layout`);
    }
  }

  async connection({ canCreate } = {}) {
    const updater = this;

    if (updater._connection) return updater._connection;

    const connectionInfo = JSON.parse(fs.readFileSync(updater.connectionFilename));
    connectionInfo.canCreate = canCreate;
    updater._connection = await Connection.connect(connectionInfo);
    return updater._connection;
  }

  get layoutFiles() {
    const updater = this;

    let layoutFiles;
    if (updater.rootLayoutDir == updater.layoutDir) {
      return fs
        .readdirSync(updater.layoutDir)
        .filter(filename => layoutFileRegex.test(filename))
        .map(filename => `${updater.layoutDir}/${filename}`);
    } else {
      let baseFiles = fs
        .readdirSync(updater.layoutDir)
        .filter(filename => layoutFileRegex.test(filename) && baseLayoutFileRegex.test(filename))
        .map(filename => `${updater.layoutDir}/${filename}`);
      if (!baseFiles.length) {
        baseFiles = fs
          .readdirSync(updater.rootLayoutDir)
          .filter(filename => layoutFileRegex.test(filename) && baseLayoutFileRegex.test(filename))
          .map(filename => `${updater.rootLayoutDir}/${filename}`);
      }
      return baseFiles.concat(
        fs
          .readdirSync(updater.layoutDir)
          .filter(filename => layoutFileRegex.test(filename) && !baseLayoutFileRegex.test(filename))
          .map(filename => `${updater.layoutDir}/${filename}`)
      );
    }
  }

  get schema() {
    return this._schema || (this._schema = this.getSchema());
  }

  get baseSchema() {
    return (
      this._baseSchema ||
      (this._baseSchema = this.getSchema({
        onlyBase: true,
      }))
    );
  }

  getSchema({ onlyBase } = {}) {
    const updater = this;

    const schema = new SchemaDefn();

    for (const filename of updater.layoutFiles) {
      const isBase = baseLayoutFileRegex.test(filename);
      if (!isBase && onlyBase) break;

      let layout;
      if (filename.endsWith('.json')) {
        layout = JSON.parse(fs.readFileSync(filename));
      } else {
        layout = YAML.load(filename);
      }
      schema.addLayout(layout);
    }

    return schema;
  }

  async sqlForUpdate({ drop, renew, renewAll, retrigger, canCreate = true } = {}) {
    const updater = this;

    const schema = drop ? updater.baseSchema : updater.schema,
      connection = await updater.connection({ canCreate }),
      schemaWas = await connection.schemaLayoutConnection.currentSchema;

    let sql;
    if (!schemaWas) {
      sql = SchemaToSQL.getCreationSql({
        schema: schema,
        retrigger: retrigger,
      });
    } else if (renewAll) {
      sql =
        SchemaToSQL.getDropSql({
          schema: schemaWas,
        }) +
        SchemaToSQL.getCreationSql({
          schema: schema,
        });
    } else if (renew) {
      sql =
        SchemaToSQL.getDiffSql({
          schema: updater.baseSchema,
          fromSchema: schemaWas,
          retrigger: retrigger,
        }) +
        SchemaToSQL.getDiffSql({
          schema: schema,
          fromSchema: updater.baseSchema,
          retrigger: retrigger,
        });
    } else {
      sql = SchemaToSQL.getDiffSql({
        schema: schema,
        fromSchema: schemaWas,
        retrigger: retrigger,
      });
    }

    return {
      sql,
      schema,
    };
  }

  async performUpdate({ dryRun, canCreate = true, canSeed = true } = {}) {
    const updater = this;

    const { sql, schema } = await updater.sqlForUpdate(arguments[0]),
      connection = await updater.connection({ canCreate });

    if (!sql) {
      if (updater.verbose)
        console.log(
          `Database structure is already up to date. Nothing to do. (I'll still update the DB layout info which may have changed)`
        );
      if (!dryRun) {
        await connection.schemaLayoutConnection.saveLayout({
          source: schema.source,
          version: '1',
          quiet: !updater.verbose,
        });
      }
    } else if (!dryRun) {
      if (updater.verbose) console.log(`Adjusting the DB schema to match the provided layout files...`);
      await connection.schemaLayoutConnection.saveLayout({
        sql: sql,
        source: schema.source,
        version: '1',
        quiet: !updater.verbose,
      });
      if (updater.verbose) console.log('All done!');
    } else if (updater.verbose) {
      console.log(`SQL:
    ${sql}
        
    This is a dry run, so I didn't actually save anything.

    To run the listed SQL on the database, ensure the connection parameters in connection.json are correct, and provide the '--save' command line flag
    `);
    }

    if (canSeed && !dryRun && !connection.isSeeded) {
      if (updater.verbose) {
        console.log(`Seeding the database seeing as it's new`);
      }
      let seeder = new DbSeeder({
        path: updater.path,
      });
      await seeder.insertSeeds();
    }
    return {
      sql,
      schema,
    };
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DbSchemaUpdater,
  hasExposedBackDoor: true,
});
