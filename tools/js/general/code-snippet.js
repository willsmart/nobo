// code-snippet
// © Will Smart 2018. Licence: MIT

// A wrapper for vm allowing both server and client to run amophous code
// The key win here is a mechanism to safely ensure the variables and objects referenced in the code are set

// API is auto-generated at the bottom from the public interface of the CodeSnippet class

const PublicApi = require('./public-api');
const jsep = require('jsep');

const jsepChildKeys = {
  left: true,
  right: true,
  test: true,
  consequent: true,
  alternate: true,
  object: true,
  discriminant: true,
  argument: true,
  body: true,
};
const jsepChildArrayKeys = {
  expressions: true,
  arguments: true,
  defaults: true,
};

const permissable_globals = { Function: true, Math: true, Object: true, Math: true };

function getGlobal() {
  return this.__global || (this.__global = Function('return this')());
}

function getGlobalHash() {
  return Object.keys(getGlobal()).join(' ');
}

function makeGlobalWrapper() {
  const globalChangeDetectingObjects = {},
    globalCopy = {};
  for (const key of Object.keys(getGlobal())) {
    const cdo = (globalChangeDetectingObjects[key] = changeDetectorObject(getGlobal()[key]));
    globalCopy[key] = cdo && typeof cdo == 'object' ? cdo.useObject : cdo;
  }
  return {
    globalChangeDetectingObjects,
    globalCopy,
    clearChanges: () => {
      for (const cdo of Object.values(globalChangeDetectingObjects)) {
        if (cdo && typeof cdo == 'object') {
          cdo.clearChanges();
        }
      }
    },
    globalHash: getGlobalHash(),
    globalWrapper: new Function(
      'code',
      'globalCopy',
      `const ${Object.keys(getGlobal())
        .map(key => `${key}=globalCopy.${key}`)
        .join(',')};
    return new Function('context','"use strict";return('+code+');');`
    ),
  };
}

function getOrMakeGlobalWrapper(forceMake) {
  const globalHash = getGlobalHash();
  if (this.globalHash == globalHash && !forceMake) return this.wrapper;
  this.globalHash = globalHash;
  return (this.wrapper = makeGlobalWrapper());
}

function globalWrappedFunction(code) {
  const {
    globalChangeDetectingObjects,
    globalCopy,
    clearChanges,
    globalWrapper,
    globalHash,
  } = getOrMakeGlobalWrapper();
  return {
    globalChangeDetectingObjects,
    globalCopy,
    code,
    clearChanges,
    globalHash,
    wrappedFunction: globalWrapper(code, globalCopy),
  };
}

function callWrappedFunction(wrappedFunctionInfo, context) {
  const { globalChangeDetectingObjects, code, clearChanges, globalHash, wrappedFunction } = wrappedFunctionInfo;
  if (globalHash != getGlobalHash()) {
    return callWrappedFunction(globalWrappedFunction(code), context);
  }
  const changeDetectingContext = changeDetectorObject(context);
  clearChanges();
  return {
    globalChangeDetectingObjects,
    wrappedFunctionInfo,
    context,
    changeDetectingContext,
    result: wrappedFunction(changeDetectingContext.useObject),
  };
}

function changeDetectorObject(baseObject, setParentModified) {
  if (!baseObject || typeof baseObject != 'object') return baseObject;
  const changeObject = {},
    deletionsObject = {};
  modified = [false];
  function setModified() {
    if (setParentModified) setParentModified();
    modified[0] = true;
  }
  return {
    changeObject,
    deletionsObject,
    modified,
    clearChanges: () => {
      for (key of Object.keys(changeObject)) delete changeObject[key];
      for (key of Object.keys(deletionsObject)) delete deletionsObject[key];
      modified[0] = false;
    },
    useObject: new Proxy(
      {},
      {
        getPrototypeOf: () => Object.getPrototypeOf(baseObject),
        isExtensible: () => Object.isExtensible(baseObject),
        getOwnPropertyDescriptor: (_obj, prop) =>
          deletionsObject[prop]
            ? undefined
            : Object.getOwnPropertyDescriptor(changeObject, prop) || Object.getOwnPropertyDescriptor(baseObject, prop),
        defineProperty: (_obj, key, descriptor) => {
          setModified();
          delete deletionsObject[key];
          return Object.defineProperty(changeObject, key, descriptor);
        },
        has: (_obj, key) => !deletionsObject[key] && (key in changeObject || key in baseObject),
        get: (_obj, key) => {
          if (deletionsObject[key]) return;
          if (key in changeObject) {
            const ret = changeObject[key];
            return ret && typeof ret == 'object' ? ret.useObject : ret;
          }
          const ret = baseObject[key];
          if (ret && typeof ret == 'object') {
            return (changeObject[key] = changeDetectorObject(ret, setModified)).useObject;
          }
          return ret;
        },
        set: (_obj, key, value) => {
          setModified();
          delete deletionsObject[key];
          if (value && typeof value == 'object') {
            return (changeObject[key] = changeDetectorObject(ret, setModified)).useObject;
          }
          return (changeObject[key] = value);
        },
        deleteProperty: (_obj, key) => {
          setModified();
          delete changeObject[key];
          deletionsObject[key] = true;
          return true;
        },
        ownKeys: () => {
          if (!modified[0]) return Reflect.ownKeys(baseObject);
          const keys = new Set([...Reflect.ownKeys(baseObject), ...Reflect.ownKeys(changeObject)]);
          for (const key of Object.keys(deletionsObject)) keys.delete(key);
          return [...keys];
        },
      }
    ),
  };
}

class Code {
  static withString(codeString) {
    const codes = Code.codes || (Code.codes = {});
    return codes[codeString] || (codes[codeString] = new Code(codeString));
  }

  constructor(codeString) {
    const code = this;
    code.wrappedFunctionInfo = globalWrappedFunction(codeString);
  }

  static eval(context) {
    const code = this,
      { wrappedFunctionInfo, result, changeDetectingContext } = callWrappedFunction(code.wrappedFunctionInfo, context);
    code.wrappedFunctionInfo = wrappedFunctionInfo;
    return { changeDetectingContext, result };
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

    if (typeof func == 'function') {
      codeSnippet.setAsFunction({ func, names });
    } else {
      codeSnippet.code = Code.withString(code);
    }
  }

  get names() {
    return this._names || this.code.names;
  }

  get func() {
    return this._func || this.code.func;
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

  evaluate(arg) {
    if (typeof arg == 'function') arg = { valueForNameCallback: arg };
    let codeSnippet = this,
      {
        valueForNameCallback,
        valuesByName,
        defaultValue = codeSnippet.defaultValue,
        timeout = codeSnippet.defaultTimeout,
      } = arg;

    const sandbox = {};

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
      ret = codeSnippet._func(sandbox);
    } else {
      ({ result: ret } = codeSnippet.code.eval(sandbox));
    }

    return ret;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: CodeSnippet,
  hasExposedBackDoor: true,
});
