// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const TestRig = require("../../test-rig");
const processArgs = require("../../process-args");
const DatapointCache = require("../../datapoint-cache");

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
  }, async function (rig) {
    rig.startTask("constructor")
    const datapointCache = new DatapointCache(rig)

    rig.startTask("getExistingDatapoint (does not exist)")
    let datapointId = "app__1__name"
    await rig.assert(`datapoint ${datapointId} doesn't exist in the cache yet`, !datapointCache.getExistingDatapoint({
      datapointId
    }))

    rig.endTask()
  })
})();