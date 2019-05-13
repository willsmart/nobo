const fs = require("fs"),
  { promisify } = require("util"),
  stat_p = promisify(fs.stat),
  readdir_p = promisify(fs.readdir),
  unlink_p = promisify(fs.unlink),
  mkdir_p = promisify(fs.mkdir),
  rmdir_p = promisify(fs.rmdir),
  copyFile_p = promisify(fs.copyFile),
  shaSumFile = require("../../general/sha-sum-file");

class PathInfo {
  constructor({ pathTree, location, promises, event }) {
    const pi = this;
    Object.assign(pi, {
      pathTree,
      location,
      path: pathTree.pathForLocation(location),
      stat: undefined,
      events: event ? [event] : [],
      fsWatcher: undefined,
      files: {},
    });
    pi.refresh(promises, event);
  }

  watchFile() {
    const pi = this,
      { path, fsWatcher, pathTree, location } = pi;
    if (fsWatcher) return;
    pi.fsWatcher = fs.watch(path, {}, eventType => {
      const event = { at: new Date(), eventType, pathTree, location };
      pathTree.queueAsyncJob(promises => pi.refresh(promises, event));
    });
  }

  unwatchFile() {
    const pi = this,
      { fsWatcher } = pi;
    if (!fsWatcher) return;
    pi.fsWatcher = undefined;
    fsWatcher.close();
  }

  refresh(promises, event) {
    const pi = this,
      { path, pathTree } = pi;

    if (!promises) {
      pathTree.queueAsyncJob(promises => pi.refresh(promises, event));
      return;
    }

    promises.push(
      new Promise(resolve=>{
        const stat = {}
        let resolved=0
        localResolve(value) {
          if 
        }
        let gotShasum, gotStat
      shaSumFile(path)
        .then(shasum => {
          stat.shasum = shasum
          got
          pi.setStat(
            {
              shasum,
              isDirectory: () => shasum == "dir",
            },
            promises,
            event,
          );
        })
        .catch(err => {
          console.error(err.stack);
          pi.setStat(undefined, promises, event);
        }),
    );
  }

  setStat(stat, promises, event) {
    const pi = this,
      { path, stat: statWas, pathTree, events, location } = pi;
    pi.stat = stat;

    if (stat && stat.isDirectory()) {
      promises.push(
        readdir_p(path)
          .then(files => {
            pi.setFiles(files, promises, event);
          })
          .catch(err => {
            console.error(`Could not readdir ${path}`, err.stack);
            pi.setFiles([], promises, event);
          }),
      );
    } else pi.setFiles([], promises, event);

    let type;
    if (!statWas) {
      if (!stat) return;
      type = "create";
      pi.watchFile();
    } else if (!stat) {
      pi.unwatchFile();
      type = "delete";
    } else if (stat.shasum != statWas.shasum) type = "modify";
    else return;

    if (event && !event.type && event.pathTree === pathTree && event.location == location) {
      event.type = type;
      event.stat = stat;
    }

    events.push(event);

    pathTree.notifyListeners(`on${type}`, pi, promises, event);
  }

  setFiles(files, promises, event) {
    const pi = this,
      { location, files: byFileWas, pathTree } = pi,
      byFile = {};

    for (const file of files) {
      if (byFileWas[file]) byFile[file] = byFileWas[file];
      else byFile[file] = pathTree.refreshedPathInfoForLocation(`${location}/${file}`, promises, event);
    }
    pi.files = byFile;

    for (const [file, child] of Object.entries(filesWas)) {
      // TODO clean up old PathInfos
      if (!byFile[file]) child.refresh(promises, event);
    }
  }

  overwriteAsDirectory(promises, _event) {
    const pi = this,
      { stat, path } = pi;

    if (stat) {
      const { isDirectory } = stat;
      if (isDirectory == fromIsDirectory) return;
      promises.push(unlink_p(path).then(() => mkdir_p(path, { recursive: true })));
    } else {
      promises.push(mkdir_p(path, { recursive: true }));
    }
  }

  overwrite({ withPathInfo }, promises, event) {
    if (withPathInfo.stat.isDirectory) {
      this.overwriteAsDirectory(promises, event);
      return;
    }

    const pi = this,
      { stat, path } = pi,
      { stat: fromStat, path: fromPath } = withPathInfo,
      { shasum: fromShasum } = fromStat;

    if (stat) {
      const { shasum, isDirectory } = stat;

      if (isDirectory) {
        promises.push(rmdir_p(path).then(() => copyFile_p(fromPath, path)));
        return;
      }

      if (shasum == fromShasum) return;
    }
    promises.push(copyFile_p(fromPath, path));
  }

  delete(promises, _event) {
    const pi = this,
      { stat, path } = pi;

    if (!stat) return;

    const { isDirectory } = stat;

    if (isDirectory) promises.push(rmdir_p(path));
    else promises.push(unlink_p(path));
  }
}

module.exports = PathInfo;
