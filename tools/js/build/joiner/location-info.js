class LocationInfo {
  constructor({ locationTree, location, promises, event }) {
    const li = this;
    Object.assign(li, {
      locationTree,
      location,
      events: event ? [event] : [],
      pathTrees: locationTree.pathTrees,
      pathInfos: pathTrees.map(pathTree => pathTree.pathInfoForLocation(location, promises, event)),
    });

    li.winningPathInfo = li.pathInfos.find(pathInfo => pathInfo);
    if (li.winningPathInfo) locationTree.addRefToLocation(location, promises, event);
  }

  oncreate() {
    this.onmodify.apply(this, arguments);
  }

  onmodify(pathInfo, promises, event) {
    const li = this,
      { pathTrees, pathInfos, winningPathInfo: winningPathInfoWas, locationTree, location, events } = li,
      treeIndex = pathTrees.find(pathTree => pathTree === pathInfo.pathTree),
      pathInfoWas = pathInfos[treeIndex];

    pathInfos[treeIndex] = pathInfo;

    if (!pathInfoWas) {
      li.winningPathInfo = pathInfos.find(pathInfo => pathInfo);
    }
    if (pathInfo === li.winningPathInfo) {
      events.push(event);

      if (winningPathInfoWas) locationTree.touchLocation(location, promises, event);
      else locationTree.addRefToLocation(location, promises, event);
    }
  }

  ondelete(pathInfo, promises, event) {
    const li = this,
      { pathTrees, pathInfos, locationTree, events } = li,
      treeIndex = pathTrees.find(pathTree => pathTree === pathInfo.pathTree),
      pathInfoWas = pathInfos[treeIndex];

    pathInfos[treeIndex] = undefined;

    if (pathInfoWas) {
      li.winningPathInfo = pathInfos.find(pathInfo => pathInfo);
      if (!li.winningPathInfo) {
        events.push(event);

        locationTree.removeRefToLocation(location, promises, event);
      }
    }
  }
}

makeClassWatchable(LocationInfo);

module.exports = LocationInfo;
