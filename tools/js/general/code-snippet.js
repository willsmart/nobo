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

const permissable_globals = { Function: true, Math: true, Object: true };

class Code {
  static withString(codeString) {
    const codes = Code.codes || (Code.codes = {});
    return codes[codeString] || (codes[codeString] = new Code(codeString));
  }

  constructor(codeString) {
    const code = this;
    code.codeString = codeString;
    code.names = {};
    code.eval({});
  }

  proxiedFunction() {
    const code = this,
      { proxy, codeString } = code;

    // sad to say but this code has to use with in order to catch variable usage.
    // with is deprecated so I'll investigate alternatives
    // This is wrapped in a 'new Function' call to temporarily turn off strict mode
    const ret = new Function('proxy', `return function(context) {with(proxy) {"use strict";return (${codeString})}}`)(
      proxy
    );

    return ret;
  }

  get proxy() {
    const code = this;
    if (code._proxy) return code._proxy;
    const { names } = code;
    return (code._proxy = new Proxy(
      {},
      {
        get: (_target, key) => {
          if (typeof key != 'string') return;
          if (!(key in names)) {
            names[key] = true;
          }
          if (key in code.outputContext) return code.outputContext[key];
          return code.context[key];
        },
        set: (_target, key, value) => {
          code.outputContext[key] = value;
        },
        has: (_target, key) => {
          return typeof key == 'string' && (key in code.outputContext || !(key in permissable_globals));
        },
      }
    ));
  }

  static safeEval(code, context) {
    return function(code) {
      return eval(code);
    }.call(context || {}, code);
  }

  get func() {
    const code = this;
    if (code.err) return;
    if (!code._func) {
      try {
        code._func = code.proxiedFunction();
        if (typeof code.func != 'function') throw new Error('Code is not an expression');
      } catch (err) {
        code.err = `Failed to compile code snippet: ${code.codeString}\nError: ${err}\n`;
        console.error(code.err);
        return;
      }
    }
    return code._func;
  }

  // I figure this is a reasonable way to ensure that nobo supports all features of javascript, while leaning on
  //  js itself to do the parsing.
  // Essentially, each time the code encounters a reference error, the name is added and the code rerun
  // This does incur a one-time recompile and except cost which is bounded to the number of names used by the code.
  //  In all the scenarios I aim to use this code, the number of referenced names will be small, so that's fine
  // A core concept of CodeSnippet is that all snippets are sandboxed with no sideeffects drifting out of the sandbox
  //  so rerunning codesnippets is ok, and will not cause any instability/undefined states
  eval(context) {
    const code = this;

    const func = code.func;
    if (!func) return;

    try {
      code.context = context;
      code.outputContext = {};
      const ret = func(context);
      return ret;
    } catch (err) {
      console.log(
        `Couldn't eval code snippet: ${code.codeString}\n with args: ${JSON.stringify(context)}\n error: ${err.message}`
      );
      return;
    }
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
      ret = codeSnippet.code.eval(sandbox);
    }

    return ret;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: CodeSnippet,
  hasExposedBackDoor: true,
});
