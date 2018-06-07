// db-seeder
// © Will Smart 2018. Licence: MIT

const ChangeCase = require("change-case");
const PublicApi = require("../general/public-api");
const SchemaDefn = require("../schema");
const Connection = require("../db/postgresql-connection");
const SchemaToSQL = require("../db/postgresql-schema.js");
const fs = require("fs");
const YAML = require("yamljs");

const seedsFileRegex = /\.(?:yaml|yml|YAML|YML|json)$/;

// API is auto-generated at the bottom from the public interface of this class

class DbSeeder {
  // public methods
  static publicMethods() {
    return ["insertSeeds", "seeds", "connection", "seedFiles", "seeds", "seedRows"];
  }

  constructor({ connection = undefined, path = "db", verbose } = {}) {
    this.verbose = verbose;
    this._connection = connection;
    this.connectionFilename = fs.realpathSync(`${path}/connection.json`);
    if (fs.existsSync(`${path}/seeds`)) {
      this.seedsDir = fs.realpathSync(`${path}/seeds`);
    }
    if (fs.existsSync("db/seeds")) {
      this.rootSeedsDir = fs.realpathSync("db/seeds");
    }
  }

  get connection() {
    const seeder = this;

    if (seeder._connection) return seeder._connection;

    const connectionInfo = JSON.parse(fs.readFileSync(seeder.connectionFilename));
    return (seeder._connection = new Connection(connectionInfo));
  }

  get seedFiles() {
    const seeder = this;

    const dir = seeder.seedsDir || seeder.rootSeedsDir;
    if (!dir) return [];
    return fs
      .readdirSync(dir)
      .filter(filename => seedsFileRegex.test(filename))
      .map(filename => `${dir}/${filename}`);
  }

  get seeds() {
    const seeder = this;

    if (seeder._seeds) return seeder._seeds;

    seeder._seeds = [];

    for (const filename of seeder.seedFiles) {
      let seeds;
      if (filename.endsWith(".json")) {
        seeds = JSON.parse(fs.readFileSync(filename));
      } else {
        seeds = YAML.load(filename);
      }
      if (Array.isArray(seeds)) seeder._seeds.push(...seeds);
      else if (typeof seeds == "object") seeder._seeds.push(seeds);
    }

    return seeder._seeds;
  }

  async seedRows({ seeds } = {}) {
    const seeder = this;

    const schema = await seeder.connection.schemaLayoutConnection.currentSchema;

    seeds = seeds || seeder.seeds;

    let rowsById = {};
    seeder.addSeedRows({
      seeds,
      context: {
        rowsById,
        nextPlaceholderId: 1,
        schema
      }
    });

    return rowsById;
  }

  addSeedRows({ seeds, context, type, parentRowId, fieldInParent }) {
    for (const seed of seeds) {
      this.addSeedRow({
        seed,
        context,
        type,
        parentRowId,
        fieldInParent
      });
    }
  }

