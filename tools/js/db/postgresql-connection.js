// pg_connection
// © Will Smart 2018. Licence: MIT

// This is a tool to read and write values in a postgresql db tables, load and save layouts, and listen to db notifications
// The chief reason for creating this (instead of just grabbing a orm)
//   is that nobo uses triggers as a fundamental part of its work (see schema_to_postgresql.js)

const ChangeCase = require('change-case');
const { Pool, Client } = require('pg');
const SchemaToPostgresql = require('../db/postgresql-schema');
const PostgresqlListener = require('../db/postgresql-listener');
const SchemaLayoutConnection = require('../db/schema-layout-connection');
const PublicApi = require('../general/public-api');
const ConvertIds = require('../datapoints/convert-ids');
const log = require('../general/log');

// API is auto-generated at the bottom from the public interface of this class

let PostgresqlConnection_public;

class PostgresqlConnection {
  // public methods
  static publicMethods() {
    return [
      'getRowsFromDB',
      'getRowFields',
      'updateRowFields',
      'query',
      'newClient',
      'schemaLayoutConnection',
      'dbListener',
      'connect',
      'isSeeded',
    ];
  }

  static sanitizedDatabase(database) {
    return ChangeCase.snakeCase(database.replace(/[^\w_-\d]/g, ''));
  }

  constructor({ host, port, database, username, password, isSeeded = true }) {
    database = PostgresqlConnection.sanitizedDatabase(database);
    this.database = database;
    this._isSeeded = isSeeded;
    this.connectionString = PostgresqlConnection.connectionString(arguments[0]);
    this.pool = new Pool({
      connectionString: this.connectionString,
    });
  }

  get isSeeded() {
    return this._isSeeded;
  }

  static async connect({ host, port, database, username, password, canCreate }) {
    const baseConnection = new PostgresqlConnection({ host, port, database: 'postgres', username, password });
    const isSeeded = !(await baseConnection.createDatabaseIfRequired({ database }));
    return new PostgresqlConnection_public({ host, port, database, username, password, isSeeded });
  }

  static connectionString({ host, port, database, username, password }) {
    return `postgresql://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${host}:${port ||
      5432}/${database}`;
  }

  newConnectedClient() {
    const client = new Client({
      connectionString: this.connectionString,
    });
    client.connect();
    return client;
  }

  get dbListener() {
    return this._dbListener
      ? this._dbListener
      : (this._dbListener = new PostgresqlListener({
          connection: this,
        }));
  }

  get schemaLayoutConnection() {
    return this._schemaLayoutConnection
      ? this._schemaLayoutConnection
      : (this._schemaLayoutConnection = new SchemaLayoutConnection({
          connection: this,
        }));
  }

  async databaseExists({ database }) {
    database = PostgresqlConnection.sanitizedDatabase(database);
    const connection = this;

    const { rows } = await connection.query(
      'SELECT datname FROM pg_catalog.pg_database WHERE lower(datname) = lower($1::varchar);',
      [database]
    );

    return rows.length > 0;
  }

  async createDatabaseIfRequired({ database }) {
    database = PostgresqlConnection.sanitizedDatabase(database);
    const connection = this;

    if (await connection.databaseExists({ database })) return false;

    await connection.query(`CREATE DATABASE "${database}" WITH TEMPLATE = template0 ENCODING = 'UTF8'`);

    return true;
  }

  async query(sql, argArray) {
    //console.log(sql);
    return this.pool.query(sql, argArray).catch(err => {
      console.log(`Failed query ${sql}\nStack: ${err.stack}`);
      throw err;
    });
  }

  // methods to load rows and views

  /// Gets multiple rows from a given table with optional joins and table alias
  async getRowsFromDB({ tableName, fields, dbRowId }) {
    const connection = this;

    const fieldNames = fields.map(fieldInfo => {
      return typeof fieldInfo == 'string' ? fieldInfo : `${fieldInfo.sqlName} AS "${fieldInfo.outputKey}"`;
    });
    const joins = fields
      .filter(fieldInfo => {
        return typeof fieldInfo == 'object' && fieldInfo.sqlJoin;
      })
      .map(fieldInfo => ' ' + fieldInfo.sqlJoin);

    const sql = `SELECT ${fieldNames.join(', ')} FROM "${tableName}" "${tableName}__base"${joins.join('')}${
      dbRowId === undefined ? '' : ` WHERE "${tableName}__base"."id" = ${dbRowId}`
    }`;

    return connection.query(sql).then(res => {
      return res.rows;
    });
  }

