// pg_connection
// © Will Smart 2018. Licence: MIT

// This is a tool to read and write values in a postgresql db tables, load and save layouts, and listen to db notifications
// The chief reason for creating this (instead of just grabbing a orm)
//   is that nobo uses triggers as a fundamental part of its work (see schema_to_postgresql.js)

const ChangeCase = require("change-case");
const {
  Pool,
  Client
} = require("pg");
const SchemaToPostgresql = require("../db/postgresql-schema");
const PostgresqlListener = require("../db/postgresql-listener");
const SchemaLayoutConnection = require("../db/schema-layout-connection");
const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");

// API is auto-generated at the bottom from the public interface of this class

class PostgresqlConnection {
  // public methods
  static publicMethods() {
    return [
      "getRowsFromDB",
      "getRowFields",
      "updateRowFields",
      "query",
      "newClient",
      "schemaLayoutConnection",
      "pgListener"
    ];
  }

  constructor({
    host,
    port,
    database,
    username,
    password,
    connectionString
  }) {
    this.connectionString = connectionString || PostgresqlConnection.connectionString(arguments[0]);
    this.pool = new Pool({
      connectionString: this.connectionString
    });
  }

  static connectionString({
    host,
    port,
    database,
    username,
    password
  }) {
    return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port ||
      5432}/${database}`;
  }

  newConnectedClient() {
    const client = new Client({
      connectionString: this.connectionString
    });
    client.connect();
    return client;
  }

  get dbListener() {
    return this._dbListener ?
      this._dbListener :
      (this._dbListener = new PostgresqlListener({
        connection: this
      }));
  }

  get schemaLayoutConnection() {
    return this._schemaLayoutConnection ?
      this._schemaLayoutConnection :
      (this._schemaLayoutConnection = new SchemaLayoutConnection({
        connection: this
      }));
  }

  async query(sql, argArray) {
    //console.log(sql);
    return this.pool.query(sql, argArray);
  }

  // methods to load rows and views

  /// Gets multiple rows from a given table with optional joins and table alias
  async getRowsFromDB({
    tableName,
    fields,
    dbRowId
  }) {
    const connection = this;

    const fieldNames = fields.map(fieldInfo => {
      return typeof fieldInfo == "string" ? fieldInfo : `${fieldInfo.sqlName} AS "${fieldInfo.outputKey}"`;
    });
    const joins = fields
      .filter(fieldInfo => {
        return typeof fieldInfo == "object" && fieldInfo.sqlJoin;
      })
      .map(fieldInfo => " " + fieldInfo.sqlJoin);

    const sql = `SELECT ${fieldNames.join(", ")} FROM "${tableName}" "${tableName}__base"${joins.join("")}${
      dbRowId === undefined ? "" : ` WHERE "${tableName}__base"."id" = ${dbRowId}`
    }`;

    return connection.query(sql).then(res => {
      return res.rows;
    });
  }

  async getRowFields({
    type,
    dbRowId,
    fields
  }) {
    const connection = this;

    const sqlTypeTable = ChangeCase.snakeCase(type.name);

    const fieldInfos = [];

    fields.forEach(field => {
      const fieldInfo = connection.processFieldInfo(type, dbRowId, field.name, field.name, sqlTypeTable);
      if (fieldInfo) fieldInfos.push(fieldInfo);
    });

    const promises = fieldInfos.filter(field => !field.sqlName);
    fields = fieldInfos.filter(field => field.sqlName);

    if (fields.length) {
      promises.push(
        connection
        .getRowsFromDB({
          tableName: sqlTypeTable,
          fields: fields,
          dbRowId
        })
        .then(models => {
          if (!models.length) return;
          const model = models[0];

          let ret = {};
          for (const i in fields) {
            const fieldInfo = fields[i];
            const value = model[fieldInfo.outputKey];
            if (value === undefined || value === null) continue;
            if (fieldInfo.sqlField.isId) {
              ret[fieldInfo.outputKey] = [
                ConvertIds.recomposeId({
                  typeName: fieldInfo.field.dataType.name,
                  dbRowId: value
                }).rowId
              ];
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

  async updateRowFields({
    type,
    dbRowId,
    fields
  }) {
    const connection = this;

    const sqlTypeTable = ChangeCase.snakeCase(type.name);

    const fieldInfos = [];

    fields.forEach(field => {
      const fieldInfo = PostgresqlConnection.processFieldInfoForSave(
        type,
        dbRowId,
        field.name,
        field.value,
        sqlTypeTable
      );
      if (fieldInfo) fieldInfos.push(fieldInfo);
    });

    if (!fieldInfos.length) return;
    return connection.updateRowInDB({
      tableName: sqlTypeTable,
      fields: fieldInfos,
      dbRowId
    });
  }

  /// Sets values in one row of a given table
  updateRowInDB({
    tableName,
    fields,
    dbRowId
  }) {
    const connection = this;

    if (!dbRowId) return;
    const fieldSettings = fields.map((fieldInfo, index) => {
      return `${fieldInfo.sqlName} = ${SchemaToPostgresql.sqlArgTemplateForValue(index, fieldInfo.dataTypeName)}`;
    });
    const fieldValues = fields.map(fieldInfo => {
      return fieldInfo.value;
    });

    const sql = `UPDATE "${tableName}" SET ${fieldSettings.join(", ")} WHERE "${tableName}"."id" = ${dbRowId}`;

    return connection.query(sql, fieldValues);
  }

  /// Takes the name and variant of a field, returns all the info required to SELECT it
  /// or a promise to get the field value if it refers to a multiple linkage
  processFieldInfo(type, dbRowId, fieldName, outputKey, sqlTypeTable) {
    const connection = this;

    const field = type.fields[fieldName];
    if (!field) return;
    const sqlField = SchemaToPostgresql.sqlFieldForField(field);

    if (!sqlField.isVirtual) {
      return {
        sqlName: `"${sqlTypeTable}__base"."${sqlField.sqlName}"`,
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
        }" = "${sqlTypeName}__base"."id"`,
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
            fields: [fieldInfo],
            dbRowId
          })
          .then(models => {
            if (!models) return;

            const values = models
              .map(model => {
                const value = model[outputKey];
                if (value === undefined || value === null) return;
                return ConvertIds.recomposeId({
                  typeName: linkedField.enclosingType.name,
                  dbRowId: value
                }).rowId;
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
  static processFieldInfoForSave(type, dbRowId, fieldName, newValue, sqlTypeTable) {
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
module.exports = PublicApi({
  fromClass: PostgresqlConnection,
  hasExposedBackDoor: true
});