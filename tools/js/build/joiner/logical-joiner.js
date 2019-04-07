const makeClassWatchable = require('../../general/watchable'),
  PathInfoAggregator = require('./path-info-aggregator'),
  { clearPromises } = require('../../general/general'),
  FsPathInfos = require('./fs-path-infos');

class LogicalJoiner {
  constructor(joinRoot, aggregateRoots) {
    const joiner = this,
      joinPathInfos = new FsPathInfos(joinRoot),
      pathInfoAggregator = new PathInfoAggregator(aggregateRoots),
      infoByRelPath = {},
      syncTree = {},
      jobs = [],
      callbackKey = `JoinedPathInfos:${joinRoot}`;
    Object.assign(joiner, {
      joinRoot,
      joinPathInfos,
      aggregateRoots,
      pathInfoAggregator,
      infoByRelPath,
      callbackKey,
      syncTree,
      jobs,
      refreshed: false,
      _jobTimeout: undefined,
      _hasOutstandingJob: false,
      jobTimeoutMs: 200
    });

    joinPathInfos.watch({
      callbackKey,
      created: pathInfo => {
        const { relPath } = pathInfo;
        const info = joiner.infoForRelPath(relPath);
        info.joinedPathInfo = pathInfo;
        joiner.setAction(info);
      },
      deleted: pathInfo => {
        const { relPath } = pathInfo;
        if (!relPath in infoByRelPath) return;
        const info = infoByRelPath[relPath];
        info.joinedPathInfo = { deltimeMS: new Date().getTime() };
        joiner.setAction(info);
      },
      modified: pathInfo => {
        const { relPath } = pathInfo;
        const info = joiner.infoForRelPath(relPath);
        info.joinedPathInfo = pathInfo;
        joiner.setAction(info);
      },
      job: ({ relPath }, job) => {
        joiner.queueJob(job);
      }
    });

    pathInfoAggregator.watch({
      callbackKey,
      created: pathInfo => {
        const { relPath } = pathInfo;
        const info = joiner.infoForRelPath(relPath);
        info.aggregatePathInfo = pathInfo;
        joiner.setAction(info);
      },
      deleted: pathInfo => {
        const { relPath } = pathInfo;
        if (!relPath in infoByRelPath) return;
        const info = infoByRelPath[relPath];
        info.aggregatePathInfo = { deltimeMS: new Date().getTime() };
        joiner.setAction(info);
      },
      modified: pathInfo => {
        const { relPath } = pathInfo;
        const info = joiner.infoForRelPath(relPath);
        info.aggregatePathInfo = pathInfo;
        joiner.setAction(info);
      },
      job: (_pathInfo, job) => {
        joiner.queueJob(job);
      }
    });

    joiner.queueJob(promises => joiner.refresh(promises));
  }

  infoForRelPath(relPath) {
    const joiner = this,
      { infoByRelPath } = joiner;
    let info = infoByRelPath[relPath];
    if (info) return info;
    info = infoByRelPath[relPath] = {
      relPath,
      joinedPathInfo: undefined,
      aggregatePathInfo: undefined,
      parent: undefined
    };
    const slashIndex = relPath.lastIndexOf('/');
    if (slashIndex != -1) info.parent = joiner.infoForRelPath(relPath.substring(0, slashIndex));
    return info;
  }

