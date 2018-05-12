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
  //     "getExistingDatapoint",
  //         CA1: datapoint existed beforehand
  //         CA2: datapoint didn't exist
  //     "getOrCreateDatapoint",
  //         CB1: datapoint existed beforehand
  //         CB2: datapoint didn't exist
  //     "validateNewlyInvalidDatapoints",
  //         CC:  (also entry point for validate tests)
  //     "commitNewlyUpdatedDatapoints",
  //         CD
  //     "schema",
  //         CE
  //     "connection"
  //         CF

  // Datapoint
  //     constructor
  //         DA1: no getter
  //         DA2: has getter with no dependencies
  //         DA3: has getter with dependencies
  //     "valueIfAny"
  //         DB
  //     "value",
  //         DC1: already valid
  //         DC2: was not valid 
  //     "watch", 
  //         DD1: callbackKey specified
  //         DD2: callbackKey not specified
  //     "stopWatching", 
  //         DE1: was not last listener
  //         DE2: was last listener
  //     "invalidate", 
  //         DF1: was already invalid
  //         DF2: no dependent datapoints
  //         DF3: has dependent datapoint that was previously invalid and has no dependent datapoints itself
  //         DF4: has dependent datapoint that was previously valid and has no dependent datapoints itself
  //         DF5: has dependent datapoint that was previously invalid and has a dependent datapoint itself
  //         DF6: has dependent datapoint that was previously valid and has a dependent datapoint itself
  //         DF7: listener has no oninvalid
  //         DF8: listener has oninvalid
  //     "updateValue", 
  //         DG
  //
  //     "validate" (via validateNewlyInvalidDatapoints)
  //         DH1: datapoint was already valid
  //         DH2: datapoint has getter (also entry for valueFromGetter test cases)
  //         DH3: has no dependencies or listeners or watchingOneShotResolvers
  //         DH4: has dependency that has no dependencies itself
  //         DH5: has dependency that has a dependencies itself which was previously invalid
  //         DH6: has dependency that has a dependencies itself which was previously valid
  //         DH7: listener has no onvalid
  //         DH8: listener has onvalid
  //         DH9: has watchingOneShotResolver (also entry for deleteIfUnwatched)
  //
  //      "deleteIfUnwatched" (via validate)
  //        DI1: has no listeners, watchingOneShotResolvers or dependents
  //        DI2: has listener
  //        DI3: has watchingOneShotResolver
  //        DI4: has dependent
  //
  //      "valueFromGetter" (via validate)
  //        DJ1: has no dependencies, getter succeeds
  //        DK2: has no dependencies, getter throws
  //        DL3: has valid dependency that itself has no dependencies
  //        DL4: has invalid dependency that itself has no dependencies
  //        DL5: has dependency that itself has dependencies

  await TestRig.go({
    path: __dirname,
    moduleName: "Datapoint Cache",
    verbose: args.verbose
  }, async function (rig) {
    rig.startTask("DatapointCache tests")
    const datapointCache = new DatapointCache(rig)

    //     "schema",
    //         CE
    rig.assert(`the cache schema is the one passed to it`, datapointCache.schema, {
      essential: true,
      sameObject: rig.schema
    })
    //     "connection"
    //         CF
    rig.assert(`the cache connection is the one passed to it`, datapointCache.connection, {
      essential: true,
      sameObject: rig.connection
    })


    //     "getExistingDatapoint",
    //         CA2: datapoint didn't exist
    let datapoint, value, datapointId,
      simpleDatapointId = "app__1__#name",

      dpWithDependentWithDependentId = "user__1__#name",
      dpWithGetterAndDependencyAndDependentId = "user__1__#uppercase_name",
      dpWithGetterAndDependencyWithDependencyId = "user__1__#quoted_uppercase_name",

      dpWithDependentId = "user__1__#bio",
      dpWithGetterAndDependencyId = "user__1__#uppercase_bio",

      dpWithGetterId = "user__1__#type",

      datapointIds = [simpleDatapointId, dpWithDependentWithDependentId, dpWithGetterAndDependencyAndDependentId, dpWithGetterAndDependencyWithDependencyId, dpWithDependentId, dpWithGetterAndDependencyId, dpWithGetterId],
      datapointsWithGetterIds = [dpWithGetterAndDependencyAndDependentId, dpWithGetterAndDependencyWithDependencyId, dpWithGetterAndDependencyId, dpWithGetterId],
      datapointsWithDependencyIds = [dpWithGetterAndDependencyAndDependentId, dpWithGetterAndDependencyWithDependencyId, dpWithGetterAndDependencyId],
      datapointsWithDependentIds = [dpWithDependentWithDependentId, dpWithGetterAndDependencyAndDependentId, dpWithDependentId],
      datapointsWithoutDependentIds = [simpleDatapointId, dpWithGetterAndDependencyWithDependencyId, dpWithGetterAndDependencyId, dpWithGetterId],
      datapointsWithoutDependencyIds = [simpleDatapointId, dpWithDependentWithDependentId, dpWithDependentId, dpWithGetterId],

      datapoints = {},
      expectedValues = {
        "app__1__#name": "1 app name",

        "user__1__#name": "1 user name",
        "user__1__#uppercaseName": "1 USER NAME",
        "user__1__#quotedUppercaseName": "\"1 USER NAME\"",

        "user__1__#bio": "1 user bio",
        "user__1__#uppercaseBio": "1 USER BIO",

        "user__1__#type": "?"
      },
      baseCallbackKey = "a",
      callbackKeys = {},

      onvalidCalls = {},
      oninvalidCalls = {}

    datapointId = simpleDatapointId

    await rig.assert(`datapoint ${datapointId} doesn't exist in the cache yet`, !datapointCache.getExistingDatapoint({
      simpleDatapointId
    }))
    //     "getOrCreateDatapoint",
    //         CB2: datapoint didn't exist
    //  +
    //     constructor
    //         DA1: no getter
    //  +
    //         DA2: has getter with no dependencies
    //  +
    //         DA3: has getter with dependencies
    for (const datapointId of datapointsWithoutDependentIds) {
      await rig.assert(`datapoint ${datapointId} created ok`, datapoints[datapointId] = await datapointCache.getOrCreateDatapoint({
        datapointId
      }))
    }
    //     "getExistingDatapoint",
    //         CA1: datapoint existed beforehand
    for (const datapointId of datapointsWithoutDependentIds) {
      await rig.assert(`created datapoint ${datapointId} returned by getExistingDatapoint`, datapointCache.getExistingDatapoint({
        datapointId
      }), {
        sameObject: datapoints[datapointId]
      })
    }
    // the dependencies should have been created alongside
    for (const datapointId of datapointsWithDependentIds) {
      await rig.assert(`created datapoint ${datapointId} returned by getExistingDatapoint`, datapoints[datapointId] = datapointCache.getExistingDatapoint({
        datapointId
      }))
    }
    //     "watch", 
    //         DD2: callbackKey not specified
    await rig.assert(`a watch was started on datapoint ${datapointId} with listeners and without a callbackKey specified`, callbackKeys[datapointId] = datapoints[datapointId].watch({
      onvalid: (datapoint) => onvalidCalls[datapointId] = {
        value: datapoint.value
      },
      oninvalid: (datapoint) => oninvalidCalls[datapointId] = {
        value: datapoint.value
      },
    }))
    //     "watch", 
    //         DD1: callbackKey specified
    for (const datapointId of datapointsWithoutDependencyIds) {
      await rig.assert(`a watch was started on datapoint ${datapointId} with a callbackKey specified and without listeners`, datapoints[datapointId].watch({
        callbackKey: baseCallbackKey,
      }), {
        equals: baseCallbackKey
      })
    }
    //     "getOrCreateDatapoint",
    //         CB1: datapoint existed beforehand
    for (const datapointId of datapointIds) {
      await rig.assert(`created datapoint ${datapointId} returned by getOrCreateDatapoint`, await datapointCache.getOrCreateDatapoint({
        datapointId
      }), {
        sameObject: datapoints[datapointId]
      })
    }

    //     "value",
    //         DC2: was not valid 
    //  +
    //     "validateNewlyInvalidDatapoints",
    //         CC:  (also entry point for validate tests)
    //  +
    //     "validate" (via validateNewlyInvalidDatapoints)
    //         DH1: datapoint was already valid
    //  +
    //         DH2: datapoint has getter (also entry for valueFromGetter test cases)
    //  +
    //         DH3: has no dependencies or listeners or watchingOneShotResolvers
    //  +
    //         DH4: has dependency that has no dependencies itself
    //  +
    //         DH5: has dependency that has a dependencies itself which was previously invalid
    //  +
    //         DH6: has dependency that has a dependencies itself which was previously valid
    //  +
    //     "validate" (via validateNewlyInvalidDatapoints)
    //         DH8: listener has onvalid
    //  +
    //         DH7: listener has no onvalid
    //  +
    //         DH9: has watchingOneShotResolver (also entry for deleteIfUnwatched)
    //  +
    //      "deleteIfUnwatched" (via validate)
    //        DI2: has listener
    //  +
    //        DI4: has dependent
    //  +
    //      "valueFromGetter" (via validate)
    //        DJ1: has no dependencies, getter succeeds
    //  +
    //        DK2: has no dependencies, getter throws
    //  +
    //        DL3: has valid dependency that itself has no dependencies
    //  +
    //        DL4: has invalid dependency that itself has no dependencies
    //  +
    //        DL5: has dependency that itself has dependencies
    await rig.assert(` value of datapoint ${datapointId} is correct`, await datapoints[datapointId].value, {
      equals: expectedValues[datapointId]
    })
    await rig.assert(` datapoint ${datapointId} called its onvalid listener`, onvalidCalls[datapointId])
    //     "valueIfAny"
    //         DB
    await rig.assert(` datapoint ${datapointId} is valid and its value is correctly returned by valueIfAny`, datapoints[datapointId].valueIfAny, {
      equals: expectedValues[datapointId]
    })
    //         DC1: already valid
    for (const datapointId of datapointIds) {
      await rig.assert(` value of already valid datapoint ${datapointId} is correctly returned by value`, await datapoints[datapointId].value, {
        equals: expectedValues[datapointId]
      })
    }

    //     "commitNewlyUpdatedDatapoints",
    //         CD

    // Datapoint
    //     constructor
    //         DA1: no getter
    //         DA2: has getter with no dependencies
    //         DA3: has getter with dependencies
    //     "stopWatching", 
    //         DE1: was not last listener
    //         DE2: was last listener
    //     "invalidate", 
    //         DF1: was already invalid
    //         DF2: no dependent datapoints
    //         DF3: has dependent datapoint that was previously invalid and has no dependent datapoints itself
    //         DF4: has dependent datapoint that was previously valid and has no dependent datapoints itself
    //         DF5: has dependent datapoint that was previously invalid and has a dependent datapoint itself
    //         DF6: has dependent datapoint that was previously valid and has a dependent datapoint itself
    //         DF7: listener has no oninvalid
    //         DF8: listener has oninvalid
    //     "updateValue", 
    //         DG
    //
    //     "validate" (via validateNewlyInvalidDatapoints)
    //         DH1: datapoint was already valid
    //              There is no path to this through the public api
    //
    //      "deleteIfUnwatched" (via validate)
    //        DI1: has no listeners, watchingOneShotResolvers or dependents
    //        DI3: has watchingOneShotResolver
    //


    rig.endTask()
  })
})();