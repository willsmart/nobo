// db-datapoint-connection
// © Will Smart 2018. Licence: MIT

// This is an intermediary between the datapoint-cache and the postgresql-connection

const PublicApi = require('../general/public-api');
const log = require('../general/log');

// other implied dependencies

//const Connection = require('./postgresql-connection'); // via constructor arg: connection
//   uses getRowFields and updateRowFields

//const Schema = require('../schema'); // via constructor arg: schema
//   uses allTypes and fieldForDatapoint

//const Datapoint = require('../datapoint'); // via datapoints arg to functions
//    uses valid, fieldIfAny

// API is auto-generated at the bottom from the public interface of this class

class DbDatapointConnection {
  // public methods
  static publicMethods() {
    return ['validateDatapoints', 'commitDatapoints'];
  }

  constructor({ schema, connection }) {
    this.connection = connection;
    this.schema = schema;
  }

  validateDatapoints({ datapoints }) {
    const datapointConnection = this,
      { schema, connection } = datapointConnection;

    const fieldsByRowByType = {},
      validators = {};
    datapoints.forEach(datapoint => {
      datapoint = datapoint.__private;

      if (datapoint.valid) return;
      const field = datapoint.fieldIfAny;
      if (!field || field.get) {
        if (!datapoint.invalidDependencyDatapointCount) {
          datapoint.validate();
        }
        return;
      }

      const fieldsByRow = fieldsByRowByType[datapoint.typeName] || (fieldsByRowByType[datapoint.typeName] = {});
      const fields = fieldsByRow[datapoint.dbRowId] || (fieldsByRow[datapoint.dbRowId] = []);
      fields.push(field);

      validators[datapoint.datapointId] = value => datapoint.validate({ value });
    });

    const promises = [];
    Object.keys(fieldsByRowByType).forEach(typeName => {
      const type = schema.allTypes[typeName];
      const fieldsByRow = fieldsByRowByType[typeName];

      Object.keys(fieldsByRow).forEach(dbRowId => {
        const fields = fieldsByRow[dbRowId];

        promises.push(
          connection
            .getRowFields({
              type,
              dbRowId,
              fields,
            })
            .then(row => {
              fields.forEach(field => {
                const validator =
                  validators[
                    field.getDatapointId({
                      dbRowId,
                    })
                  ];
                if (validator) validator(row[field.name]);
              });
            })
        );
      });
    });

    return Promise.all(promises);
  }

  commitDatapoints({ datapoints }) {
    if (!datapoints.length) return;

    const datapointConnection = this,
      { schema, connection } = datapointConnection;

    const fieldsByRowByType = {},
      committers = {};
    datapoints.forEach(datapoint => {
      datapoint = datapoint.__private;

      if (!datapoint.updated) return;

      let field;
      if (datapoint.fieldName == '*') {
        field = { name: '*' };
      } else {
        try {
          field = schema.fieldForDatapoint(datapoint);
        } catch (err) {
          console.log(err);

          delete datapoint.updated;
          delete datapoint.newValue;
          return;
        }
        if (!field) {
          delete datapoint.updated;
          delete datapoint.newValue;
          return;
        }
      }
      const fieldsByRow = fieldsByRowByType[datapoint.typeName] || (fieldsByRowByType[datapoint.typeName] = {});
      const fields = fieldsByRow[datapoint.dbRowId] || (fieldsByRow[datapoint.dbRowId] = []);
      fields.push({
        name: field.name,
        value: datapoint.newValue,
        field: field,
        datapointId: datapoint.datapointId,
      });

      committers[datapoint.datapointId] = () => datapoint.commit({ updateIndex: datapoint.updateIndex });
    });

    const promises = [];
    Object.keys(fieldsByRowByType).forEach(typeName => {
      const type = schema.allTypes[typeName];
      const fieldsByRow = fieldsByRowByType[typeName];
      Object.keys(fieldsByRow).forEach(dbRowId => {
        const fieldInfos = fieldsByRow[dbRowId];

        promises.push(
          connection
            .updateRowFields({
              type: type,
              dbRowId,
              fields: fieldInfos,
            })
            .then(() => {
              fieldInfos.forEach(fieldInfo => {
                const committer = committers[fieldInfo.datapointId];
                if (committer) committer();
              });
            })
        );
      });
    });

    return Promise.all(promises);
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DbDatapointConnection,
  hasExposedBackDoor: true,
});
