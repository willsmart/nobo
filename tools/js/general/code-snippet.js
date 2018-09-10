// code-snippet
// © Will Smart 2018. Licence: MIT

// A wrapper for vm allowing both server and client to run amophous code
// The key win here is a mechanism to safely ensure the variables and objects referenced in the code are set

// API is auto-generated at the bottom from the public interface of the CodeSnippet class

const PublicApi = require('./public-api');
const changeDetectorObject = require('./change-detector-object');
const wrapFunctionLocals = require('./wrap-function-locals');
const log = require('../general/log');

class Code {
  static withString(codeString) {
    const codes = Code.codes || (Code.codes = {});
    return codes[codeString] || (codes[codeString] = new Code(codeString));
  }

  constructor(codeString) {
    const code = this;
    Object.assign(code, wrapFunctionLocals(codeString));
  }

  evalOnContext(context, state, event) {
    const code = this,
      { wrappedFunction } = code,
      changeDetectingContext = changeDetectorObject(context);
    let result;
    try {
      result = wrappedFunction
        ? event
          ? wrappedFunction.call(event.target, changeDetectingContext.useObject, state, {}, event)
          : wrappedFunction(changeDetectingContext.useObject, state, {}, event)
        : undefined;
    } catch (error) {
      log('err.code', `Error while evaluating code: ${error.message}`);
    }
    return {
      context,
      changeDetectingContext,
      result,
    };
  }

  evalOnModelCDO(modelCDO, state, event) {
    const code = this,
      { wrappedFunction } = code;
    let result;
    try {
      result = wrappedFunction
        ? event
          ? wrappedFunction.call(event.target, modelCDO, state, modelCDO, event)
          : wrappedFunction(modelCDO, state, modelCDO, event)
        : undefined;
    } catch (error) {
      log('err.code', `Error while evaluating code: ${error.message}`);
    }
    return {
      modelCDO,
      result,
    };
  }
}

class CodeSnippet {
  // public methods
  static publicMethods() {
    return ['evaluate', 'names', 'func', 'parse', 'setAsFunction'];
  }

  constructor({ code, func, names, ignoreNames = {} }) {
    const codeSnippet = this;

    codeSnippet.defaultValue = '...';
    codeSnippet.defaultTimeout = 1000;
    codeSnippet.ignoreNames = ignoreNames;
    codeSnippet.codeString = code;

    if (typeof func == 'function') {
      codeSnippet.setAsFunction({ func, names });
    } else {
      codeSnippet.code = Code.withString(code);
    }
  }

  get names() {
    return this._names || this.code.names;
  }

  setAsFunction({ func, names }) {
    const codeSnippet = this;

    if (typeof func != 'function') return;

    delete codeSnippet._func;
    if (!names || typeof names != 'object') names = {};
    codeSnippet._names = names && typeof names == 'object' ? names : {};
    codeSnippet._func = func;
  }

  forEachName(callback, names, stack) {
    const codeSnippet = this;

    stack = stack || [];
    names = names || codeSnippet.names;

    let hasName = false;
    for (const [name, value] of Object.entries(names)) {
      if (codeSnippet.ignoreNames[name]) continue;
      hasName = true;
      stack.push(name);
      if (!value || typeof value != 'object' || !codeSnippet.forEachName(callback, value, stack)) {
        callback(...stack);
      }
      stack.pop();
    }
    return hasName;
  }

  evaluate({ cache, rowId, valueForNameCallback, valuesByName, defaultValue, timeout, event }) {
    const codeSnippet = this,
      sandbox = {};

    if (!defaultValue) defaultValue = codeSnippet.defaultValue;
    if (!timeout) timeout = codeSnippet.defaultTimeout;

    const stateVar = cache ? cache.stateVar : undefined,
      state = stateVar ? stateVar.stateVar : {},
      rowChangeTrackers = cache ? cache.rowChangeTrackers : undefined,
      rowObject = rowId && rowChangeTrackers ? rowChangeTrackers.rowObject(rowId) : undefined;

    if (typeof valueForNameCallback != 'function') {
      valueForNameCallback = (...names) => {
        let values = valuesByName;
        let index = 0;
        for (const name of names) {
          if (!values || typeof values != 'object') return;
          if (index < names.length - 1) values = values[name];
          else return values[name];
          index++;
        }
      };
    }

    codeSnippet.forEachName((...names) => {
      let localSandbox = sandbox;
      names.forEach((name, index) => {
        if (index < names.length - 1)
          localSandbox = localSandbox[name] ? localSandbox[name] : (localSandbox[name] = {});
        else {
          localSandbox[name] = valueForNameCallback(...names);
        }
      });
    });

    let ret = codeSnippet.defaultValue;
    if (codeSnippet._func) {
      ret = codeSnippet._func(sandbox, state);
    } else if (rowObject) {
      ({ result: ret } = codeSnippet.code.evalOnModelCDO(rowObject, state, event));
    } else {
      ({ result: ret } = codeSnippet.code.evalOnContext(sandbox, state, event));
    }
    if (stateVar) stateVar.commitStateVar();

    return ret;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: CodeSnippet,
  hasExposedBackDoor: true,
});