  addSeedRow({ seed, type, parentRowId, fieldInParent, context }) {
    const seeder = this;

    const { schema } = context;

    if (Array.isArray(seed)) {
      seeder.addSeedRows({
        seeds: seed,
        type,
        parentRowId,
        fieldInParent,
        context
      });
      return;
    }

    let row, rowId, dbRowId, findBy;

    if (typeof seed.id == "number") {
      dbRowId = seed.id;
    }
    if (typeof seed.id == "string") seed.id = [seed.id];
    if (Array.isArray(seed.id)) {
      findBy = {};
      for (const fieldName of seed.id) {
        if (type.fields[fieldName]) {
          findBy[fieldName] = [];
        }
      }
    } else if (typeof seed.id == "object") {
      findBy = {};
      for (const [fieldName, value] of Object.entries(seed.id)) {
        if (type.fields[fieldName]) {
          findBy[fieldName] = value;
        }
      }
    }

    function ensureRow() {
      if (row) return;

      const { rowsById } = context;

      const type_name = ChangeCase.snakeCase(type.name);
      rowId = `${type_name}__${dbRowId || `?${context.nextPlaceholderId++}`}`;

      if (!rowsById[rowId]) {
        rowsById[rowId] = {
          type,
          dbRowId,
          findBy,
          fields: {}
        };
      }
      row = rowsById[rowId];

      if (parentRowId && fieldInParent) {
        const fieldForParent = fieldInParent.getLinkedToField();
        if (fieldInParent) {
          const parentRow = rowsById[parentRowId];

          if (!fieldInParent.isVirtual) {
            if (fieldInParent.isMultiple) {
              if (!parentRow.fields[fieldInParent.name]) parentRow.fields[fieldInParent.name] = {};
              parentRow.fields[fieldInParent.name][rowId] = true;
            } else {
              parentRow.fields[fieldInParent.name] = rowId;
            }
            if (rowId.includes("__?")) {
              const dbRowIdDependents = (row.dbRowIdDependents = row.dbRowIdDependents || {});
              let fields = (dbRowIdDependents[parentRowId] = dbRowIdDependents[parentRowId] || {});
              fields[fieldInParent.name] = true;

              const dbRowIdDependencies = (parentRow.dbRowIdDependencies = parentRow.dbRowIdDependencies || {});
              fields = dbRowIdDependencies[rowId] = dbRowIdDependencies[rowId] || {};
              fields[fieldForParent.name] = true;
            }
          }

          if (!fieldForParent.isVirtual) {
            if (fieldForParent.isMultiple) {
              if (!row.fields[fieldForParent.name]) row.fields[fieldForParent.name] = {};
              row.fields[fieldForParent.name][parentRowId] = true;
            } else {
              row.fields[fieldForParent.name] = parentRowId;
            }
            if (parentRowId.includes("__?")) {
              const dbRowIdDependents = (parentRow.dbRowIdDependents = parentRow.dbRowIdDependents || {});
              let fields = (dbRowIdDependents[rowId] = dbRowIdDependents[rowId] || {});
              fields[fieldForParent.name] = true;

              const dbRowIdDependencies = (row.dbRowIdDependencies = row.dbRowIdDependencies || {});
              fields = dbRowIdDependencies[parentRowId] = dbRowIdDependencies[parentRowId] || {};
              fields[fieldInParent.name] = true;
            }
          }
        }
      }
    }

    for (let [key, value] of Object.entries(seed)) {
      if (/^[A-Z]/.test(key)) {
        const type = schema.allTypes[key];
        if (!type) {
          console.log(`Type name '${key}' not found while seeding db (lines will be ignored)`);
          continue;
        }
        seeder.addSeedRow({
          seed: value,
          type,
          context
        });
        continue;
      }

      if (type === undefined) {
        console.log(
          `The seed file hasn't set the typename yet (i.e. you're trying to set a field of some unknown table) while seeding db (lines will be ignored)`
        );
        continue;
      }

      ensureRow();

      if (key == "id") continue;

      const field = type.fields[key];
      if (!field) {
        console.log(`Type '${type.name}' has no field '${key}' while seeding db (lines will be ignored)`);
        continue;
      }

      if (!field.isId) {
        if (field.isVirtual) continue;
        if (typeof value != "string" && typeof value != "number" && typeof value != "boolean") {
          console.log(
            `Cannot set field ${field.name} in type '${
              type.name
            }' using a value of type ${typeof value}, while seeding db (lines will be ignored)`
          );
          continue;
        }
        row.fields[field.name] = value;
        continue;
      }

      if (typeof value == "number") {
        value = {
          id: value
        };
      }

      if (typeof value != "object") {
        console.log(
          `Cannot set id-typed field ${field.name}, in type '${
            type.name
          }', using a value of type ${typeof value}, while seeding db (lines will be ignored)`
        );
        continue;
      }

      seeder.addSeedRow({
        seed: value,
        type: field.dataType,
        parentRowId: rowId,
        fieldInParent: field,
        context
      });
    }
  }

