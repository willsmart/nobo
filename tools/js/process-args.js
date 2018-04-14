// process_args
// © Will Smart 2018. Licence: MIT

// This presents the process arguments as an object
// eg if the program was run as:
//  command a=1 b=2 c
// then processArgs() == {a:1, b:2, c:true}

// API is the function. include as
// const processArgs = require(pathToFile)
module.exports = processArgs;

function processArgs() {
  var args = {};
  process.argv.slice(2).forEach(arg => {
    let kv = /([\w-.]+)=(.*)/.exec(arg);
    if (kv) {
      args[kv[1]] = kv[2];
    } else {
      args[arg] = true;
    }
  });
  return args;
}
