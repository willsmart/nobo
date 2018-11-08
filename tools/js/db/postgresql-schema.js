// convert_ids
// © Will Smart 2018. Licence: MIT

// This is a tool to create and manipulate postgresql db tables and schemas
// The chief reason for creating this (instead of just grabbing a orm)
//   is that nobo uses triggers as a fundamental part of its work
// Each field of each table created has triggers attached, meaning that any change will be
//   propagated into a central table, and will result in interested parties being notified
//

const ChangeCase = require('change-case');
const ConvertIds = require('../datapoints/convert-ids');
const ModelChangeLog = 'ModelChangeLog';
const ModelChangeNotifyRequest = 'ModelChangeNotifyRequest';
const SchemaDefn = this.SchemaDefn;

module.exports = {
  getCreationSql: getCreationSql,
  getDropSql: getDropSql,
  getDiffSql: getDiffSql,

  sqlFieldForField: sqlFieldForField,
  sqlArgTemplateForValue: sqlArgTemplateForValue,
};

const prompterDelay = 0.1;

function sqlTypeForDatatype(dataType) {
  switch (dataType) {
    case 'string':
      return 'character varying';
    case 'datetime':
      return 'timestamp without time zone'; // TODO convert dates
    case 'text':
    case 'boolean':
    case 'integer':
      return dataType;
    default:
      return /^[A-Z]/.test(dataType) ? 'integer' : undefined;
  }
}

function sqlArgTemplateForValue(index, dataType) {
  let sqlType = sqlTypeForDatatype(dataType);
  if (!sqlType) return;
  return `$${index + 1}::${sqlType}`;
}

function sqlValueForValue(value, dataType) {
  // TODO!! This is just incredibly horrible in so many ways
  if (value === undefined) return;
  else if (value === null) return 'NULL';
  else
    switch (dataType) {
      case 'string':
        return "'" + value + "'::character varying";
      case 'datetime':
        if (value == 'now') return '"now"()';
        else return "'" + value + "'::timestamp without time zone"; // TODO convert dates
      case 'text':
        return "'" + value + "'::text";
      case 'boolean':
        return value ? 'TRUE' : 'FALSE';
      case 'integer':
        return String(value);
      default:
        if (!/^[A-Z]/.test(dataType)) return;
        if (typeof value == 'number' || /^\d+$/.test(value)) return String(value);
        const datapointInfo = ConvertIds.decomposeId({ rowId: value, datapointId: value, permissive: true });
        if (!datapointInfo) return;
        return String(datapointInfo.dbRowId); // TODO handle proxyKey for local models
    }
}

function sqlFieldForField(field) {
  return field.sqlField || (field.sqlField = sqlFieldForField_noCache(field));
}

function sqlFieldForField_noCache(field) {
  let ret = {
    sqlName: ChangeCase.snakeCase(field.name),
    sqlEnclosingTable: ChangeCase.snakeCase(field.enclosingType.name),
  };
  if (field.isId) {
    if (field.isVirtual) {
      ret.sqlName = ret.sqlName;
      ret.isVirtual = true;
    } else {
      ret.sqlName += '_id';
      ret.isId = true;
      ret.sqlDataType = 'integer';
    }
  } else {
    ret.isVirtual = field.isVirtual;
    switch (field.dataType.name) {
      case 'string':
        ret.sqlDataType = 'character varying';
        break;
      case 'datetime':
        ret.sqlDataType = 'timestamp without time zone';
        break;
      case 'text':
      case 'boolean':
      case 'integer':
        ret.sqlDataType = field.dataType.name;
        break;
      default:
        return;
    }
  }
  if ('default' in field) {
    ret.sqlDefault = sqlValueForValue(field.default, ret.sqlDataType);
  }
  ret.sql =
    '"' + ret.sqlName + '" ' + ret.sqlDataType + (ret.sqlDefault === undefined ? '' : ' DEFAULT ' + ret.sqlDefault);

  return ret;
}

function getCreationSql({ schema, retrigger }) {
  return new TempSchema(arguments[0]).getCreationSql(arguments[0]);
}

function getDropSql({ schema }) {
  return new TempSchema(arguments[0]).getDropSql();
}

function getDiffSql({ schema, fromSchema, retrigger }) {
  return new TempSchema(arguments[0]).getDiffSql(arguments[0]);
}

class TempSchema {
  constructor({ schema }) {
    this.schema = schema;
  }