  bestSortingForSeedRows({ rowsById }) {
    const seeder = this;

    const sortedRowIds = [],
      dependencyCounts = {},
      dependentCounts = {};

    let idsToGo = Object.keys(rowsById);
    for (const rowId of idsToGo) {
      const row = rowsById[rowId];
      dependencyCounts[rowId] = row.dbRowIdDependencies ? Object.keys(row.dbRowIdDependencies).length : 0;
      dependentCounts[rowId] = row.dbRowIdDependents ? Object.keys(row.dbRowIdDependents).length : 0;
    }

    function addRowAndAdjustDependencyCounts(rowId) {
      const row = rowsById[rowId];
      sortedRowIds.push(rowId);
      if (row.dbRowIdDependents) {
        for (const dependentRowId of Object.keys(row.dbRowIdDependents)) {
          dependencyCounts[dependentRowId]--;
          dependentCounts[rowId]--;
        }
      }
      if (row.dbRowIdDependencies) {
        for (const dependencyRowId of Object.keys(row.dbRowIdDependencies)) {
          dependentCounts[dependencyRowId]--;
          dependencyCounts[rowId]--;
        }
      }
    }

    while (idsToGo.length) {
      idsToGo.sort((a, b) => dependencyCounts[a] - dependencyCounts[b]);

      const lowestCount = dependencyCounts[idsToGo[0]];
      if (lowestCount) {
        const [bestHubRowId, bestHubIndex] = idsToGo.reduce((prev, rowId, index) => {
          if (!prev) return [rowId, index];
          const [prevRowId] = prev;
          return dependentCounts[prevRowId] > dependentCounts[rowId] ? prev : [rowId, index];
        }, null);

        addRowAndAdjustDependencyCounts(bestHubRowId);
        idsToGo.splice(bestHubIndex, 1);

        continue;
      }

      let count = 0;
      for (const rowId of idsToGo) {
        if (dependencyCounts[rowId]) break;
        addRowAndAdjustDependencyCounts(rowId);
        count++;
      }
      idsToGo.splice(0, count);
    }

    return sortedRowIds;
  }

