class LocationInfo {
  constructor({ logicalTreeInfo, location, treeInfos }) {
    const li = this;
    Object.assign(li, {
      logicalTreeInfo,
      location,
      trees: treeInfos.map(treeInfo => ({ treeInfo, pathInfo: treeInfo.pathInfoForLocation(location) })),
    });
    li.winner = li.trees.find(({ pathInfo }) => pathInfo);
    li.watchTreeInfos();
  }

  watchTreeInfos() {
    const li = this,
      { trees, location } = li;
    trees.forEach(({ treeInfo }) => treeInfo.watchPath({ location, listener: li }));
  }

  unwatchTreeInfos() {
    const li = this,
      { trees, location } = li;
    trees.forEach(({ treeInfo }) => treeInfo.unwatchPath({ location, listener: li }));
  }

  oncreate({ pathInfo }) {
    this.onmodify({ pathInfo });
  }

  onmodify({ pathInfo }) {
    const li = this,
      { trees, winner: winnerWas } = li,
      treeIndex = trees.find(({ treeInfo }) => treeInfo === pathInfo.treeInfo),
      tree = trees[treeIndex],
      { treeInfo, pathInfo: pathInfoWas } = tree;
    tree.pathInfo = pathInfo;
    if (!pathInfoWas) {
      li.winner = li.trees.find(({ pathInfo }) => pathInfo);
    }
    if (pathInfo === li.winner) {
      li.notifyListeners(winnerWas ? "onmodify" : "oncreate", { locationInfo: li });
    }
  }

  ondelete({ pathInfo }) {
    const li = this,
      { trees, winner: winnerWas } = li,
      treeIndex = trees.find(({ treeInfo }) => treeInfo === pathInfo.treeInfo),
      tree = trees[treeIndex],
      { treeInfo, pathInfo: pathInfoWas } = tree;
    tree.pathInfo = pathInfo;
    if (!pathInfoWas) {
      li.winner = li.trees.find(({ pathInfo }) => pathInfo);
    }
    if (pathInfo === li.winner) {
      li.notifyListeners(winnerWas ? "onmodify" : "oncreate", { locationInfo: li });
    }
  }
}