  getCreationSql({ retrigger }) {
    const schema = this.schema;

    delete this.sql;
    this.getSqlObject().retrigger = retrigger;

    Object.keys(schema.allTypes).forEach(k => {
      const type = schema.allTypes[k];
      if (!/^[A-Z]/.test(k)) return;

      this.ensureCreateTableSql(type);
    });
    return this.sql.getFullSql();
  }

  getDropSql() {
    const schema = this.schema;

    delete this.sql;

    Object.keys(schema.allTypes).forEach(k => {
      const type = schema.allTypes[k];
      if (!/^[A-Z]/.test(k)) return;

      this.ensureDropTableSql(type);
    });
    return this.sql.getFullSql();
  }

  getDiffSql({ fromSchema, retrigger }) {
    const schema = this.schema;

    if (!fromSchema) return this.getCreationSql();

    fromSchema.isFrom = true;
    for (let type of Object.values(fromSchema.allTypes)) type.isFrom = true;

    delete this.sql;
    const sqlObj = this.getSqlObject();
    sqlObj.retrigger = retrigger;
    sqlObj.fromTempSchema = new TempSchema({
      schema: fromSchema,
    });
    sqlObj.fromTempSchema.isFrom = true;

    Object.keys(fromSchema.allTypes).forEach(k => {
      const fromType = fromSchema.allTypes[k];
      if (!/^[A-Z]/.test(k)) return;

      if (!schema.allTypes[fromType.name]) {
        sqlObj.fromTempSchema.ensureDropTableSql(fromType);
      }
    });

    Object.keys(schema.allTypes).forEach(k => {
      const type = schema.allTypes[k];
      if (!/^[A-Z]/.test(k)) return;

      if (!fromSchema.allTypes[type.name]) {
        this.ensureCreateTableSql(type);
      } else {
        const fromType = fromSchema.allTypes[type.name];
        Object.keys(fromType.fields).forEach(k => {
          const fromField = fromType.fields[k];
          if (!type.fields[fromField.name]) sqlObj.fromTempSchema.ensureDropFieldSql(fromField);
        });

        Object.keys(type.fields).forEach(k => {
          const field = type.fields[k];
          const fromField = fromType.fields[field.name];
          if (fromField) this.ensureAlterFieldSql(field);
          else this.ensureAddFieldSql(field);
        });
      }
    });
    return this.sql.getFullSql();
  }

  getSqlObject() {
    this.sql = this.sql || {
      tables: {},
      getFullSql: function({ includeChangeNotifiers = true } = {}) {
        let ret = '';
        if (!this.isFrom && this.fromTempSchema) {
          ret += this.fromTempSchema.getSqlObject().getFullSql({
            includeChangeNotifiers: false,
          });
        }
        Object.keys(this.tables).forEach(k => {
          const table = this.tables[k];
          let tableSQL = '';
          if (table.dropTable) {
            tableSQL += table.dropTable;
            if (includeChangeNotifiers) {
              Object.keys(table.changeNotifier).forEach(name => {
                const trigger = table.changeNotifier[name];
                if (typeof trigger == 'object' && trigger.dropSql) tableSQL += trigger.dropSql;
              });
            }
          } else if (includeChangeNotifiers) {
            Object.keys(table.changeNotifier).forEach(name => {
              const trigger = table.changeNotifier[name];
              if (typeof trigger == 'object' && trigger.sql) {
                tableSQL += trigger.sql;
              }
            });
          }
          if (table.createTable) tableSQL += table.createTable;
          if (!table.dropTable && includeChangeNotifiers) {
            Object.keys(table.changeNotifier).forEach(name => {
              const trigger = table.changeNotifier[name];
              if (typeof trigger == 'object' && trigger.triggerSql) {
                tableSQL += trigger.triggerSql;
              }
            });
          }
          if (table.dropFields) {
            Object.keys(table.dropFields).forEach(k => {
              const fieldSql = table.dropFields[k];
              tableSQL += fieldSql;
            });
          }
          if (table.addFields) {
            Object.keys(table.addFields).forEach(k => {
              const fieldSql = table.addFields[k];
              tableSQL += fieldSql;
            });
          }
          if (table.alterFields) {
            Object.keys(table.alterFields).forEach(k => {
              const fieldSql = table.alterFields[k];
              tableSQL += fieldSql;
            });
          }

          if (tableSQL) {
            ret +=
              `



-- ` +
              table.sqlName +
              `
${tableSQL}`;
          }
        });
        return ret;
      },
    };
    return this.sql;
  }

