const strippedValues = require("./stripped_values");
const ConvertIds = require("./convert_ids");
const PublicApi = require("./public_api");

// API is auto-generated at the bottom from the public interface of this class

class SchemaDefn {
  // public methods
  static publicMethods() {
    return ["allTypes", "source", "addLayout", "loadSource", "clear", "fieldForDatapoint"];
  }

  constructor() {
    this.clear();
  }

  get allTypes() {
    return this._allTypes;
  }

  get source() {
    return this._source;
  }

  addLayout(object) {
    this._addLayout(object);
  }

  clear() {
    this._allTypes = {};
    this._source = [];
  }

  loadSource(source) {
    if (!Array.isArray(source)) return;
    source.forEach(layout => {
      this.addLayout(layout);
    });
  }

  fieldForDatapoint({ typeName, fieldName }) {
    return this.allTypes[typeName].fields[fieldName];
  }

  getType(name) {
    let schema = this;
    if (typeof name == "object") return name.getEnclosingType();
    return (
      this._allTypes[name] ||
      (this._allTypes[name] = {
        _: "Type",
        stripped: function() {
          let ret = {};
          if (Object.getOwnPropertyNames(this.fields).length) ret.fields = strippedValues(this.fields);
          return ret;
        },
        name: name,
        fields: {},
        getEnclosingType: function() {
          return this;
        },
        getField: function(name, dataType, isVirtual, isMultiple) {
          if (name == undefined) {
            return;
          }
          const type = this;
          dataType = schema.getType(dataType);
          return (
            type.fields[name] ||
            (type.fields[name] = {
              _: "Field",
              stripped: function() {
                let ret = { dataType: this.dataType.name };
                if (this.default !== undefined) ret.default = this.default;
                if (this.isVirtual) ret.isVirtual = true;
                if (this.isMultiple) ret.isMultiple = true;
                if (Object.getOwnPropertyNames(this.links).length) ret.links = strippedValues(this.links);
                return ret;
              },
              name: name,
              dataType: dataType,
              isVirtual: isVirtual || false,
              isMultiple: isMultiple || false,
              isId: /^[A-Z]/.test(dataType.name),
              enclosingType: type,
              links: {},
              fullName: type.name + "::" + name,
              getEnclosingType: function() {
                return type;
              },
              getField: function(name, dataType, isVirtual, isMultiple) {
                if (name == undefined) return this;
                return this.dataType.getField(name, dataType, isVirtual, isMultiple);
              },
              getDatapointId: function({ dbRowId }) {
                return ConvertIds.recomposeId({
                  typeName: this.enclosingType.name,
                  dbRowId: dbRowId,
                  fieldName: this.name
                }).datapointId;
              },
              getLinkedToField: function() {
                const linkKeys = Object.keys(this.links);
                if (!linkKeys.length) return;
                const link = this.links[linkKeys[0]];
                return link.left === this ? link.right : link.left;
              },
              getLink: function(toField, linkType) {
                const field = this;
                return (
                  field.links[toField.fullName] ||
                  (field.links[toField.fullName] = toField.links[field.fullName] = {
                    _: "Link",
                    stripped: function() {
                      return { left: this.left.fullName, right: this.right.fullName, linkType: this.type };
                    },
                    left: field,
                    right: toField,
                    type: linkType
                  })
                );
              }
            })
          );
        }
      })
    );
  }

  _addLayout(object, me, myFieldName, as, depth) {
    const schema = this;

    depth = depth || 0;
    if (depth == 0) {
      schema._source.push(object);
    }

    const myField = me ? me.getField() : undefined;

    if (Array.isArray(object)) {
      let array = object;
      object = {};
      array.forEach(val => {
        if (typeof val == "string") object[val] = null;
      });
    }

    if (typeof object == "string" || typeof object == "number" || typeof object == "boolean") {
      if (myField) {
        myField.default = object;
      }
    } else if (object && typeof object == "object") {
      Object.getOwnPropertyNames(object).forEach(key => {
        let val = object[key];
        switch (key) {
          case "as":
            if (typeof val == "string") as = val;
            break;
          case "default":
          case "unique":
            if (myField) myField[key] = val;
            break;
          default:
            const match = /^(?:(--|~-|-~|~<|>~)\s*)?([\w_]+)(?:\(([\w_]+)\))?$/.exec(key);
            const linkTypes = {
              "--": {},
              "~-": { rightIsVirtual: true },
              "-~": { leftIsVirtual: true },
              "~<": { rightIsVirtual: true, rightIsMultiple: true },
              ">~": { leftIsVirtual: true, leftIsMultiple: true }
            };
            if (match) {
              const linkType = match[1],
                childFieldName = match[3] ? match[2] : undefined,
                childTypeName = match[3] ? match[3] : match[2];
              const linkTypeInfo = linkType ? linkTypes[linkType] : undefined;
              const childField =
                me && childFieldName
                  ? me.getField(
                      childFieldName,
                      childTypeName,
                      linkTypeInfo ? linkTypeInfo.rightIsVirtual : false,
                      linkTypeInfo ? linkTypeInfo.rightIsMultiple : false
                    )
                  : schema.getType(childTypeName);

              const myLocalFieldName = schema._addLayout(val, childField, childFieldName, myFieldName, depth + 1);

              if (linkType && me && myLocalFieldName) {
                const myLocalField = schema
                  .getType(match[3])
                  .getField(
                    myLocalFieldName,
                    me.getEnclosingType(),
                    linkTypeInfo ? linkTypeInfo.leftIsVirtual : false,
                    linkTypeInfo ? linkTypeInfo.leftIsMultiple : false
                  );
                myLocalField.getLink(childField, linkType);
              }
            }
        }
      });
    }
    return as;
  }
}

// API is the public facing class
module.exports = PublicApi({ fromClass: SchemaDefn, hasExposedBackDoor: true });