  setAction(info) {
    const joiner = this,
      { joinPathInfos } = joiner,
      { relPath, joinedPathInfo, aggregatePathInfo, parent } = info;
    const { joinedPathInfo, aggregatePathInfo } = info;
    const joinedExists = joinedPathInfo && joinedPathInfo.stat,
      aggregateExists = aggregatePathInfo && aggregatePathInfo.stat,
      joinedMtimeMs = joinedExists ? joinedPathInfo.stat.mtimeMs : (joinedPathInfo && joinedPathInfo.deltimeMS) || 0,
      aggregateMtimeMs = aggregateExists
        ? aggregatePathInfo.stat.mtimeMs
        : (aggregatePathInfo && aggregatePathInfo.deltimeMS) || 0;

    if (joinedExists) {
      if (aggregateExists) {
        if (joinedMtimeMs < aggregateMtimeMs) {
          joinedPathInfo.queueJob({
            key: 'join-action',
            job: () => {
              aggregatePathInfo.copyTo({ destPath: joinedPathInfo.path });
            }
          });
        } else if (joinedMtimeMs > aggregateMtimeMs) {
          aggregatePathInfo.queueJob({
            key: 'join-action',
            job: () => {
              joinedPathInfo.copyTo({ destPath: aggregatePathInfo.path });
            }
          });
        }
      } else if (aggregateMtimeMs > joinedMtimeMs) {
        joinedPathInfo.queueJob({
          key: 'join-action',
          job: () => {
            joinedPathInfo.delete();
          }
        });
      } else {
        joinedPathInfo.queueJob({
          key: 'join-action',
          job: () => {
            joinedPathInfo.copyTo({ destPath: pathInfoAggregator.pathForRelPath(relPath) });
          }
        });
      }
    } else if (aggregateExists) {
      if (joinedMtimeMs > aggregateMtimeMs) {
        const { aggregationInfoByRelPath } = pathInfoAggregator,
          aggregationInfo = aggregationInfoByRelPath[relPath];
        if (aggregationInfo) {
          const pathInfos = Object.values(aggregationInfo.byPath);
          for (const pathInfo of pathInfos) {
            pathInfo.queueJob({
              key: 'join-action',
              job: () => {
                pathInfo.delete();
              }
            });
          }
        }
      } else {
        aggregatePathInfo.queueJob({
          key: 'join-action',cxh
          job: () => {
            aggregatePathInfo.copyTo({ destPath: pathInfoAggregator.pathForRelPath(relPath) });
          }
        });
        joiner.notifyListeners('copy', {
          source: aggregatePathInfo,
          destinationPath: joinPathInfos.pathForRelPath(relPath),
          type: 'pullForward'
        });
      }
    }
  }
  queueSync(relPath) {
    const joiner = this,
      info = joiner.infoForRelPath(relPath);
    joiner._queueSync(info);
    joiner.queueSyncRun();
  }

  queueAllSyncs(relPath) {
    const joiner = this,
      { infoByRelPath } = joiner;
    for (const info of Object.values(infoByRelPath)) joiner._queueSync(info);
    joiner.queueSyncRun();
  }

  _queueSync({ relPath, parent }) {
    const joiner = this;
    let syncTree = parent ? joiner._queueSync(parent) : joiner.syncTree;
    return syncTree[relPath] || (syncTree[relPath] = {});
  }

  queueSyncRun() {
    const joiner = this,
      { _syncTimeout, syncTimeoutMs } = joiner;

    joiner._hasOutstandingSync = true;
    if (_syncTimeout) return;

    joiner._syncTimeout = setTimeout(async () => {
      joiner._hasOutstandingSync = false;
      await joiner.runSyncs();
      joiner._syncTimeout = undefined;
      if (joiner._hasOutstandingSync) await joiner.queueSyncRun();
    }, syncTimeoutMs);
  }

  async runSyncs() {
    const joiner = this,
      { syncTree, infoByRelPath, joinPathInfos, pathInfoAggregator } = joiner;
    joiner.syncTree = {};

    _runSyncs(syncTree, '', 0, 0);
    function _runSyncs(syncTree, relPath, joinedAncestorCtimeMs, aggregateAncestorCtimeMs) {
      const info = infoByRelPath[relPath];
      if (!info) return;
      const { joinedPathInfo, aggregatePathInfo } = info;
      const joinedExists = joinedPathInfo && joinedPathInfo.stat,
        aggregateExists = aggregatePathInfo && aggregatePathInfo.stat,
        joinedMtimeMs = joinedExists
          ? Math.max(joinedPathInfo.stat.mtimeMs, joinedAncestorCtimeMs)
          : (joinedPathInfo && joinedPathInfo.deltimeMS) || 0,
        aggregateMtimeMs = aggregateExists
          ? Math.max(aggregatePathInfo.stat.mtimeMs, aggregateAncestorCtimeMs)
          : (aggregatePathInfo && aggregatePathInfo.deltimeMS) || 0;

      if (joinedExists) {
        if (aggregateExists) {
          if (joinedMtimeMs < aggregateMtimeMs) {
          } else if (joinedMtimeMs > aggregateMtimeMs) {
            joiner.notifyListeners('overwrite', {
              source: joinedPathInfo,
              destination: aggregatePathInfo,
              type: 'pushBack'
            });
          }
        } else if (aggregateMtimeMs > joinedMtimeMs) {
          joiner.notifyListeners('delete', {
            path: joinedPathInfo.path,
            type: 'pullForward'
          });
        } else {
          joiner.notifyListeners('copy', {
            source: joinedPathInfo,
            destinationPath: pathInfoAggregator.pathForRelPath(relPath),
            type: 'pushBack'
          });
        }
      } else if (aggregateExists) {
        if (joinedMtimeMs > aggregateMtimeMs) {
          const { aggregationInfoByRelPath } = pathInfoAggregator,
            aggregationInfo = aggregationInfoByRelPath[relPath];
          if (aggregationInfo) {
            const paths = Object.keys(aggregationInfo.byPath);
            for (const path of paths) {
              joiner.notifyListeners('delete', { path, type: 'pushBack' });
            }
          }
        } else {
          joiner.notifyListeners('copy', {
            source: aggregatePathInfo,
            destinationPath: joinPathInfos.pathForRelPath(relPath),
            type: 'pullForward'
          });
        }
      }

      for (const [childRelPath, childSyncTree] of Object.entries(syncTree)) {
        _runSyncs(
          childSyncTree,
          childRelPath,
          Math.max(joinedAncestorCtimeMs, joinedExists ? joinedPathInfo.stat.ctimeMs : 0),
          Math.max(aggregateAncestorCtimeMs, aggregateExists ? aggregatePathInfo.stat.ctimeMs : 0)
        );
      }
    }
  }