  static wrapAsNullTrigger(name) {
    return {
      functionName: name,
      triggerName: name + '_trigger',
      sql: `
DROP FUNCTION IF EXISTS "${name}" CASCADE;
`,
    };
  }

  static wrapAsTrigger(name, type, tableName, declarations, body) {
    return {
      functionName: name,
      triggerName: name + '_trigger',
      sql:
        `
CREATE OR REPLACE FUNCTION "` +
        name +
        `"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
` +
        (declarations
          ? `
    DECLARE ${declarations}`
          : '') +
        `
        BEGIN
` +
        body +
        `
        END;
$$;

ALTER FUNCTION "` +
        name +
        `"() OWNER TO "postgres";
`,
      triggerSql: `
        DROP TRIGGER IF EXISTS "${name}_trigger" ON "${tableName}" CASCADE;
        CREATE TRIGGER "${name}_trigger" ${type} ON "${tableName}" FOR EACH ROW EXECUTE PROCEDURE "public"."${name}"();
`,
      dropSql:
        `
DROP FUNCTION IF EXISTS "` +
        name +
        `" CASCADE;
`,
    };
  }

  static wrapAsNotifyingTrigger(name, type, tableName, declarations, body, returnValue = 'NULL') {
    return TempSchema.wrapAsTrigger(
      name,
      type,
      tableName,
      `
      since_last_change double precision;
      now_time timestamp;
      changed boolean := FALSE;
      ${declarations}
`,
      `
      SELECT EXTRACT(EPOCH FROM (now_time - "at")) INTO since_last_change FROM "model_change_log" WHERE id = (SELECT last_value FROM model_change_log_id_seq);

      ${body}

      IF changed AND since_last_change < ${prompterDelay} THEN
        -- Rapid changes, so use the prompter script to enforce a delay
        NOTIFY prompterscript;
      ELSE
        -- slow changes, so we needn't invoke the prompter script. This update will trigger the notify function attached to model_change_notify_request
        UPDATE "model_change_notify_request" SET model_change_id = 0;
      END IF;

      RETURN ${returnValue};        
`
    );
  }
  getSqlObjectForType(type) {
    const sql = this.getSqlObject();

    if (sql.tables[type.name]) return sql.tables[type.name];

    let changeNotifier = {};

    let declarations = '';

    const sqlName = ChangeCase.snakeCase(type.name);

    const changeIdSequenceName = ChangeCase.snakeCase(ModelChangeLog) + '_id_seq';

    if (type.name == ModelChangeLog) {
    } else if (type.name == ModelChangeNotifyRequest) {
      const functionName = sqlName + '_check_changes';

      changeNotifier.update = TempSchema.wrapAsTrigger(
        functionName + '__update',
        'BEFORE UPDATE',
        sqlName,
        `
        now timestamp without time zone;
        payload text;
        latest_model_change_id integer;
        old_model_change_id integer;
`,
        `
        old_model_change_id := OLD.model_change_id;

        SELECT now() INTO now;
        NEW.at = now;

      -- check if there are new model changes listeners might be interested in
        SELECT last_value INTO latest_model_change_id FROM  ` +
          changeIdSequenceName +
          `;
        IF FOUND THEN

          NEW.model_change_id = latest_model_change_id;
          WHILE latest_model_change_id > old_model_change_id LOOP
            IF latest_model_change_id - old_model_change_id < 200 THEN
              SELECT '[' || string_agg('"' || type || '__' || row_id || '__' || field || '"', ',') || ']' INTO payload FROM model_change_log where id > old_model_change_id AND id <= latest_model_change_id;
              PERFORM pg_notify(NEW.name, payload);
              EXIT;
            ELSE
              SELECT '[' || string_agg('"' || type || '__' || row_id || '__' || field || '"', ',') || ']' INTO payload FROM model_change_log where id > old_model_change_id AND id <= old_model_change_id+200;
              old_model_change_id := old_model_change_id + 200;
              PERFORM pg_notify(NEW.name, payload);
            END IF;
          END LOOP;

        END IF;

        RETURN NEW;        
`
      );

      changeNotifier.insert = TempSchema.wrapAsTrigger(
        functionName + '__insert',
        'BEFORE INSERT',
        sqlName,
        `
        now timestamp without time zone;
`,
        `
        SELECT now() INTO now;
        NEW.at = now;
        RETURN NEW;        
`
      );
    } else {
      const functionName = sqlName + '_model_maintanence';

      let bodySql = {
        delete: '',
        insert: '',
        update: '',
      };
      Object.keys(type.fields).forEach(k => {
        const field = type.fields[k];
        const sqlField = sqlFieldForField(field);
        if (!sqlField || sqlField.isVirtual) return;

        const fieldSql = TempSchema.sqlChangeNotifierForField(field);
        if (fieldSql.delete) {
          bodySql.delete += fieldSql.delete;
        }
        if (fieldSql.insert) {
          bodySql.insert += fieldSql.insert;
        }
        if (fieldSql.update) {
          bodySql.update += fieldSql.update;
        }
      });

      changeNotifier.delete = TempSchema.wrapAsNullTrigger(functionName + '__delete');

      changeNotifier.insert = TempSchema.wrapAsNullTrigger(functionName + '__insert');

      changeNotifier.update = TempSchema.wrapAsNullTrigger(functionName + '__update');

      changeNotifier.afterDelete = TempSchema.wrapAsNotifyingTrigger(
        functionName + '__after_delete',
        'AFTER DELETE',
        sqlName,
        '',
        bodySql.delete +
          `

      -- Row deletion
          INSERT INTO model_change_log (type, row_id, field, at) VALUES (TG_TABLE_NAME, OLD.id, '-', now_time) ON CONFLICT DO NOTHING;
          changed := TRUE;
`
      );

      changeNotifier.afterInsert = TempSchema.wrapAsNotifyingTrigger(
        functionName + '__after_insert',
        'AFTER INSERT',
        sqlName,
        '',
        bodySql.insert +
          `

      -- Row insertion
          INSERT INTO model_change_log (type, row_id, field, at) VALUES (TG_TABLE_NAME, NEW.id, '+', now_time) ON CONFLICT DO NOTHING;
          changed := TRUE;
`
      );

      changeNotifier.afterUpdate = TempSchema.wrapAsNotifyingTrigger(
        functionName + '__after_update',
        'AFTER UPDATE',
        sqlName,
        '',
        bodySql.update +
          `
`
      );
    }

    if (sql.fromTempSchema && !sql.retrigger) {
      const fromType = sql.fromTempSchema.schema.allTypes[type.name];
      if (fromType && fromType !== type) {
        const sqlFromType = sql.fromTempSchema.getSqlObjectForType(fromType);
        Object.keys(sqlFromType.changeNotifier).forEach(name => {
          const fromTrigger = sqlFromType.changeNotifier[name];
          const trigger = changeNotifier[name];
          if (trigger && trigger.sql == fromTrigger.sql) {
            delete changeNotifier[name];
          }
        });
      }
    }

    return (sql.tables[type.name] = {
      sqlName: ChangeCase.snakeCase(type.name),
      changeNotifier: changeNotifier,
    });
  }

