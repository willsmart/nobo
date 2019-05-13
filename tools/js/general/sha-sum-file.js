const { spawn } = require("child_process");

const shasumOfDir = "da39a3ee5e6b4b0d3255bfef95601890afd80709"; //TODO prob not all that portable. Figure out at runtime or do something else

// TODO check performance vs other approaches
async function shaSumFile(path) {
  const child = spawn("shasum", [path]);
  return await new Promise((resolve, reject) => {
    let op = "";
    child.stdout.on("data", data => {
      op += String(data);
    });
    child.on("exit", function(code, signal) {
      switch (code) {
        case 0:
          const match = /^([a-f0-9]{40}) /.match(op),
            shasum = match && match[1];
          if (!shasum) {
            reject(`Expected shasum for ${path}. TODO crap error msg`);
            break;
          }
          resolve(shasum == shasumOfDir ? "dir" : shasum);
          break;
        case 1:
          resolve();
          break;
        default:
          reject(`Unexpected shasum return code for ${path}: ${code}. TODO crap error msg`);
          break;
      }
    });
  });
}

module.exports = shaSumFile;
