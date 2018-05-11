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
    rig.startTask("Creating and reading datapoints")
    const datapointCache = new DatapointCache(rig)

    let datapoint, value, datapointId = "app__1__#name"
    await rig.assert(`datapoint ${datapointId} doesn't exist in the cache yet`, !datapointCache.getExistingDatapoint({
      datapointId
    }))
    await rig.assert(`datapoint ${datapointId} created ok`, datapoint = await datapointCache.getOrCreateDatapoint({
      datapointId
    }))
    await rig.assert(`datapoint ${datapointId} value correct`, value = await datapoint.value, {
      equals: "1 app name"
    })
    datapointId = "app__1__#users"
    await rig.assert(`datapoint ${datapointId} doesn't exist in the cache yet`, !datapointCache.getExistingDatapoint({
      datapointId
    }))
    await rig.assert(`datapoint ${datapointId} created ok`, datapoint = await datapointCache.getOrCreateDatapoint({
      datapointId
    }))
    await rig.assert(`datapoint ${datapointId} value correct`, value = await datapoint.value, {
      unsortedEquals: ["user__1", "user__2"]
    })

    rig.endTask()
  })
})();