  ensureCreateTableSql(type) {
    let sql = this.getSqlObjectForType(type);
    if (sql.createTable) return;
    delete sql.dropTable;
    delete sql.dropFields;
    delete sql.addFields;
    delete sql.alterFields;

    const idSequenceName = sql.sqlName + '_id_seq';

    sql.createTable =
      `
CREATE SEQUENCE "` +
      idSequenceName +
      `"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
CREATE TABLE "` +
      sql.sqlName +
      `" (
  "id" integer DEFAULT "nextval"('"` +
      idSequenceName +
      `"'::"regclass") NOT NULL`;
    Object.keys(type.fields).forEach(k => {
      const field = type.fields[k];
      const sqlField = sqlFieldForField(field);
      if (sqlField && !sqlField.isVirtual) {
        sql.createTable +=
          `,
  ` + sqlField.sql;
      }
    });
    sql.createTable +=
      `
);

ALTER TABLE ONLY "` +
      sql.sqlName +
      `" ADD CONSTRAINT "` +
      sql.sqlName +
      `_pkey" PRIMARY KEY (id);

ALTER SEQUENCE "` +
      idSequenceName +
      `" OWNED BY "` +
      sql.sqlName +
      `"."id";
`;
  }

  ensureAddFieldSql(field) {
    let sql = this.getSqlObjectForType(field.enclosingType);
    if (sql.createTable || (sql.addFields && sql.addFields[field.name])) return;
    delete sql.dropTable;
    if (sql.dropFields) delete sql.dropFields[field.name];
    if (sql.alterFields) delete sql.alterFields[field.name];

    const sqlField = sqlFieldForField(field);
    if (sqlField && !sqlField.isVirtual) {
      sql.addFields = sql.addFields || {};

      sql.addFields[field.name] = 'ALTER TABLE "' + sqlField.sqlEnclosingTable + '" ADD COLUMN ' + sqlField.sql + ';\n';
    }
  }

