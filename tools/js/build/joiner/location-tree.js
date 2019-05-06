const makeClassWatchable = require("../../general/watchable"),
  LocationInfo = require("./location-info");

class LocationTree {
  constructor({ logicalTreeInfo, pathTrees }) {
    const lt = this;
    Object.assign(lt, {
      logicalTreeInfo,
      pathTrees,
      callbackKey: "LocationTree",
      locationInfos: {},
      locationInfoRefCounts: {},
    });
    lt.watchTreeInfos();
  }

  watchTreeInfos() {
    const lt = this,
      { pathTrees, callbackKey } = lt;
    pathTrees.forEach(pathTree =>
      pathTree.watch({
        callbackKey,
        oncreate: (pathInfo, promises, event) => {
          lt.locationInfoForLocation(pathInfo.location, promises, event).oncreate(pathInfo, promises, event);
        },
        onmodify: (pathInfo, promises, event) => {
          lt.locationInfoForLocation(pathInfo.location, promises, event).onmodify(pathInfo, promises, event);
        },
        ondelete: (pathInfo, promises, event) => {
          lt.locationInfoForLocation(pathInfo.location, promises, event).ondelete(pathInfo, promises, event);
        },
      }),
    );
  }

  unwatchTreeInfos() {
    const lt = this,
      { pathTrees, callbackKey } = lt;
    pathTrees.forEach(pathTree => pathTree.unwatch({ callbackKey }));
  }

  locationInfoForLocation(location, promises, event) {
    const lt = this,
      { locationInfos } = lt;
    return (
      locationInfos[location] ||
      (locationInfos[location] = new LocationInfo({ location, locationTree: lt, promises, event }))
    );
  }

  addRefToLocation(location, promises, event) {
    if (location === undefined) return;
    const lt = this,
      { locationInfoRefCounts } = lt;

    // add a ref to the implied parent folder
    lt.addRefToLocation(lt.parentOfLocation(location), promises, event);

    // add one to an existing count, or create one (ensuring that the location has been instantiated)
    if (locationInfoRefCounts[location]) locationInfoRefCounts[location]++;
    else {
      locationInfoRefCounts[location] = 1;

      lt.notifyListeners("oncreate", lt.locationInfoForLocation(location, promises, event), promises, event);
    }
  }

  removeRefToLocation(location, promises, event) {
    if (location === undefined) return;
    const lt = this,
      { locationInfos, locationInfoRefCounts } = lt,
      locationInfo = locationInfos[location];

    if (!locationInfo) return;

    // dec one from an existing count, or delete if too small (deleting the location too. TODO is deleting the li necessary/wanted?)
    if (locationInfoRefCounts[location] > 1) {
      locationInfoRefCounts[location]--;
    } else {
      delete locationInfoRefCounts[location];
      delete locationInfos[location];

      lt.notifyListeners("ondelete", locationInfo, promises, event);
    }

    // remove a ref from the implied parent folder
    lt.removeRefToLocation(lt.parentOfLocation(location), promises, event);
  }

  touchLocation(location, promises, event) {
    if (location === undefined) return;
    const lt = this,
      { locationInfos } = lt,
      locationInfo = locationInfos[location];

    if (!locationInfo) return;

    lt.notifyListeners("onmodify", locationInfo, promises, event);
  }

  static parentOfLocation(location) {
    const index = location.lastIndexOf("/");
    return index == -1 ? undefined : location.substring(0, index);
  }
}

makeClassWatchable(LocationTree);

module.exports = LocationTree;
