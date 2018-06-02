const PublicApi = require("../general/public-api");
const makeClassWatchable = require("../general/watchable");
const diffAny = require("../general/diff");
const { shallowCopy, shallowCopyObjectIfSame } = require("../general/clone");

// API is auto-generated at the bottom from the public interface of the SharedState class

// TemporaryState encapsulates the changes to the shared state object.
// To change the state object you request a commit witht he requestCommit method.
//  The callback you provide is passed a TemporaryState object, which you can modify using the atPath accessor
//
// eg
//  SharedState.requestCommit(temp=>{temp.atPath('datapoints',datapointId).name = 'newName'})
class TemporaryState {
  static publicMethods() {
    return ["atPath", "state", "current"];
  }

  static get current() {
    return SharedState.global.currentTemporaryState;
  }

  constructor({ fromState }) {
    const temporaryState = this;

    temporaryState._state = temporaryState.fromState = fromState;
  }

  get state() {
    return this._state;
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
    return ["global", "requestCommit", "state", "watch", "stopWatching", "currentTemporaryState", "withTemporaryState"];
  }

  constructor() {
    const sharedState = this;
    sharedState._state = {};
    sharedState.commitPromise = Promise.resolve();
  }

  static get state() {
    return SharedState.global.state;
  }

  get currentTemporaryState() {
    return this._currentTemporaryState;
  }

  withTemporaryState(callback) {
    const sharedState = this,
      currentTemporaryState = sharedState.currentTemporaryState;

    if (currentTemporaryState) callback(currentTemporaryState);
    else {
      sharedState.requestCommit(temp => {
        callback(temp);
      });
    }
  }

  get state() {
    return this._state;
  }

  static get global() {
    return globalSharedState ? globalSharedState : (globalSharedState = new SharedState());
  }

  static requestCommit(modifyStateCallback) {
    SharedState.global.requestCommit(modifyStateCallback);
  }

  async requestCommit(modifyStateCallback) {
    const sharedState = this;

    sharedState.commitPromise = sharedState.commitPromise.then(() => {
      let temporaryState = new TemporaryState({
        fromState: sharedState.state
      });
      sharedState._currentTemporaryState = temporaryState;
      modifyStateCallback(temporaryState);

      let commitTemporaryState;
      while (true) {
        commitTemporaryState = sharedState._currentTemporaryState = new TemporaryState({
          fromState: temporaryState.state
        });

        if (
          sharedState.commit({
            toState: temporaryState.state
          }) === undefined
        )
          break;

        temporaryState = commitTemporaryState;
      }
      delete sharedState._currentTemporaryState;
    });

    await sharedState.commitPromise;
  }

  commit({ toState }) {
    const sharedState = this,
      fromState = sharedState.state;

    const diff = diffAny(fromState, toState);
    if (!diff) return;

    const changes = sharedState.changeListFromDiff(diff, fromState, toState);

    const forEachChangedKeyPath = callback => {
      let keyPath = [];
      for (const change of changes) {
        if (change.depth < keyPath.length) keyPath.splice(change.depth, keyPath.length - change.depth);
        if (change.key != undefined) {
          keyPath.push(change.key);
        }
        if (change.index != undefined) {
          keyPath.push(change.index);
        }
        if (callback(keyPath, change)) {
          switch (change.type) {
            case "delete":
              forEachDeletedElement(change.depth, keyPath, change.was, callback);
              break;
            case "insert":
              forEachInsertedElement(change.depth, keyPath, change.is, callback);
              break;
          }
        }
      }

      function forEachDeletedElement(depth, keyPath, arrayOrObject, callback) {
        if (Array.isArray(arrayOrObject)) forEachDeletedArrayElement(depth, keyPath, arrayOrObject, callback);
        if (typeof arrayOrObject == "object") forEachDeletedObjectElement(depth, keyPath, arrayOrObject, callback);
      }

      function forEachInsertedElement(depth, keyPath, arrayOrObject, callback) {
        if (Array.isArray(arrayOrObject)) forEachInsertedArrayElement(depth, keyPath, arrayOrObject, callback);
        if (typeof arrayOrObject == "object") forEachInsertedObjectElement(depth, keyPath, arrayOrObject, callback);
      }

      function forEachDeletedArrayElement(depth, keyPath, array, callback) {
        keyPath.push(0);
        depth++;
        for (let index = array.length - 1; index >= 0; index--) {
          keyPath[keyPath.length - 1] = index;
          if (
            callback(keyPath, {
              type: "delete",
              depth,
              index,
              was: array[index]
            })
          ) {
            forEachDeletedElement(depth, keyPath, array[index], callback);
          }
        }
        keyPath.pop();
      }

      function forEachInsertedArrayElement(depth, keyPath, array, callback) {
        keyPath.push(0);
        depth++;
        for (let index = array.length - 1; index >= 0; index--) {
          keyPath[keyPath.length - 1] = 0;
          if (
            callback(keyPath, {
              type: "insert",
              depth,
              index: 0,
              is: array[index]
            })
          ) {
            forEachInsertedElement(depth, keyPath, array[index], callback);
          }
        }
        keyPath.pop();
      }

      function forEachDeletedObjectElement(depth, keyPath, object, callback) {
        keyPath.push(0);
        depth++;
        for (const [key, value] of Object.entries(object)) {
          keyPath[keyPath.length - 1] = key;
          if (
            callback(keyPath, {
              type: "delete",
              depth,
              key,
              was: value
            })
          ) {
            forEachDeletedElement(depth, keyPath, value, callback);
          }
        }
        keyPath.pop();
      }

      function forEachInsertedObjectElement(depth, keyPath, object, callback) {
        keyPath.push(0);
        depth++;
        for (const [key, value] of Object.entries(object)) {
          keyPath[keyPath.length - 1] = key;
          if (
            callback(keyPath, {
              type: "insert",
              depth,
              key,
              is: value
            })
          ) {
            forEachInsertedElement(depth, keyPath, value, callback);
          }
        }
        keyPath.pop();
      }
    };

    sharedState.notifyListeners("onwillchangesate", diff, changes, forEachChangedKeyPath, fromState, toState);
    sharedState._state = toState;
    sharedState.notifyListeners("onchangedstate", diff, changes, forEachChangedKeyPath, fromState, toState);

    return toState;
  }

