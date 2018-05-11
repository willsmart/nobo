// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const TestRig = require("../../test-rig");
const processArgs = require("../../process-args");
const DatapointCache = require("../../datapoint-cache");

(async function () {
  var args = processArgs();

  console.log("   args: " + JSON.stringify(args));

  // api: 
  // DatapointCache
  // "getExistingDatapoint",
  // "getOrCreateDatapoint",
  // datapoint exists
  // datapoint didn't exist
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

    rig.assert(`the cache schema is the one passed to it`, datapointCache.schema, {
      essential: true,
      sameObject: rig.schema
    })
    rig.assert(`the cache connection is the one passed to it`, datapointCache.connection, {
      essential: true,
      sameObject: rig.connection
    })

    let datapoint, value, datapointId = "app__1__#name"
    await rig.assert(`datapoint ${datapointId} doesn't exist in the cache yet`, !datapointCache.getExistingDatapoint({
      datapointId
    }))
    await rig.assert(`datapoint ${datapointId} created ok`, datapoint = await datapointCache.getOrCreateDatapoint({
      datapointId
    }))
    await rig.assert(`created datapoint ${datapointId} returned by getExistingDatapoint`, datapointCache.getExistingDatapoint({
      datapointId
    }), {
      sameObject: datapoint
    })
    await rig.assert(`created datapoint ${datapointId} returned by getOrCreateDatapoint`, await datapointCache.getOrCreateDatapoint({
      datapointId
    }), {
      sameObject: datapoint
    })

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
      equals: ["user__1", "user__2"],
      unsorted: true
    })

    rig.endTask()
  })
})();