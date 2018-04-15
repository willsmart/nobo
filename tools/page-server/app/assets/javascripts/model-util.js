/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS203: Remove `|| {}` from converted for-own loops
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_util;
if (!document.ModelDOM_classes) {
  document.ModelDOM_classes = {};
}
document.ModelDOM_classes.ModelDOM_util = ModelDOM_util = class ModelDOM_util {
  constructor() {}

  isEqual(a, b) {
    let v;
    if ($.isPlainObject(a)) {
      if (!$.isPlainObject(b)) {
        return false;
      }
      for (var k of Object.keys(a || {})) {
        v = a[k];
        if (!b.hasOwnProperty[k] || !document.modelDOM.isEqual(v, b[k])) {
          return false;
        }
      }
      for (k of Object.keys(b || {})) {
        v = b[k];
        if (!a.hasOwnProperty[k]) {
          return false;
        }
      }
      return true;
    } else if ($.isArray(a)) {
      if (!$.isArray(b) || a.length !== b.length) {
        return false;
      }
      for (let i = 0; i < a.length; i++) {
        v = a[i];
        if (!document.modelDOM.isEqual(v, b[i])) {
          return false;
        }
      }
      return true;
    } else {
      return a === b;
    }
  }

  clone(value) {
    let ret, v;
    if ($.isPlainObject(value)) {
      ret = {};
      for (let k in value) {
        v = value[k];
        ret[k] = document.modelDOM.cloneModelValue(v);
      }
      return ret;
    } else if ($.isArray(value)) {
      ret = [];
      for (v of value) {
        ret.push(document.modelDOM.cloneModelValue(v));
      }
      return ret;
    } else {
      return value;
    }
  }

  sanitizeClassName(name, ignoreClassStartRules) {
    let match;
    if (typeof name !== "string") {
      name = "";
    }
    let ret = "";
    const re = /[^a-zA-Z0-9]/g;
    let index = 0;
    while ((match = re.exec(name)) !== null) {
      if (match.index > index) {
        ret += name.substring(index, match.index);
      }
      ret += name.charCodeAt(match.index) + "-";
      index = match.index + 1;
    }
    if (name.length > index) {
      ret += name.substring(index);
    }

    if (!ignoreClassStartRules && (ret.length < 2 || /^\d/.test(ret))) {
      ret = `c-${ret}`;
    }
    return ret;
  }

  formAsNameValues(form) {
    let els;
    const ret = {};
    if (form && (els = form.elements)) {
      for (let el of els) {
        ret[el.name] = el.value;
      }
    }
    return ret;
  }
};
