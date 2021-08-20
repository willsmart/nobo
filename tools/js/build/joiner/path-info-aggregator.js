const makeClassWatchable = require('../../general/watchable'),
  FsPathInfos = require('./fs-path-infos');

// PathInfoAggregator aggregates notifications from some number of FsPathInfos's
class PathInfoAggregator {
  setSibling({ relPath, stat: theirStat }) {
    const { isDirectory: theirIsDir, isFile: theirIsFile } = theirStat || {};
    const aggregator = this,
      { aggregationInfoByRelPath } = aggregator,
      { suggestion } = aggregationInfoByRelPath[relPath] || {},
      { stat: myStat } = suggestion || {},
      { isDirectory: myIsDir, isFile: myIsFile } = myStat || {};
    if (theirIsDir) {
      if (myIsDir) return;
      aggregator.queueAsyncJob(promises => {
        if (myIsFile) aggregator.deleteFile(promises, { relPath, notify: false });
        aggregator.createDir(promises, { relPath, notify: false });
      });
    } else if (theirIsFile) {
      if (myIsFile) {
        aggregator.queueAsyncJob(promises => {
          aggregator.copyFileContents(promises, { relPath, notify: false });
        });
      } else {
        aggregator.queueAsyncJob(promises => {
          if (myIsDir) aggregator.deleteDir(promises, { relPath, notify: false });
          aggregator.copyFile(promises, { relPath, notify: false });
        });
      }
    } else {
      if (myIsFile) {
        aggregator.queueAsyncJob(promises => {
          aggregator.deleteFile(promises, { relPath, notify: false });
        });
      } else if (myIsDir) {
        aggregator.queueAsyncJob(promises => {
          aggregator.deleteDir(promises, { relPath, notify: false });
        });
      }
    }
  }

  constructor(roots) {
    const aggregator = this,
      pathInfosForRoots = roots.map(root => new FsPathInfos(root)),
      callbackKey = `PathInfoAggregator:${roots.join(',')}`,
      aggregationInfoByRelPath = {},
      rootOrdinals = {};
    roots.forEach((root, rootIndex) => {
      rootOrdinals[root] = rootIndex;
    });

    Object.assign(aggregator, {
      roots,
      rootOrdinals,
      pathInfosForRoots,
      aggregationInfoByRelPath,
      callbackKey
    });

    pathInfosForRoots.forEach((pathInfos, rootIndex) => {
      pathInfos.watch({
        callbackKey,
        created: pathInfo => {
          const { relPath } = pathInfo;
          const { infoByRootIndex } = aggregator.aggregationInfoForPath(relPath);
          infoByRootIndex[rootIndex] = pathInfo;
          aggregator.refreshAggregatedPathInfo(relPath);
        },
        deleted: pathInfo => {
          const { relPath } = pathInfo;
          const { infoByRootIndex } = aggregator.aggregationInfoForPath(relPath);
          infoByRootIndex[rootIndex] = { deltimeMS: new Date().getTime() };
          aggregator.refreshAggregatedPathInfo(relPath);
        },
        modified: pathInfo => {
          const { relPath } = pathInfo;
          const { infoByRootIndex } = aggregator.aggregationInfoForPath(relPath);
          infoByRootIndex[rootIndex] = pathInfo;
          aggregator.refreshAggregatedPathInfo(relPath);
        },
        job: (pathInfo, job) => {
          aggregator.notifyListeners('job', pathInfo, job);
        }
      });
    });
  }

  async runJobs() {
    await Promise.all(this.pathInfosForRoots.map(pathInfos => pathInfos.runJobs()));
  }

  refresh(promises, { notify } = {}) {
    for (const pathInfos of this.pathInfosForRoots) pathInfos.refresh(promises, { notify });
  }

  aggregationInfoForRelPath(relPath) {
    const aggregator = this,
      { aggregationInfoByRelPath } = aggregator;
    let info = aggregationInfoByRelPath[relPath];
    if (info) return info;
    info = aggregationInfoByRelPath[relPath] = { relPath, suggestion: undefined, infoByRootIndex: [] };
    const match = /^(.*)\/[^/]+/.exec(relPath);
    if (match) info.parent = aggregator.aggregationInfoForRelPath(match[1]);
    return info;
  }

  refreshAggregatedPathInfo(relPath) {
    const aggregator = this,
      { aggregationInfoByRelPath, rootOrdinals } = aggregator,
      aggregatedPathInfo = aggregationInfoByRelPath[relPath],
      { suggestion: suggestionWas, byPath } = aggregatedPathInfo;
    const inOrder = (aggregatedPathInfo.inOrder = Object.values(byPath).sort(
      ({ root: a }, { root: b }) => rootOrdinals[a] - rootOrdinals[b]
    ));
    if (inOrder.length) {
      const { pathInfo } = inOrder[0];
      if (suggestionWas) {
        if (suggestionWas.stat.mtimeMs == pathInfo.stat.mtimeMs) return;
        const suggestion = (aggregatedPathInfo.suggestionsuggestion, aggregator);
      } else {
        const suggestion = (aggregatedPathInfo.suggestion = pathInfo);
        aggregator.notifyListeners('created', suggestion, aggregator);
      }
    } else if (suggestionWas) {
      delete aggregationInfoByRelPath[relPath];
      aggregator.notifyListeners('deleted', aggregator);
    }
  }

  pathForRelPath(relPath) {
    const aggregator = this,
      { roots, aggregationInfoByRelPath } = aggregator,
      info = aggregationInfoByRelPath[relPath],
      parts = relPath.split(/\//g).slice(1);
    if (info && info.inOrder.length) {
      return info.inOrder[0].pathInfo.path;
    }

    for (let partCount = parts.length - 1; partCount > 0; partCount--) {
      const relPath = parts.slice(0, partCount).join('/'),
        info = aggregationInfoByRelPath[relPath];
      if (info && info.inOrder.length) {
        return info.inOrder[0].pathInfo.path + '/' + parts.slice(partCount).join('/');
      }
    }

    return `${roots[0]}${relPath}`;
  }
}

makeClassWatchable(PathInfoAggregator);

module.exports = PathInfoAggregator;
