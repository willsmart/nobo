// state-to-cache-connection
// © Will Smart 2018. Licence: MIT

// This is an intermediary between the datapoint-cache and the shared-state

const PublicApi = require('../general/public-api');
const ConvertIds = require('../convert-ids');
const SharedState = require('../general/shared-state');

const callbackKey = 'state-to-cache-connection';

// other implied dependencies

//const Schema = require('../schema'); // via use of datapoint.fieldIfAny

//const Datapoint = require('../datapoint'); // via datapoints arg to functions
//    uses invalid, fieldIfAny, stopWatching, valueIfAny, invalidate, invalid, setVirtualField

// API is auto-generated at the bottom from the public interface of this class

class StateToCacheConnection {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({ sharedState = undefined, cache }) {
    const stateToCacheConnection = this;

    sharedState = sharedState || SharedState.global;

    Object.assign(stateToCacheConnection, {
      sharedState,
      cache,
    });

    sharedState.watch({
      callbackKey,
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject;

        forEachChangedKeyPath((keyPath, change) => {
          switch (keyPath.length) {
            case 0:
              return true;
            case 1:
              return keyPath[0] == 'datapointsById';
            case 2:
              break;
            default:
              return false;
          }

          if (!ConvertIds.datapointRegex.test(keyPath[1])) return false;

          let datapoint;
          if (change.is === undefined) {
            datapoint = cache.getExistingDatapoint({
              datapointId: keyPath[1],
            });
          } else {
            datapoint = cache.getOrCreateDatapoint({
              datapointId: keyPath[1],
            });
            datapoint.watch({});
          }
          if (!datapoint || datapoint.invalid || change.is === datapoint.valueIfAny) {
            return;
          }
          datapoint.invalidate();
        });
      },
    });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: StateToCacheConnection,
  hasExposedBackDoor: true,
});