  async getRowFields({ type, dbRowId, fields }) {
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
            dbRowId,
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
                    dbRowId: value,
                  }).rowId,
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

  async updateRowFields({ type, dbRowId, fields }) {
    const connection = this;

    const sqlTypeTable = ChangeCase.snakeCase(type.name);

    const fieldInfos = [];
    let isDelete = false;

    fields.forEach(field => {
      if (field.name == '*' && field.value == null) {
        isDelete = true;
        return;
      }
      const fieldInfo = PostgresqlConnection.processFieldInfoForSave(
        type,
        dbRowId,
        field.name,
        field.value,
        sqlTypeTable
      );
      if (fieldInfo) fieldInfos.push(fieldInfo);
    });

    if (isDelete) {
      return connection.deleteRowInDB({
        tableName: sqlTypeTable,
        dbRowId,
      });
    }

    if (!fieldInfos.length) return;
    return connection.updateRowInDB({
      tableName: sqlTypeTable,
      fields: fieldInfos,
      dbRowId,
    });
  }

  /// Sets values in one row of a given table
  updateRowInDB({ tableName, fields, dbRowId }) {
    const connection = this;

    if (!dbRowId) return;
    const fieldSettings = fields.map((fieldInfo, index) => {
      return `${fieldInfo.sqlName} = ${SchemaToPostgresql.sqlArgTemplateForValue(index, fieldInfo.dataTypeName)}`;
    });
    const fieldValues = fields.map(fieldInfo => {
      return fieldInfo.value;
    });

    const sql = `UPDATE "${tableName}" SET ${fieldSettings.join(', ')} WHERE "${tableName}"."id" = ${dbRowId}`;

    return connection.query(sql, fieldValues);
  }

  /// Deletes one row of a given table
  deleteRowInDB({ tableName, dbRowId }) {
    const connection = this;

    if (!dbRowId) return;

    const sql = `DELETE FROM "${tableName}" WHERE "${tableName}"."id" = ${dbRowId}`;

    return connection.query(sql);
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
        sqlField: sqlField,
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
        }" = "${sqlTypeTable}__base"."id"`,
        outputKey: outputKey,
        field: field,
        sqlField: sqlField,
      };

      if (!field.isMultiple) {
        return fieldInfo;
      } else {
        const fieldInfos = [fieldInfo];
        let sorter;
        if (field.sort) {
          if (field.sort.names['a'] && field.sort.names['b']) {
            const fieldsByName = {};
            for (const argName of ['a', 'b']) {
              const names = Object.keys(field.sort.names[argName]);
              for (const sortFieldName of names) {
                if (fieldsByName[sortFieldName]) continue;

                const field = type.fields[sortFieldName];
                if (!field || field.isId || field.isVirtual) continue;
                const sqlField = SchemaToPostgresql.sqlFieldForField(field);

                const fieldInfo = {
                  sqlName: `"${sqlLinkedFieldAlias}"."${sqlField.sqlName}"`,
                  outputKey: `__sort__${sortFieldName}`,
                };

                fieldsByName[sortFieldName] = fieldInfo;
              }
            }
            fieldInfos.push(...Object.values(fieldsByName));

            const valueGivenModels = (a, b) => {
              return field.sort.evaluate({
                valueForNameCallback: (...names) => {
                  if (names.length != 2) return;
                  if (names[0] == 'a') return a[`__sort__${names[1]}`];
                  if (names[0] == 'b') return b[`__sort__${names[1]}`];
                  return;
                },
              });
            };

            sorter = (a, b) => {
              return valueGivenModels(a, b);
            };
          } else {
            const names = Object.keys(field.sort.names);
            for (const sortFieldName of names) {
              const field = type.fields[sortFieldName];
              if (!field || field.isId || field.isVirtual) continue;
              const sqlField = SchemaToPostgresql.sqlFieldForField(field);

              const fieldInfo = {
                sqlName: `"${sqlLinkedFieldAlias}"."${sqlField.sqlName}"`,
                outputKey: `__sort__${sortFieldName}`,
              };

              fieldInfos.push(fieldInfo);
            }

            const valueGivenModel = model => {
              return field.sort.evaluate({
                valueForNameCallback: (...names) => {
                  if (names.length != 1) return;
                  return model[`__sort__${names[0]}`];
                },
              });
            };

            sorter = (a, b) => {
              const val_a = valueGivenModel(a),
                val_b = valueGivenModel(b);
              return val_a < val_b ? -1 : val_a > val_b ? 1 : 0;
            };
          }
        } else {
          sorter = (a, b) => {
            return a[outputKey] - b[outputKey];
          };
        }

        return connection
          .getRowsFromDB({
            tableName: sqlTypeTable,
            fields: fieldInfos,
            dbRowId,
          })
          .then(models => {
            if (!models) return;

            const values = models
              .sort(sorter)
              .map(model => {
                const value = model[outputKey];
                if (value === undefined || value === null) return;
                return ConvertIds.recomposeId({
                  typeName: linkedField.enclosingType.name,
                  dbRowId: value,
                }).rowId;
              })
              .filter(value => value !== undefined);

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
        sqlField: sqlField,
      };
    } else {
      console.log("Can't save linked field values yet");
      return;
    }
  }
}

// API is the public facing class
module.exports = PostgresqlConnection_public = PublicApi({
  fromClass: PostgresqlConnection,
  hasExposedBackDoor: true,
});