  ensureAlterFieldSql(field) {
    const fromTempSchema = this.sql.fromTempSchema;
    if (!fromTempSchema) return;
    const fromType = fromTempSchema.schema.allTypes[field.enclosingType.name];
    if (!fromType) return;
    const fromField = fromType.fields[field.name];
    if (!fromField) return;

    let sql = this.getSqlObjectForType(field.enclosingType);

    const sqlField = sqlFieldForField(field);
    const sqlFromField = sqlFieldForField(fromField);
    if (!sqlField || sqlField.isVirtual) {
      if (sqlFromField && !sqlFromField.isVirtual) {
        this.ensureDropFieldSql(fromField);
      }
      return;
    } else if (!sqlFromField || sqlFromField.isVirtual) {
      this.ensureAddFieldSql(field);
    }

    if (
      sql.createTable ||
      (sql.addFields && sql.addFields[field.name]) ||
      (sql.alterFields && sql.alterFields[field.name])
    )
      return;
    delete sql.dropTable;
    if (sql.dropFields) delete sql.dropFields[field.name];

    let alterSql = '';
    if (sqlField.sqlName !== sqlFromField.sqlName) {
      alterSql +=
        'ALTER TABLE "' +
        sqlField.sqlEnclosingTable +
        '" RENAME COLUMN "' +
        sqlFromField.sqlName +
        '" TO "' +
        sqlField.sqlName +
        '";\n';
    }

    let alters = [];
    if (sqlField.sqlDefault !== sqlFromField.sqlDefault) {
      if (sqlField.sqlDefault === undefined) {
        alters.push('DROP DEFAULT');
      } else {
        alters.push('SET DEFAULT ' + sqlField.sqlDefault);
      }
    }
    if (sqlField.sqlDataType !== sqlFromField.sqlDataType) {
      alters.push('TYPE ' + sqlField.sqlDataType);
    }

    alters.forEach(alter => {
      alterSql +=
        'ALTER TABLE "' + sqlField.sqlEnclosingTable + '" ALTER COLUMN "' + sqlField.sqlName + '" ' + alter + ';\n';
    });
    if (alterSql.length) {
      sql.alterFields = sql.alterFields || {};
      sql.alterFields[field.name] = alterSql;
    }
  }

  ensureDropTableSql(type) {
    let sql = this.getSqlObjectForType(type);
    if (sql.dropTable || sql.createTable || sql.addFields || sql.alterFields) return;
    delete sql.dropFields;

    sql.dropTable = 'DROP TABLE "' + sql.sqlName + '" CASCADE;\n';
  }

  ensureDropFieldSql(field) {
    let sql = this.getSqlObjectForType(field.enclosingType);

    if (
      sql.dropTable ||
      sql.createTable ||
      (sql.addFields && sql.addFields[field.name]) ||
      (sql.alterFields && sql.alterFields[field.name]) ||
      (sql.dropFields && sql.dropFields[field.name])
    )
      return;

    sql.dropFields = sql.dropFields || {};

    const sqlField = sqlFieldForField(field);
    if (sqlField && !sqlField.isVirtual) {
      sql.dropFields[field.name] =
        'ALTER TABLE "' + sqlField.sqlEnclosingTable + '" DROP COLUMN "' + sqlField.sqlName + '" CASCADE;\n';
    }
  }

