// code-snippet
// © Will Smart 2018. Licence: MIT

// A wrapper for vm allowing both server and client to run amophous code
// The key win here is a mechanism to safely ensure the variables and objects referenced in the code are set

// API is auto-generated at the bottom from the public interface of the CodeSnippet class

const namesFromCodeString = require('./names-from-code-string');

const unicodeEscapeRegex = /^(?:(?!\\u)(?:\\.|.))*$/;
function hasUnicodeEscape(string) {
  return !unicodeEscapeRegex.test(string);
}

module.exports = wrapFunctionLocals;

function wrapFunctionLocals(codeString) {
  if (hasUnicodeEscape(codeString)) {
    console.log('Disallowing code that includes a unicode escape');
    return {};
  }

  const names = namesFromCodeString(codeString),
    nameKeys = Object.keys(names);

  let wrappedFunction;
  try {
    wrappedFunction = Function(
      '__context',
      '"use strict";' + wrappedCodeString({ nameKeys, codeString, isExpression: true })
    );
  } catch (err) {
    try {
      wrappedFunction = Function(
        '__context',
        '"use strict";' + wrappedCodeString({ nameKeys, codeString, isExpression: false })
      );
    } catch (err) {
      console.log(`Failed to compile code: ${codeString}`);
    }
  }

  return {
    names,
    wrappedFunction,
  };
}

function wrappedCodeString({ nameKeys, codeString, isExpression }) {
  if (!nameKeys.length) {
    if (isExpression) return `return (${codeString});`;
    else return codeString;
  } else {
    const unpackContext = `let ${nameKeys.map(name => `${name} = __context.${name}`).join(',\n    ')};\n`,
      repackContext = nameKeys
        .map(name => `    if (__context.${name} !== ${name}) __context.${name} = ${name};`)
        .join('\n');

    if (isExpression) return `${unpackContext}\nconst __ret = (${codeString});\n\n${repackContext}\nreturn __ret;`;
    else return `${unpackContext}\n${codeString};\n\n${repackContext}`;
  }
}