  queueJob(job) {
    const joiner = this,
      { jobs } = joiner;
    jobs.push(job);
    joiner.queueJobRun();
  }

  queueJobRun() {
    const joiner = this,
      { _jobTimeout, jobTimeoutMs } = joiner;

    joiner._hasOutstandingJob = true;
    if (_jobTimeout) return;

    joiner._jobTimeout = setTimeout(async () => {
      joiner._hasOutstandingJob = false;
      await joiner.runJobs();
      joiner._jobTimeout = undefined;
      if (joiner._hasOutstandingJob) await joiner.queueJobRun();
      joiner.refreshed = true;
    }, jobTimeoutMs);
  }

  async runJobs() {
    const joiner = this,
      { jobs } = joiner;
    joiner.jobs = [];

    const promises = [];
    for (const job of jobs) {
      try {
        job(promises);
      } catch (err) {
        console.error(err.stack);
      }
    }
    await clearPromises(promises);
  }

  refresh(promises) {
    this.joinPathInfos.refresh(promises);
    this.pathInfoAggregator.refresh(promises);
  }

  syncAll() {
    const joiner = this,
      { infoByRelPath } = joiner;
    for (const relPath of Object.keys(infoByRelPath)) joiner.syncPath(relPath);
  }

  syncPath(relPath) {
    const joiner = this,
      { infoByRelPath, refreshed } = joiner,
      info = infoByRelPath[relPath],
      { joinedPathInfo, aggregatePathInfo } = info;
    if (!refreshed) return;
    let isPushBack = false;
    if (joinedPathInfo && joinedPathInfo.stat) {
      if (
        !(aggregatePathInfo && aggregatePathInfo.stat) ||
        joinedPathInfo.stat.mtimeMs > aggregatePathInfo.stat.mtimeMs
      )
        isPushBack = true;
    }
    if (isPushBack) joiner.pushBack(relPath);
    else joiner.pullForward(relPath);
  }

  pullForward(relPath) {
    const joiner = this,
      { infoByRelPath, joinPathInfos, refreshed } = joiner,
      info = infoByRelPath[relPath],
      { joinedPathInfo, aggregatePathInfo } = info;
    if (!refreshed) return;
    if (aggregatePathInfo) {
      if (joinedPathInfo) {
        joiner.notifyListeners('overwrite', {
          source: aggregatePathInfo,
          destination: joinedPathInfo,
          type: 'pullForward'
        });
      } else {
        joiner.notifyListeners('create', {
          source: aggregatePathInfo,
          destination: { path: joinPathInfos.pathForRelPath(relPath), relPath },
          type: 'pullForward'
        });
      }
    } else if (joinedPathInfo) {
      joiner.notifyListeners('delete', { path: joinedPathInfo.path, type: 'pullForward' });
    }
  }

  pushBack(relPath) {
    const joiner = this,
      { infoByRelPath, pathInfoAggregator, refreshed } = joiner,
      info = infoByRelPath[relPath],
      { joinedPathInfo, aggregatePathInfo } = info;
    if (!refreshed) return;
    if (joinedPathInfo) {
      if (aggregatePathInfo) {
        joiner.notifyListeners('overwrite', {
          source: joinedPathInfo,
          destination: aggregatePathInfo,
          type: 'pushBack'
        });
      } else {
        joiner.notifyListeners('create', {
          source: joinedPathInfo,
          destination: { path: pathInfoAggregator.pathForRelPath(relPath), relPath },
          type: 'pushBack'
        });
      }
    } else {
      const { aggregationInfoByRelPath } = pathInfoAggregator,
        aggregationInfo = aggregationInfoByRelPath[relPath];
      if (aggregationInfo) {
        const paths = Object.keys(aggregationInfo.byPath);
        for (const path of paths) {
          joiner.notifyListeners('delete', { path, type: 'pushBack' });
        }
      }
    }
  }
}

makeClassWatchable(LogicalJoiner);

module.exports = LogicalJoiner;