  async insertSeeds({ rowsById, quiet } = {}) {
    const seeder = this,
      connection = seeder.connection;

    function log() {
      if (!quiet) console.log.apply(console, arguments);
    }

    rowsById = rowsById || (await seeder.seedRows());
    const rowIds = seeder.bestSortingForSeedRows({
      rowsById
    });

    let sqlPromises = [],
      sqlRowIds = {};

    for (const rowId of rowIds) {
      const row = rowsById[rowId];
      const { type, fields, dbRowId, findBy, dbRowIdDependencies, dbRowIdDependents } = row;
      const tableName = ChangeCase.snakeCase(type.name);

      if (dbRowIdDependencies && Object.keys(dbRowIdDependencies).length) {
        for (const dependencyRowId of Object.keys(dbRowIdDependencies)) {
          if (sqlRowIds[dependencyRowId]) {
            await Promise.all(sqlPromises);
            sqlPromises = [];
            sqlRowIds = {};
            break;
          }
        }
      }

      let secondAttemptFields;
      if (dbRowIdDependencies && Object.keys(dbRowIdDependencies).length) {
        secondAttemptFields = {};
        for (const fields of Object.values(dbRowIdDependencies)) {
          Object.assign(secondAttemptFields, fields);
        }

        for (const fieldName of Object.keys(secondAttemptFields)) {
          delete fields[fieldName];
        }
      }

      delete fields.id;

      const fieldNames = [],
        templates = [],
        values = [];
      for (let [fieldName, value] of Object.entries(fields)) {
        const field = type.fields[fieldName];
        fieldNames.push(`"${SchemaToSQL.sqlFieldForField(field).sqlName}"`);
        if (field.isId) {
          if (field.isMultiple) continue;
          templates.push(SchemaToSQL.sqlArgTemplateForValue(values.length, "integer"));
          if (value) {
            if (typeof value != "number") {
              value = rowsById[value].dbRowId || null;
            }
          } else value = null;
          values.push(value);
        } else {
          templates.push(SchemaToSQL.sqlArgTemplateForValue(values.length, field.dataType.name));
          values.push(value);
        }
      }

      function performInsertOrUpdate(dbRowId) {
        if (dbRowId) {
          if (Object.keys(fields).length) {
            const fieldSettings = fieldNames.map((fieldName, index) => `${fieldName}=${templates[index]}`);

            const sql = `UPDATE "${tableName}" SET ${fieldSettings.join(
              ", "
            )} WHERE "${tableName}"."id" = ${dbRowId} RETURNING id;`;
            log(sql, values);
            return connection.query(sql, values).then(({ rows }) => {
              if (rows.length) return;
              fieldNames.push("id");
              templates.push(SchemaToSQL.sqlArgTemplateForValue(values.length, "integer"));
              values.push(dbRowId);
              return performInsertOrUpdate();
            });
          }
        } else {
          let sql;
          if (!fieldNames.length) {
            sql = `INSERT INTO "${tableName}" DEFAULT VALUES RETURNING id;`;
          } else {
            sql = `INSERT INTO "${tableName}" (${fieldNames.join(",")}) VALUES (${templates.join(", ")}) RETURNING id;`;
          }

          log(sql, values);
          return connection.query(sql, values).then(({ rows }) => {
            const dbRowId = (row.dbRowId = rows[0].id);

            if (dbRowIdDependents && Object.keys(dbRowIdDependents).length) {
              for (const [dependentRowId, fields] of Object.entries(dbRowIdDependents)) {
                const dependentRow = rowsById[dependentRowId];
                delete dependentRow.dbRowIdDependencies[rowId];
              }
            }
          });
        }
      }

      sqlRowIds[rowId] = true;
      if (dbRowId || !findBy) {
        sqlPromises.push(performInsertOrUpdate(dbRowId));
      } else {
        const fieldConditions = [],
          values = [];
        for (let [fieldName, value] of Object.entries(findBy)) {
          if (Array.isArray(value)) value = fields[fieldName];
          const field = type.fields[fieldName];
          fieldName = `"${SchemaToSQL.sqlFieldForField(field).sqlName}"`;
          if (field.isId) {
            if (field.isMultiple) continue;
            if (value) {
              if (typeof value != "number") {
                value = rowsById[value].dbRowId || null;
              }
            } else value = null;
          }

          if (value === undefined || value === null) {
            fieldConditions.push(`${fieldName} IS NULL`);
            continue;
          }

          const dataTypeName = field.isId ? "integer" : field.dataType.name;
          const template = SchemaToSQL.sqlArgTemplateForValue(values.length, dataTypeName);
          fieldConditions.push(`${fieldName} = ${template}`);
          values.push(value);
        }

        const sql = `SELECT id FROM "${tableName}" WHERE ${fieldConditions.join(" AND ")} LIMIT 1;`;
        log(sql, values);
        sqlPromises.push(
          connection.query(sql, values).then(({ rows }) => {
            const dbRowId = (row.dbRowId = rows.length ? rows[0].id : undefined);

            if (dbRowId && dbRowIdDependents && Object.keys(dbRowIdDependents).length) {
              for (const [dependentRowId, fields] of Object.entries(dbRowIdDependents)) {
                const dependentRow = rowsById[dependentRowId];
                delete dependentRow.dbRowIdDependencies[rowId];
              }
            }

            return performInsertOrUpdate(dbRowId);
          })
        );

        if (secondAttemptFields) {
          rowsById[rowId].fields = secondAttemptFields;
          rowIds.push(rowId);
        }
      }
    }

    await Promise.all(sqlPromises);
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DbSeeder,
  hasExposedBackDoor: true
});
