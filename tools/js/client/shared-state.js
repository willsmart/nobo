const PublicApi = require("../general/public-api");
const makeClassWatchable = require("../general/watchable");
const diffAny = require("../general/diff")
const {
  shallowCopy,
  shallowCopyObjectIfSame
} = require("../general/clone")

// API is auto-generated at the bottom from the public interface of the SharedState class


// TemporaryState encapsulates the changes to the shared state object.
// To change the state object you request a commit witht he requestCommit method.
//  The callback you provide is passed a TemporaryState object, which you can modify using the atPath accessor
//
// eg
//  SharedState.requestCommit(temp=>{temp.atPath('datapoints',datapointId).name = 'newName'})
class TemporaryState {
  static publicMethods() {
    return ["atPath", "state"];
  }

  constructor({
    fromState
  }) {
    const temporaryState = this;

    temporaryState._state = temporaryState.fromState = fromState;
  }

  get state() {
    return this._state
  }

  atPath(...keyPath) {
    const temporaryState = this;

    let fromState = temporaryState.fromState,
      state = shallowCopyObjectIfSame(fromState, temporaryState, "_state");
    for (const key of keyPath) {
      state = shallowCopyObjectIfSame((fromState = fromState[key]), state, key);
    }
    return state;
  }
}

const TemporaryState_public = PublicApi({
  fromClass: TemporaryState,
  hasExposedBackDoor: true
});



let globalSharedState;

class SharedState {
  static publicMethods() {
    return ["global", "requestCommit", "state", "watch", "stopWatching"];
  }

  constructor() {
    const sharedState = this
    sharedState._state = {}
    sharedState.commitPromise = Promise.resolve()
  }

  static get state() {
    return SharedState.global.state
  }

  get state() {
    return this._state
  }

  static get global() {
    return globalSharedState ? globalSharedState : (globalSharedState = new SharedState())
  }

  static requestCommit(modifyStateCallback) {
    SharedState.global.requestCommit(modifyStateCallback)
  }

  async requestCommit(modifyStateCallback) {
    const sharedState = this

    sharedState.commitPromise = sharedState.commitPromise.then(() => {
      const temporaryState = new TemporaryState({
        fromState: sharedState.state
      })

      modifyStateCallback(temporaryState);

      sharedState.commit({
        toState: temporaryState.state
      })
    })

    await sharedState.commitPromise
  }

  commit({
    toState
  }) {
    const sharedState = this,
      fromState = sharedState.state;

    const diff = diffAny(fromState, toState)
    if (!diff) return;

    const changes = sharedState.changeListFromDiff(diff, fromState, toState);
    const forEachChangedKeyPath = (callback) => {
      let keyPath = []
      for (const change of changes) {
        if (change.depth < keyPath.length) keyPath.splice(change.depth, keyPath.length - change.depth);
        if (change.key != undefined) {
          keyPath.push(change.key)
        }
        if (change.index != undefined) {
          keyPath.push(change.index)
        }
        callback(keyPath, change)
      }
    }

    sharedState.notifyListeners("onwillchangesate", diff, changes, forEachChangedKeyPath);
    sharedState._state = toState;
    sharedState.notifyListeners("onchangedstate", diff, changes, forEachChangedKeyPath);

    return toState
  }

  changeListFromDiff(diff, was, is, retChanges, depth) {
    if (!diff) return retChanges;

    depth = depth || 0

    retChanges = retChanges || []
    if (!depth) {
      retChanges.push({
        depth: -1,
        was,
        is
      })
    }

    const sharedState = this;

    if (diff.objectDiff) {
      for (const [key, childDiff] of Object.entries(diff.objectDiff)) {
        const wasChild = typeof was == "object" && !Array.isArray(was) ? was[key] : undefined,
          isChild = typeof is == "object" && !Array.isArray(is) ? is[key] : undefined

        retChanges.push({
          depth,
          key,
          was: wasChild,
          is: isChild
        });

        if (isChild === undefined || wasChild === undefined) {
          continue
        }

        sharedState.changeListFromDiff(
          childDiff,
          wasChild,
          isChild,
          retChanges,
          depth + 1
        );
      }
    } else if (diff.arrayDiff) {
      let deletes = 0,
        inserts = 0
      const wasArray = Array.isArray(was) ? was : [];
      const isArray = Array.isArray(is) ? is : [];
      for (const childDiff of diff.arrayDiff) {
        if (childDiff.at) {
          const wasIndex = childDiff.at - inserts + deletes,
            isIndex = childDiff.at,
            wasChild = wasArray[wasIndex],
            isChild = isArray[isIndex]

          retChanges.push({
            depth,
            index: isIndex,
            was: wasChild,
            is: isChild
          });
          sharedState.changeListFromDiff(
            childDiff,
            wasChild,
            isChild,
            retChanges,
            depth + 1
          );
        } else if (childDiff.deleteAt) {
          const wasIndex = childDiff.deleteAt - inserts + deletes,
            wasChild = wasArray[wasIndex]

          retChanges.push({
            depth,
            index: childDiff.deleteAt,
            was: wasChild
          });

          deletes++
        } else if (childDiff.insertAt) {
          const isIndex = childDiff.insertAt,
            isChild = isArray[isIndex]

          retChanges.push({
            depth,
            index: childDiff.insertAt,
            is: isChild,
          });

          inserts++
        }
      }
    }

    return retChanges
  }

}

makeClassWatchable(SharedState);

// API is the public facing class
module.exports = PublicApi({
  fromClass: SharedState,
  hasExposedBackDoor: true
});