  changeListFromDiff(diff, was, is, retChanges, depth) {
    if (!diff) return retChanges;

    depth = depth || 0;

    retChanges = retChanges || [];
    if (!depth) {
      retChanges.push({
        depth: -1,
        type: "change",
        was,
        is
      });
    }

    const sharedState = this;

    if (diff.objectDiff) {
      for (const [key, childDiff] of Object.entries(diff.objectDiff)) {
        const wasChild = typeof was == "object" && !Array.isArray(was) ? was[key] : undefined,
          isChild = typeof is == "object" && !Array.isArray(is) ? is[key] : undefined;

        retChanges.push({
          depth,
          type: wasChild === undefined ? "insert" : isChild === undefined ? "delete" : "change",
          key,
          was: wasChild,
          is: isChild
        });

        if (isChild === undefined || wasChild === undefined) {
          continue;
        }

        sharedState.changeListFromDiff(childDiff, wasChild, isChild, retChanges, depth + 1);
      }
    } else if (diff.arrayDiff) {
      let deletes = 0,
        inserts = 0;
      const wasArray = Array.isArray(was) ? was : [];
      const isArray = Array.isArray(is) ? is : [];
      for (const childDiff of diff.arrayDiff) {
        if (childDiff.at !== undefined) {
          const wasIndex = childDiff.at,
            isIndex = childDiff.at + inserts - deletes,
            wasChild = wasArray[wasIndex],
            isChild = isArray[isIndex];

          retChanges.push({
            depth,
            type: "change",
            index: wasIndex,
            was: wasChild,
            is: isChild
          });
          sharedState.changeListFromDiff(childDiff, wasChild, isChild, retChanges, depth + 1);
        } else if (childDiff.deleteAt !== undefined) {
          const wasIndex = childDiff.deleteAt,
            wasChild = wasArray[wasIndex];

          retChanges.push({
            depth,
            type: "delete",
            index: wasIndex,
            was: wasChild
          });

          deletes++;
        } else if (childDiff.insertAt !== undefined) {
          const wasIndex = childDiff.insertAt,
            isIndex = childDiff.insertAt + inserts - deletes,
            isChild = isArray[isIndex];

          retChanges.push({
            depth,
            type: "insert",
            index: wasIndex,
            is: isChild
          });

          inserts++;
        }
      }
    }

    return retChanges;
  }
}

makeClassWatchable(SharedState);

const SharedState_public = PublicApi({
  fromClass: SharedState,
  hasExposedBackDoor: true
});
SharedState_public.TemporaryState = PublicApi({
  fromClass: TemporaryState,
  hasExposedBackDoor: true
});

// API is the public facing class
module.exports = SharedState_public;
