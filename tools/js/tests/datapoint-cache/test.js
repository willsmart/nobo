// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const TestRig = require("../../test-rig");
const processArgs = require("../../process-args");

(async function () {
    var args = processArgs();

    console.log("   args: " + JSON.stringify(args));

    // api: 
    // "getExistingDatapoint",
    // "getOrCreateDatapoint",
    // "validateNewlyInvalidDatapoints",
    // "commitNewlyUpdatedDatapoints",

    // "schema",
    // "connection"

    await TestRig.go({
        path: __dirname,
        moduleName: "Datapoint Cache",
        verbose: args.verbose
      }, rig => {
        rig.startTask({
          name: "constructor"
        })
        const datapointCache = new datapointCache(rig)

        rig.startTask({
          name: "getExistingDatapoint (does not exist)"
        })
        datapointCache.getExistingDatapoint({
          datapointId: ""
        })

      }
    })
})();