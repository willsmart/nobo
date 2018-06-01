// code-snippet
// © Will Smart 2018. Licence: MIT

// A wrapper for vm allowing both server and client to run amophous code
// The key win here is a mechanism to safely ensure the variables and objects referenced in the code are set

// API is auto-generated at the bottom from the public interface of the CodeSnippet class

const PublicApi = require("./public-api");
const vm = require("vm");
const jsep = require("jsep");

const jsepChildKeys = {
  left: true,
  right: true,
  test: true,
  consequent: true,
  alternate: true,
  object: true,
  discriminant: true,
  argument: true,
  body: true
};
const jsepChildArrayKeys = {
  expressions: true,
  arguments: true,
  defaults: true
};

const resultKey = "___result___";

class CodeSnippet {
  // public methods
  static publicMethods() {
    return ["evaluate", "names", "script", "func", "parse", "setAsFunction"];
  }

  constructor({ code, func, names, ignoreNames = {} }) {
    const codeSnippet = this;

    codeSnippet.defaultValue = "...";
    codeSnippet.defaultTimeout = 1000;
    codeSnippet.ignoreNames = ignoreNames;

    codeSnippet.setAsFunction({ func, names });
    codeSnippet.parse({ code });
  }

  get names() {
    return this._names;
  }

  get script() {
    return this._script;
  }

  get func() {
    return this._func;
  }

  setAsFunction({ func, names }) {
    const codeSnippet = this;

    if (typeof func != "function") return;

    delete codeSnippet._script;
    if (typeof names != "object") names = {};
    codeSnippet._names = typeof names == "object" ? names : {};
    codeSnippet._func = func;
  }

  parse({ code }) {
    const codeSnippet = this;

    if (typeof code != "string") return;

    delete codeSnippet._func;
    delete codeSnippet._script;
    codeSnippet._names = {};
    try {
      codeSnippet._script = new vm.Script(`___result___ = (${code})`, {
        displayErrors: true
      });
    } catch (err) {
      console.log(`Failed to compile code snippet: ${code}\n${err}\n`);
      return;
    }
    try {
      codeSnippet._names = CodeSnippet.namesFromAst(jsep(code));
    } catch (err) {
      console.log(`Failed to parse code snippet: ${code}\n${err}\n`);
      delete codeSnippet._script;
      return;
    }
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
      if (typeof value != "object" || !codeSnippet.forEachName(callback, value, stack)) {
        callback(...stack);
      }
      stack.pop();
    }
    return hasName;
  }

  evaluate(arg) {
    if (typeof arg == "function") arg = { valueForNameCallback: arg };
    let codeSnippet = this,
      {
        valueForNameCallback,
        valuesByName,
        defaultValue = codeSnippet.defaultValue,
        timeout = codeSnippet.defaultTimeout
      } = arg;

    const sandbox = {};
    sandbox[resultKey] = defaultValue;

    if (typeof valueForNameCallback != "function") {
      valueForNameCallback = (...names) => {
        let values = valuesByName;
        let index = 0;
        for (const name of names) {
          if (typeof values != "object") return;
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

    if (codeSnippet._func) {
      sandbox[resultKey] = codeSnippet._func(sandbox);
    } else if (codeSnippet._script) {
      try {
        codeSnippet._script.runInNewContext(sandbox, {
          displayErrors: true,
          timeout
        });
      } catch (err) {
        console.log(`Failed to run code snippet:\n${err}\n`);
      }
    }

    return sandbox[resultKey];
  }

  static namesFromAst(ast, toNames) {
    toNames = toNames || {};

    if (typeof ast != "object" || !ast.type) return toNames;

    if (ast.type == "Identifier" && ast.name) {
      toNames[ast.name] = {};
      return toNames;
    }

    if (ast.type == "MemberExpression") {
      memberHandler: do {
        const namesArray = [];
        let object = ast;
        for (; object.type == "MemberExpression"; object = object.object) {
          if (object.property.type != "Identifier") break memberHandler;
          namesArray.unshift(object.property.name);
        }
        if (object.type != "Identifier") break;
        namesArray.unshift(object.name);

        let names = toNames;
        for (const name of namesArray) {
          names = names[name] = names[name] || {};
        }
        return toNames;
      } while (false);
    }

    if (ast.type == "CallExpression" && ast.callee.type == "MemberExpression") {
      CodeSnippet.namesFromAst(ast.callee.object, toNames);
    }

    for (const [key, val] of Object.entries(ast)) {
      if (jsepChildKeys[key]) CodeSnippet.namesFromAst(val, toNames);
      else if (jsepChildArrayKeys[key] && Array.isArray(val)) {
        for (const child of val) CodeSnippet.namesFromAst(child, toNames);
      }
    }
    return toNames;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: CodeSnippet,
  hasExposedBackDoor: true
});
