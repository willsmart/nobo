const makeClassWatchable = require('../../general/watchable'),
  makeClassJobable = require('../../general/jobable'),
  fs = require('fs'),
  { promisify } = require('util'),
  stat_p = promisify(fs.stat),
  readdir_p = promisify(fs.readdir);

// A FsPathInfo holds information about a path on the filesystem
class FsPathInfos {
  constructor(root) {
    const pathInfos = this,
      rootPathInfo = new FsPathInfo(root),
      callbackKey = `FsPathInfos:${root}`,
      jobsByPath = {};

    Object.assign(pathInfos, {
      root,
      rootPathInfo,
      callbackKey,
      jobsByPath
    });

    rootPathInfo.watch({
      callbackKey,
      created: pathInfo => {
        pathInfos.notifyListeners('created', pathInfo, pathInfos);
      },
      deleted: pathInfo => {
        pathInfos.notifyListeners('deleted', pathInfo, pathInfos);
      },
      modified: pathInfo => {
        pathInfos.notifyListeners('modified', pathInfo, pathInfos);
      }
    });
  }

  pathForRelPath(relPath) {
    return `${this.root}${relPath}`;
  }

  refresh(promises) {
    this.rootPathInfo.refresh(promises);
  }
}

class FsPathInfo {
  // get cached path info
  constructor(pathInfos, path, relPath = '', parent, root) {
    const pathInfo = this;
    Object.assign(pathInfo, {
      pathInfos,
      parent,
      root: root || pathInfo,
      path,
      relPath,
      stat: undefined,
      fsWatcher: undefined,
      files: {}
    });
    pathInfo.watchFile();
  }

  refresh(promises) {
    const pathInfo = this,
      { path } = pathInfo;
    promises.push(
      stat_p(path)
        .then(stat => {
          pathInfo.setStat(stat, promises);
        })
        .catch(err => {
          console.error(err.stack);
          pathInfo.setStat(undefined, promises);
        })
    );
  }

  queueJob({ job, key = 'default' }) {
    const pathInfo = this,
      newJob = pathInfo.jobsByKey != undefined,
      jobsByKey = pathInfo.jobsByKey || (pathInfo.jobsByKey = {});
    jobsByKey[key] = job;
    if (newJob) {
      pathInfo.pathInfos.queueAsyncJob(promises => {
        for (const job of Object.values(jobsByKey)) {
          if (job) {
            const promise = job(promises);
            if (promise && typeof promise == 'object' && typeof promise.then == 'fucnction') {
              promises.push(promise);
            }
          }
        }
        pathInfo.jobsByKey = undefined;
      });
    }
  }

  setStat(stat, promises) {
    const pathInfo = this,
      { path, stat: statWas, root } = pathInfo;
    pathInfo.stat = stat;

    if (stat && stat.isDirectory()) {
      promises.push(
        readdir_p(path)
          .then(files => {
            pathInfo.setFiles(files, promises);
          })
          .catch(err => {
            console.error(`Could not readdir ${path}`, err.stack);
          })
      );
    } else pathInfo.setFiles([], promises);

    if (!statWas) {
      if (stat) root.notifyListeners('created', pathInfo);
    } else if (!stat) {
      root.notifyListeners('deleted', pathInfo);
      pathInfo.unwatchFile();
    } else if (stat.mtimeMs != statWas.mtimeMs) root.notifyListeners('modified', pathInfo);
  }

  setFiles(files, promises) {
    const pathInfo = this,
      { path, relPath, files: byFileWas, root } = pathInfo,
      byFile = {};

    for (const file of files) {
      if (byFileWas[file]) byFile[file] = byFileWas[file];
      else {
        const fileInfo = (byFile[file] = new FsPathInfo(`${path}/${file}`, `${relPath}/${file}`, pathInfo, root));
        fileInfo.refresh(promises);
      }
    }

    pathInfo.files = byFile;
  }

  watchFile() {
    const pathInfo = this,
      { path, fsWatcher, pathInfos } = pathInfo;
    if (fsWatcher) return;
    pathInfo.fsWatcher = fs.watch(path, {}, () => {
      pathInfos.queueAsyncJob(promises => pathInfo.refresh(promises));
    });
  }

  unwatchFile() {
    const pathInfo = this,
      { fsWatcher } = pathInfo;
    if (!fsWatcher) return;
    pathInfo.fsWatcher = undefined;
    fsWatcher.close();
  }
}

makeClassWatchable(FsPathInfos);
makeClassJobable(FsPathInfos);
makeClassWatchable(FsPathInfo);

module.exports = FsPathInfos;
