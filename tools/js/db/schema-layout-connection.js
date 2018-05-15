// schema-layout-connection
// © Will Smart 2018. Licence: MIT

// TODO describe

const PostgresqlConnection = require("../db/postgresql-connection");
const PublicApi = require("../general/public-api");
const SchemaDefn = require("../schema");

// API is auto-generated at the bottom from the public interface of this class

class SchemaLayoutConnection {
  // public methods
  static publicMethods() {
    return [
      "connection",

      "currentLayout",
      "currentConverterVersion",
      "currentSchema",
      "currentLayoutAndConverterVersion",
      "saveLayout"
    ];
  }

  constructor({
    connection,
    verbose
  }) {
    Object.assign(this, {
      _connection: connection,
      verbose
    });
  }

  get connection() {
    return this._connection;
  }

  get currentLayout() {
    return this.currentLayoutAndConverterVersion.then(tuple => tuple.source);
  }

  get currentConverterVersion() {
    return this.currentLayoutAndConverterVersion.then(tuple => tuple.converterVersion);
  }

  get currentSchema() {
    return this.async_currentSchema();
  }
  async async_currentSchema() {
    const slConnection = this;

    if (slConnection._currentSchema) return slConnection._currentSchema;

    const source = await slConnection.currentLayout;
    if (!source) return;

    slConnection._currentSchema = new SchemaDefn();
    slConnection._currentSchema.loadSource(source);

    return slConnection._currentSchema;
  }

  /// Methods to load and save schema layouts

  /// the DB stores its layout information in the schema_history table
  /// This call gets that information (as the source layout json) if any
  get currentLayoutAndConverterVersion() {
    return this.async_currentLayoutAndConverterVersion();
  }
  async async_currentLayoutAndConverterVersion({
    allowEmpty
  } = {}) {
    const slConnection = this,
      connection = slConnection.connection;

    if (slConnection._currentLayoutAndVersion) return slConnection._currentLayoutAndVersion;

    try {
      const res = await connection.query(
        "SELECT model_layout, layout_to_schema_version FROM schema_history ORDER BY at DESC LIMIT 1"
      );

      if (!res.rows.length) {
        if (slConnection.verbose) console.log("DB currently has no model layout");
        return (slConnection._currentLayoutAndVersion = {});
      }

      const {
        model_layout,
        layout_to_schema_version
      } = res.rows[0];

      return (slConnection._currentLayoutAndVersion = {
        source: JSON.parse(model_layout),
        converterVersion: layout_to_schema_version
      });
    } catch (err) {
      if (slConnection.verbose) console.log("DB currently has no model layout");
      return (slConnection._currentLayoutAndVersion = {});
    }
  }

  /// Stores a layout source into the schema_history table
  async saveLayout({
    sql,
    source,
    version
  }) {
    const slConnection = this,
      connection = slConnection.connection,
      verbose = slConnection.verbose;

    source = JSON.stringify(source, null, 2);

    if (sql) {
      if (verbose) console.log("Running SQL:\n" + sql);
      return connection
        .query("BEGIN;\n" + sql)
        .then((err, res) => {
          return connection.query(
            "INSERT INTO schema_history(model_layout, layout_to_schema_version, at) VALUES ($1::text, $2::character varying, now());", [source, version]
          );
        })
        .then((err, res) => {
          return connection.query("END;");
        });
    } else {
      const {
        source: sourceWas,
        converterVersion: versionWas
      } = await slConnection.currentLayoutAndConverterVersion;
      if (sourceWas == source && version == versionWas) {
        if (verbose) console.log("Layout is unchanged");
      } else {
        if (verbose) console.log("Saving layout:\n" + source);
        return connection.query(
          "INSERT INTO schema_history(model_layout, layout_to_schema_version, at) VALUES ($1::text, $2::character varying, now());", [source, version]
        );
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: SchemaLayoutConnection,
  hasExposedBackDoor: true
});