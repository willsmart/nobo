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
    verbosity: 3,
    failVerbosity: 3
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
      dpWithGetterUsingParentId = "user__1__#app_name",

      datapointIds = [simpleDatapointId, dpWithDependentWithDependentId, dpWithGetterAndDependencyAndDependentId, dpWithGetterAndDependencyWithDependencyId, dpWithDependentId, dpWithGetterAndDependencyId, dpWithGetterId, dpWithGetterUsingParentId],
      datapointsWithGetterIds = [dpWithGetterAndDependencyAndDependentId, dpWithGetterAndDependencyWithDependencyId, dpWithGetterAndDependencyId, dpWithGetterId, dpWithGetterUsingParentId],
      datapointsWithDependencyIds = [dpWithGetterAndDependencyAndDependentId, dpWithGetterAndDependencyWithDependencyId, dpWithGetterAndDependencyId],
      datapointsWithDependentIds = [dpWithDependentWithDependentId, dpWithGetterAndDependencyAndDependentId, dpWithDependentId],
      datapointsWithoutDependentIds = [simpleDatapointId, dpWithGetterAndDependencyWithDependencyId, dpWithGetterAndDependencyId, dpWithGetterId, dpWithGetterUsingParentId],
      datapointsWithoutDependencyIds = [simpleDatapointId, dpWithDependentWithDependentId, dpWithDependentId, dpWithGetterId, dpWithGetterUsingParentId],

      datapoints = {},
      expectedValues = {
        "app__1__#name": "1 app name",

        "user__1__#name": "1 user name",
        "user__1__#uppercase_name": "1 USER NAME",
        "user__1__#quoted_uppercase_name": "\"1 USER NAME\"",

        "user__1__#bio": "1 user bio",
        "user__1__#uppercase_bio": "1 USER BIO",

        "user__1__#type": "?",
        "user__1__#app_name": "app is 1 app name"
      },
      baseCallbackKey = "a",
      callbackKeys = {},

      onvalidCalls = {},
      oninvalidCalls = {}

    datapointId = simpleDatapointId

    //     "getExistingDatapoint",
    //         CA2: datapoint didn't exist
    await rig.assert(`the datapoint ${datapointId} doesn't exist in the cache yet`, !datapointCache.getExistingDatapoint({
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
    //  +
    //     "getOrCreateDatapoint",
    //         CB2: datapoint didn't exist
    for (const datapointId of datapointsWithoutDependentIds) {
      await rig.assert(`the datapoint ${datapointId} was created ok`, datapoints[datapointId] = await datapointCache.getOrCreateDatapoint({
        datapointId
      }))
    }
    //     "getExistingDatapoint",
    //         CA1: datapoint existed beforehand
    //  +
    //     "getExistingDatapoint",
    //         CA1: datapoint existed beforehand
    for (const datapointId of datapointsWithoutDependentIds) {
      await rig.assert(`the recently created datapoint ${datapointId} is returned by getExistingDatapoint`, datapointCache.getExistingDatapoint({
        datapointId
      }), {
        sameObject: datapoints[datapointId]
      })
    }
    // the dependencies should have been created alongside
    for (const datapointId of datapointsWithDependentIds) {
      await rig.assert(`the dependency datapoint ${datapointId} was created ok and is returned by getExistingDatapoint`, datapoints[datapointId] = datapointCache.getExistingDatapoint({
        datapointId
      }))
    }
    //     "watch", 
    //         DD2: callbackKey not specified
    await rig.assert(`a watch was started on datapoint ${datapointId} with listeners and without a callbackKey specified`, callbackKeys[datapointId] = datapoints[datapointId].watch({
      onvalid: (datapoint) => onvalidCalls[datapointId] = {
        value: datapoint.value
      }
    }))
    //     "watch", 
    //         DD1: callbackKey specified
    for (const datapointId of datapointsWithoutDependentIds) {
      await rig.assert(`a watch was started on datapoint ${datapointId} with a callbackKey specified and without listeners`, datapoints[datapointId].watch({
        callbackKey: baseCallbackKey,
      }), {
        equals: baseCallbackKey
      })
    }
    //     "getOrCreateDatapoint",
    //         CB1: datapoint existed beforehand
    //  +
    //     "getOrCreateDatapoint",
    //         CB1: datapoint existed beforehand
    await rig.assert(`the already created datapoint ${datapointId} returned by getOrCreateDatapoint`, await datapointCache.getOrCreateDatapoint({
      datapointId
    }), {
      sameObject: datapoints[datapointId]
    })

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
    //  +
    //     "validateNewlyInvalidDatapoints",
    //         CC:  (also entry point for validate tests)

    await rig.assert(`the value of datapoint ${datapointId} is correct`, await datapoints[datapointId].value, {
      equals: expectedValues[datapointId]
    })
    await rig.assert(`the datapoint ${datapointId} called its onvalid listener`, onvalidCalls[datapointId])
    //     "valueIfAny"
    //         DB
    await rig.assert(`the datapoint ${datapointId} is valid and its value is correctly returned by valueIfAny`, datapoints[datapointId].valueIfAny, {
      equals: expectedValues[datapointId]
    })
    //         DC1: already valid
    for (const datapointId of datapointIds) {
      await rig.assert(`the value of already valid datapoint ${datapointId} is correctly returned by value`, await datapoints[datapointId].value, {
        equals: expectedValues[datapointId]
      })
    }
    //     "stopWatching", 
    //         DE1: was not last listener
    await rig.assert(`the first watch was stopped on datapoint ${datapointId}`, await datapoints[datapointId].stopWatching({
      callbackKey: callbackKeys[datapointId]
    }), {
      includes: {
        callbackKey: callbackKeys[datapointId]
      }
    })
    await rig.assert(`the datapoint ${datapointId} still exists after removing one of the listeners`, datapointCache.getExistingDatapoint({
      datapointId
    }), {
      sameObject: datapoints[datapointId]
    })
    //     "stopWatching", 
    //         DE2: was last listener
    //  +
    //      "deleteIfUnwatched" (via validate)
    //        DI1: has no listeners, watchingOneShotResolvers or dependents
    for (const datapointId of datapointsWithoutDependentIds) {
      await rig.assert(`the last watch was stopped on datapoint ${datapointId}`, datapoints[datapointId].stopWatching({
        callbackKey: baseCallbackKey
      }), {
        includes: {
          callbackKey: baseCallbackKey
        }
      })
    }
    for (const datapointId of datapointIds) {
      await rig.assert(`the datapoint ${datapointId} no longer exists after removing the last listener`, datapointCache.getExistingDatapoint({
        datapointId
      }), {
        equals: false
      })
    }

    //      "deleteIfUnwatched" (via validate)
    //        DI3: has watchingOneShotResolver
    datapoints[datapointId] = await datapointCache.getOrCreateDatapoint({
      datapointId
    })
    await datapoints[datapointId].value
    await rig.assert(`the recreated datapoint ${datapointId} no longer exists after removing the last watchingOneShotResolver`, datapointCache.getExistingDatapoint({
      datapointId
    }), {
      equals: false
    })

    for (const datapointId of datapointIds) {
      datapoints[datapointId] = await datapointCache.getOrCreateDatapoint({
        datapointId
      })
      datapoints[datapointId].watch({
        callbackKey: baseCallbackKey
      })
    }
    callbackKeys[datapointId] = datapoints[datapointId].watch({
      oninvalid: (datapoint) => oninvalidCalls[datapointId] = {
        value: datapoint.value
      }
    })

    //     "invalidate", 
    //         DF1: was already invalid
    await rig.assert(`invalidate is idempotent on already invalid datapoint ${datapointId}`, datapoints[datapointId].invalidate(), {
      includes: {
        _value: false,
        invalid: true
      }
    })
    for (const datapointId of datapointIds) {
      await rig.assert(`the value of recreated datapoint ${datapointId} is correct`, await datapoints[datapointId].value, {
        equals: expectedValues[datapointId]
      })
    }
    //     "invalidate", 
    //         DF2: no dependent datapoints
    //         DF4: has dependent datapoint that was previously valid and has no dependent datapoints itself
    //         DF6: has dependent datapoint that was previously valid and has a dependent datapoint itself
    //         DF7: listener has no oninvalid
    for (const datapointId of datapointsWithoutDependencyIds) {
      await rig.assert(`invalidate clears value on datapoint ${datapointId}`, datapoints[datapointId].invalidate(), {
        includes: {
          _value: false,
          invalid: true
        }
      })
    }
    //     "invalidate", 
    //         DF8: listener has oninvalid
    await rig.assert(`invalidate of ${datapointId} called listener`, oninvalidCalls[datapointId])
    //     "invalidate", 
    //         DF3: has dependent datapoint that was previously invalid and has no dependent datapoints itself
    //         DF4: has dependent datapoint that was previously valid and has no dependent datapoints itself
    //         DF5: has dependent datapoint that was previously invalid and has a dependent datapoint itself
    //         DF6: has dependent datapoint that was previously valid and has a dependent datapoint itself
    for (const datapointId of datapointsWithDependencyIds) {
      await rig.assert(`invalidate of dependency cleared value on datapoint ${datapointId}`, datapoints[datapointId], {
        includes: {
          _value: false,
          invalid: true
        }
      })
    }

    datapoints[dpWithDependentWithDependentId].value
    await rig.assert(`invalidate of datapoint ${dpWithDependentWithDependentId} that has an invalid dependent clears value`, datapoints[dpWithDependentWithDependentId].invalidate(), {
      includes: {
        _value: false,
        invalid: true
      }
    })
    datapoints[dpWithDependentId].value
    await rig.assert(`invalidate of datapoint ${dpWithDependentId} that has an invalid dependent clears value`, datapoints[dpWithDependentId].invalidate(), {
      includes: {
        _value: false,
        invalid: true
      }
    })

    const newValues = {
      "app__1__#name": "1 app new name",
      "user__1__#app_name": "app is 1 app new name"
    }

    //     "updateValue", 
    //         DG
    await rig.assert(`updating value of datapoint ${datapointId} set the new value correctly`, datapoints[datapointId].updateValue({
      newValue: newValues[datapointId]
    }), {
      includes: {
        newValue: newValues[datapointId]
      }
    })

    //     "commitNewlyUpdatedDatapoints",
    //         CD
    await rig.assert(`commitNewlyUpdatedDatapoints doesn't throw`, await datapointCache.commitNewlyUpdatedDatapoints(), {
      throws: false
    })

    datapoints[datapointId].invalidate()

    await rig.assert(`the new value of datapoint ${datapointId} is correctly read back`, await datapoints[datapointId].value, {
      equals: newValues[datapointId]
    })
    await rig.assert(`the new value of datapoint ${dpWithGetterUsingParentId} is correctly read back`, await datapoints[dpWithGetterUsingParentId].value, {
      equals: newValues[dpWithGetterUsingParentId]
    })


    // Datapoint
    //     "validate" (via validateNewlyInvalidDatapoints)
    //         DH1: datapoint was already valid
    //              There is no path to this through the public api
    //
    //

    rig.endTask()
  })
})();