  static sqlChangeNotifierForField(field) {
    const sqlField = sqlFieldForField(field);
    if (!sqlField || sqlField.isVirtual) return '';
    if (sqlField.isId) {
      const linkFieldNames = Object.keys(field.links);
      if (linkFieldNames.length) {
        const link = field.links[linkFieldNames[0]];
        const linkedField = link.left.fullName == field.fullName ? link.right : link.left;
        const sqlLinkedField = sqlFieldForField(linkedField);

        return {
          delete:
            `
        -- ` +
            sqlField.sqlName +
            `
            IF OLD."` +
            sqlField.sqlName +
            `" IS NOT NULL THEN
                INSERT INTO model_change_log (type, row_id, field, at) VALUES ('` +
            sqlLinkedField.sqlEnclosingTable +
            `', OLD."` +
            sqlField.sqlName +
            `", '` +
            sqlLinkedField.sqlName +
            `', now_time) ON CONFLICT DO NOTHING;
              changed := TRUE;
            END IF;
`,
          insert:
            `
        -- ` +
            sqlField.sqlName +
            `
            IF NEW."` +
            sqlField.sqlName +
            `" IS NOT NULL THEN
                INSERT INTO model_change_log (type, row_id, field, at) VALUES ('` +
            sqlLinkedField.sqlEnclosingTable +
            `', NEW."` +
            sqlField.sqlName +
            `", '` +
            sqlLinkedField.sqlName +
            `', now_time) ON CONFLICT DO NOTHING;
              changed := TRUE;
            END IF;
`,
          update:
            `
        -- ` +
            sqlField.sqlName +
            `
            IF ((OLD."` +
            sqlField.sqlName +
            `" IS NULL AND NEW."` +
            sqlField.sqlName +
            `" IS NOT NULL) OR (OLD."` +
            sqlField.sqlName +
            `" IS NOT NULL AND NEW."` +
            sqlField.sqlName +
            `" IS NULL) OR (OLD."` +
            sqlField.sqlName +
            `" <> NEW."` +
            sqlField.sqlName +
            `")) THEN
                IF NEW."` +
            sqlField.sqlName +
            `" IS NOT NULL THEN
                  INSERT INTO model_change_log (type, row_id, field, at) VALUES ('` +
            sqlLinkedField.sqlEnclosingTable +
            `', NEW."` +
            sqlField.sqlName +
            `", '` +
            sqlLinkedField.sqlName +
            `', now_time) ON CONFLICT DO NOTHING;
                  changed := TRUE;
                END IF;
                IF OLD."` +
            sqlField.sqlName +
            `" IS NOT NULL THEN
                  INSERT INTO model_change_log (type, row_id, field, at) VALUES ('` +
            sqlLinkedField.sqlEnclosingTable +
            `', OLD."` +
            sqlField.sqlName +
            `", '` +
            sqlLinkedField.sqlName +
            `', now_time) ON CONFLICT DO NOTHING;
                  changed := TRUE;
                END IF;
                INSERT INTO model_change_log (type, row_id, field, at) VALUES (TG_TABLE_NAME, NEW.id, '` +
            sqlField.sqlName +
            `', now_time) ON CONFLICT DO NOTHING;
              changed := TRUE;
            END IF;
`,
        };
      }
    }

    return {
      delete:
        `
      -- ` +
        sqlField.sqlName +
        `
          IF (OLD."` +
        sqlField.sqlName +
        `" IS NOT NULL) THEN
              INSERT INTO model_change_log (type, row_id, field, at) VALUES (TG_TABLE_NAME, OLD.id, '` +
        sqlField.sqlName +
        `', now_time) ON CONFLICT DO NOTHING;
              changed := TRUE;
          END IF;
      `,
      insert:
        `
-- ` +
        sqlField.sqlName +
        `
    IF (NEW."` +
        sqlField.sqlName +
        `" IS NOT NULL) THEN
        INSERT INTO model_change_log (type, row_id, field, at) VALUES (TG_TABLE_NAME, NEW.id, '` +
        sqlField.sqlName +
        `', now_time) ON CONFLICT DO NOTHING;
        changed := TRUE;
    END IF;
`,
      update:
        `
-- ` +
        sqlField.sqlName +
        `
    IF ((OLD."` +
        sqlField.sqlName +
        `" IS NULL AND NEW."` +
        sqlField.sqlName +
        `" IS NOT NULL) OR (OLD."` +
        sqlField.sqlName +
        `" IS NOT NULL AND NEW."` +
        sqlField.sqlName +
        `" IS NULL) OR (OLD."` +
        sqlField.sqlName +
        `" <> NEW."` +
        sqlField.sqlName +
        `")) THEN
        INSERT INTO model_change_log (type, row_id, field, at) VALUES (TG_TABLE_NAME, NEW.id, '` +
        sqlField.sqlName +
        `', now_time) ON CONFLICT DO NOTHING;
        changed := TRUE;
    END IF;
`,
    };
  }
}
