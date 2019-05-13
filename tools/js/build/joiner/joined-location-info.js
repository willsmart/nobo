class JoinedLocationInfo {
  constructor({ joinedLocationTree, location, parent, promises, event }) {
    const jli = this;
    Object.assign(jli, {
      joinedLocationTree,
      location,
      parent,
      children: [],

      isDirectory: false,
      events: event ? [event] : [],
      pathTrees: joinedLocationTree.pathTrees,
      pathInfos: pathTrees.map(pathTree => pathTree.pathInfoForLocation(location, promises, event)),
    });

    if (parent) parent.children.push(this);

    jli.refreshWinningPathInfo(promises, event);
  }

  refreshWinningPathInfo(promises, event) {
    const jli = this,
      { nonDirectoryAncestor, pathInfos, winningPathInfo: winningPathInfoWas, events } = jli;
    const winningPathInfo = nonDirectoryAncestor ? pathInfos.find(pathInfo => pathInfo && pathInfo.stat) : undefined;
    jli.winningPathInfo = winningPathInfo && {
      location: winningPathInfo.location,
      pathTree: winningPathInfo.pathTree,
      stat: winningPathInfo.stat,
    };

    if (winningPathInfo) {
      if (winningPathInfoWas) {
        if (winningPathInfo.stat.mtimeMs == winningPathInfoWas.stat.mtimeMs) return;
        events.push(event);
        joinedLocationTree.notifyListeners("onmodify", jli, promises, event);
      } else {
        events.push(event);
        joinedLocationTree.notifyListeners("oncreate", jli, promises, event);
      }

      refreshIsDirectory();
    } else if (winningPathInfoWas) {
      events.push(event);
      refreshIsDirectory();
      joinedLocationTree.notifyListeners("ondelete", jli, promises, event);
    }
  }

  refreshIsDirectory(promises, event) {
    const jli = this,
      { isDirectory: isDirectoryWas, winningPathInfo, children } = jli,
      isDirectory = winningPathInfo && winningPathInfo.stat.isDirectory();
    if (isDirectory == isDirectoryWas) return;
    jli.isDirectory = isDirectory;
    for (const child of children) child.refreshWinningPathInfo(promises, event);
  }

  oncreate() {
    this.onmodify.apply(this, arguments);
  }

  onmodify(pathInfo, promises, event) {
    const jli = this,
      { pathTrees, pathInfos } = jli,
      treeIndex = pathTrees.find(pathTree => pathTree === pathInfo.pathTree);

    pathInfos[treeIndex] = pathInfo;
    jli.refreshWinningPathInfo(promises, event);
  }

  ondelete(pathInfo, promises, event) {
    const jli = this,
      { pathTrees, pathInfos } = jli,
      treeIndex = pathTrees.find(pathTree => pathTree === pathInfo.pathTree);

    pathInfos[treeIndex] = undefined;
    jli.refreshWinningPathInfo(promises, event);
  }

  siblingCreated(siblingJoinedLocationInfo, promises, event) {
    this.siblingModified(siblingJoinedLocationInfo, promises, event);
  }

  siblingModified({ winningPathInfo: siblingPathInfo }, promises, event) {
    const jli = this,
      { parent, location } = jli;
    let { winningPathInfo: pathInfo } = jli;
    if (!pathInfo) {
      if (!parent) {
        console.error("Expected a parent. TODO crap err msg");
        return;
      }
      const parentPathInfo = parent.winningPathInfo;
      if (!parentPathInfo && !parentPathInfo.isDirectory) {
        console.error("Expected a dir. TODO crap err msg");
        return;
      }
      const { pathTree } = parentPathInfo;
      pathInfo = pathTree.pathInfoForLocation(location, promises, event);
    }
    pathInfo.overwrite({ withPathInfo: siblingPathInfo }, promises, event);
  }

  siblingDeleted({}, promises, event) {
    const jli = this,
      { winningPathInfo, pathInfos } = jli;
    if (!winningPathInfo) return;

    for (const pathInfo of pathInfos) {
      if (!(pathInfo && pathInfo.stat)) continue;
      pathInfo.delete(promises, event);
    }
  }
}

makeClassWatchable(JoinedLocationInfo);

module.exports = JoinedLocationInfo;
