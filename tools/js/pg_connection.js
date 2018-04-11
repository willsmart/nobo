// pg_connection
// © Will Smart 2018. Licence: MIT

// This is a tool to read and write values in a postgresql db tables, load and save layouts, and listen to db notifications
// The chief reason for creating this (instead of just grabbing a orm)
//   is that noco uses triggers as a fundamental part of its work (see schema_to_postgresql.js)

const ChangeCase = require("change-case");
const { Pool, Client } = require("pg");
const SchemaToPostgresql = require("./schema_to_postgresql");
const PublicApi = require("./public_api");
const ConvertIds = require("./convert_ids");

// API is auto-generated at the bottom from the public interface of this class

class PostgresqlConnection {
  // public methods
  static publicMethods() {
    return [
      "getCurrentLayoutFromDB",
      "saveLayoutToDB",
      "getRowFromDB",
      "getRowsFromDB",
      "listenForViewChanges",
      "startDBChangeNotificationPrompter",
      "getViewFields",
      "updateViewFields",
      "connectionString"
    ];
  }

  constructor({ host, port, database, username, password, connectionString }) {
    this.connectionString = connectionString || PostgresqlConnection.connectionString(arguments[0]);
    this.pool = new Pool({
      connectionString: this.connectionString
    });
  }

  static connectionString({ host, port, database, username, password }) {
    return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port ||
      5432}/${database}`;
  }

  // Public methods

  /// Methods to load and save schema layouts

  /// the DB stores its layout information in the schema_history table
  /// This call gets that information (as the source layout json) if any

  async getCurrentLayoutFromDB({ allowEmpty } = {}) {
    try {
      const res = await this.query(
        "SELECT model_layout, layout_to_schema_version FROM schema_history ORDER BY at DESC LIMIT 1"
      );

      if (res.rows.length == 0) {
        console.log("DB currently has no model layout, will create anew");
        return;
      }

      return {
        source: JSON.parse(res.rows[0].model_layout),
        converterVersion: res.rows[0].layout_to_schema_version
      };
    } catch (err) {
      if (!allowEmpty) throw err;
      return;
    }
  }

  /// Stores a layout source into the schema_history table
  async saveLayoutToDB({ sql, source, version }) {
    const connection = this;

    source = JSON.stringify(source, null, 2);
    console.log("Saving layout:\n" + source);

    console.log("Running SQL:\n" + sql);
    return connection
      .query("BEGIN;\n" + sql)
      .then((err, res) => {
        return connection.query(
          "INSERT INTO schema_history(model_layout, layout_to_schema_version, at) VALUES ($1::text, $2::character varying, now());",
          [source, version]
        );
      })
      .then((err, res) => {
        return connection.query("END;");
      });
  }

  // methods to load rows and views

  /// Gets a single row from a given table
  async getRowFromDB({ tableName, tableAlias, fields, id }) {
    return this.getRowsFromDB(arguments[0]).then(rows => rows[0]);
  }

  /// Gets multiple rows from a given table with optional joins and table alias
  async getRowsFromDB({ tableName, tableAlias, fields, id }) {
    const connection = this;

    if (!tableAlias) tableAlias = tableName;
    const fieldNames = fields.map(fieldInfo => {
      return typeof fieldInfo == "string" ? fieldInfo : `${fieldInfo.sqlName} AS "${fieldInfo.outputKey}"`;
    });
    const joins = fields
      .filter(fieldInfo => {
        return typeof fieldInfo == "object" && fieldInfo.sqlJoin;
      })
      .map(fieldInfo => " " + fieldInfo.sqlJoin);

    const sql = `SELECT ${fieldNames.join(", ")} FROM "${tableName}" "${tableAlias}"${joins.join("")}${
      id === undefined ? "" : ` WHERE "${tableAlias}"."id" = ${id}`
    }`;

    return connection.query(sql).then(res => {
      return res.rows;
    });
  }

  async listenForViewChanges({ cache }) {
    return this.listenToDB({
      channel: "modelchanges",
      callbackKey: "modelchanges",
      callback: changes => {
        changes = JSON.parse(changes);
        if (Array.isArray(changes)) {
          changes.forEach(datapointId => {
            cache.invalidateDatapoint({ datapointId: datapointId });
          });
          cache.validateNewlyInvalidDatapoints(); //TODO
        }
      }
    });
  }

  async startDBChangeNotificationPrompter({ cache, delay = 500 }) {
    const connection = this;

    await connection.listenToDB({
      channel: "modelchanges",
      callbackKey: "dbcnp",
      callback: changes => {
        if (connection.dbcnpTimeout === undefined) return;
        clearTimeout(tconnectionhis.dbcnpTimeout);
      }
    });
    await connection.listenToDB({
      channel: "prompterscript",
      callbackKey: "dbcnp",
      callback: changes => {
        if (connection.dbcnpTimeout !== undefined) return;
        connection.dbcnpTimeout = setTimeout(() => {
          delete connection.dbcnpTimeout;
          console.log("Telling the db to notify others of the outstanding change");
          connection.query("UPDATE model_change_notify_request SET model_change_id = 0 WHERE name = 'modelchanges';");
        }, delay);
      }
    });
  }

  async getViewFields({ type, id, fields }) {
    const connection = this;

    const sqlTypeTable = ChangeCase.snakeCase(type.name);
    const sqlTypeAlias = `${sqlTypeTable}__base`;

    const fieldInfos = [];

    fields.forEach(field => {
      const fieldInfo = connection.processFieldInfo(type, id, field.name, field.name, sqlTypeTable, sqlTypeAlias);
      if (fieldInfo) fieldInfos.push(fieldInfo);
    });

    const promises = fieldInfos.filter(field => !field.sqlName);
    fields = fieldInfos.filter(field => field.sqlName);

    if (fields.length) {
      promises.push(
        connection
          .getRowFromDB({
            tableName: sqlTypeTable,
            tableAlias: sqlTypeAlias,
            fields: fields,
            id: id
          })
          .then(model => {
            if (!model) return;

            let ret = {};
            for (const i in fields) {
              const fieldInfo = fields[i];
              const value = model[fieldInfo.outputKey];
              if (value === undefined || value === null) continue;
              if (fieldInfo.sqlField.isId) {
                ret[fieldInfo.outputKey] = ConvertIds.recomposeId({
                  typeName: fieldInfo.field.dataType.name,
                  dbRowId: value
                }).rowId;
              } else {
                ret[fieldInfo.outputKey] = value;
              }
            }
            return ret;
          })
      );
    }
    return Promise.all(promises).then(fragments => {
      const ret = {};
      fragments.forEach(fragment => {
        if (!fragment) return;
        Object.keys(fragment).forEach(fieldName => {
          ret[fieldName] = fragment[fieldName];
        });
      });
      return ret;
    });
  }

  async updateViewFields({ type, id, fields }) {
    const connection = this;

    const sqlTypeTable = ChangeCase.snakeCase(type.name);

    const fieldInfos = [];

    fields.forEach(field => {
      const fieldInfo = PostgresqlConnection.processFieldInfoForSave(type, id, field.name, field.value, sqlTypeTable);
      if (fieldInfo) fieldInfos.push(fieldInfo);
    });

    if (!fieldInfos.length) return;
    return connection.updateRowInDB({
      tableName: sqlTypeTable,
      fields: fieldInfos,
      id: id
    });
  }

  // private methods

  async query(sql, argArray) {
    //console.log(sql);
    return this.pool.query(sql, argArray);
  }

  /// Sets values in one row of a given table
  updateRowInDB({ tableName, fields, id }) {
    const connection = this;

    if (!id) return;
    const fieldSettings = fields.map((fieldInfo, index) => {
      return `${fieldInfo.sqlName} = ${SchemaToPostgresql.sqlArgTemplateForValue(index, fieldInfo.dataTypeName)}`;
    });
    const fieldValues = fields.map(fieldInfo => {
      return fieldInfo.value;
    });

    const sql = `UPDATE "${tableName}" SET ${fieldSettings.join(", ")} WHERE "${tableName}"."id" = ${id}`;

    return connection.query(sql, fieldValues);
  }

  async listenToDB({ channel, callback, callbackKey }) {
    const connection = this;

    if (!channel) throw new Error("Please supply a channel");

    if (!connection.listeningClient) {
      connection.listeningChannels = {};

      connection.listeningClient = new Client({
        connectionString: this.connectionString
      });
      connection.listeningClient.connect();
      connection.listeningClient.on("notification", msg => {
        console.log(`Received message from db on ${msg.channel}: "${msg.payload}"`);
        const callbacks = connection.listeningChannels[msg.channel];
        if (callbacks)
          Object.keys(callbacks).forEach(key => {
            callbacks[key](msg.payload);
          });
      });
    }

    if (!connection.listeningChannels[channel]) {
      const sql = `LISTEN ${channel};`;
      console.log(sql);
      await connection.listeningClient.query(sql);
      connection.listeningChannels[channel] = {};
    }

    if (typeof callback == "function") {
      connection.listeningChannels[channel][callbackKey || "default"] = callback;
    }
  }

  /// Takes the name and variant of a field, returns all the info required to SELECT it
  /// or a promise to get the field value if it refers to a multiple linkage
  processFieldInfo(type, id, fieldName, outputKey, sqlTypeTable, sqlTypeAlias) {
    const connection = this;

    const field = type.fields[fieldName];
    if (!field) return;
    const sqlField = SchemaToPostgresql.sqlFieldForField(field);

    if (!sqlField.isVirtual) {
      return {
        sqlName: `"${sqlTypeAlias}"."${sqlField.sqlName}"`,
        outputKey: outputKey,
        field: field,
        sqlField: sqlField
      };
    } else {
      const linkedField = field.getLinkedToField();
      if (!linkedField) return;
      const sqlLinkedField = SchemaToPostgresql.sqlFieldForField(linkedField);
      if (sqlLinkedField.isVirtual) return;

      const sqlLinkedTypeTable = ChangeCase.snakeCase(linkedField.enclosingType.name);
      const sqlLinkedFieldAlias = `${sqlLinkedTypeTable}__for__${sqlField.sqlName}`;
      const fieldInfo = {
        sqlName: `"${sqlLinkedFieldAlias}"."id"`,
        sqlJoin: `LEFT OUTER JOIN "${sqlLinkedTypeTable}" "${sqlLinkedFieldAlias}" ON "${sqlLinkedFieldAlias}"."${
          sqlLinkedField.sqlName
        }" = "${sqlTypeAlias}"."id"`,
        outputKey: outputKey,
        field: field,
        sqlField: sqlField
      };

      if (!field.isMultiple) {
        return fieldInfo;
      } else {
        return connection
          .getRowsFromDB({
            tableName: sqlTypeTable,
            tableAlias: sqlTypeAlias,
            fields: [fieldInfo],
            id: id
          })
          .then(models => {
            if (!models) return;

            const values = models
              .map(model => {
                const value = model[outputKey];
                if (value === undefined || value === null) return;
                return ConvertIds.recomposeId({ typeName: linkedField.enclosingType.name, dbRowId: value }).rowId;
              })
              .filter(value => value !== undefined);

            if (!values.length) return;
            let ret = {};
            ret[outputKey] = values;
            return ret;
          });
      }
    }
  }

  /// Takes the name and variant of a field, returns all the info required to SELECT it
  /// or a promise to get the field value if it refers to a multiple linkage
  static processFieldInfoForSave(type, id, fieldName, newValue, sqlTypeTable) {
    const field = type.fields[fieldName];
    if (!field) return;
    const sqlField = SchemaToPostgresql.sqlFieldForField(field);

    if (!sqlField.isVirtual) {
      return {
        sqlName: `"${sqlField.sqlName}"`,
        dataTypeName: field.dataType.name,
        value: newValue,
        field: field,
        sqlField: sqlField
      };
    } else {
      console.log("Can't save linked field values yet");
      return;
    }
  }
}

// API is the public facing class
module.exports = PublicApi({ fromClass: PostgresqlConnection, hasExposedBackDoor: true });
