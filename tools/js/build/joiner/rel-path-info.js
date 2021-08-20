const FsPathInfo = require('./fs-path-infos'),
fs = require('fs'),
  { promisify } = require('util'),
  stat_p = promisify(fs.stat),
  readdir_p = promisify(fs.readdir),
  _pathInfos = {};

let _currentVersionIndex = 1, roots, joinRoot;

// A RelPathInfo holds information about a path within the joined structure
class RelPathInfo {
  static setup({roots:aroots, joinRoot:ajoinRoot}) {
    roots=aroots.slice()
    joinRoot=ajoinRoot

    Object.values(_pathInfos).forEach(pi=>pi.refresh());
  }

  // get cached path info
  static with(path = '') {
    return _pathInfos[path] || (_pathInfos[path] = new PathInfo(path));
  }

  watch() {
    const pathInfo = this, {path} = pathInfo;
    fs.watch(path, {}, (eventType, filename) => {
      switch (eventType) {
        stat_p(path).then(stat=>{
          pathInfo
      }
    })
  }
  // return a promise for all files within the given roots
  static getAll(roots) {
    return Promise.all(roots.map(root => PathInfo.with(root).validateTree()));
  }

  constructor(root, path, key) {
    const match = /^(.*)\/([^\/]+)$/.exec(path);

    Object.assign(this, {
      parent: path ? PathInfo.with(root, match ? match[1] : '') : undefined,
      path,
      root,
      versions: {}
    });
  }

  refresh() {
    if (!roots && joinRoot) return;
    const pathInfo=this, {path}=pathInfo;

    stat_p(path).then(stat=>{pathInfo.setStat(stat)})
  }

  async setStat(stat) {
    const pathInfo=this, {path, stat:statWas}=pathInfo;
    pathInfo.stat = stat;

    if (stat.isDirectory != statWas.isDirectory || stat.isFile != statWas.isFile) {
        await pathInfo.setStat()
    }

    if (stat.isDirectory) {
      readdir_p(path).then(files=>{
        return pathInfo.setFiles(files)
      })
    }

    if (stat.isFile || ) {

    }
  }
      if (stat.isDirectory) {
        readdir_p(path).then(files=>{
          setAsDirectoryWithFiles(files, stat)
        })
      }
      else {

      }
    })
  }

  invalidateAll() {
    _currentVersionIndex++;
  }

  validateAll() {
    return Promise.all(Object.values(_pathInfos).map(pathInfo => pathInfo.validate()));
  }

  validate_p() {
    const pathInfo = this,
      promise = pathInfo.validate();
    return promise ? promise : Promise.resolve(pathInfo);
  }

  validate() {
    const pathInfo = this,
      currentVersionIndex = _currentVersionIndex,
      { fullPath } = pathInfo,
      version = pathInfo.currentVersion,
      { stat, validatePromise } = version;
    if (stat) return;

    return (
      validatePromise ||
      (version.validatePromise = stat_p(fullPath)
        .then(stat => {
          if (currentVersionIndex != _currentVersionIndex) return pathInfo.validate();

          Object.assign(version, {
            stat,
            validatePromise: undefined
          });

          if (stat && pathInfo.isDirectory) return pathInfo.validateChildren();
        })
        .catch(() => {
          if (currentVersionIndex != _currentVersionIndex) return pathInfo.validate();

          Object.assign(version, {
            stat: undefined,
            validatePromise: undefined
          });
        }))
    );
  }

  validateChildren_p() {
    const pathInfo = this,
      promise = pathInfo.validateChildren();
    return promise ? promise : Promise.resolve(pathInfo);
  }

  validateChildren() {
    const pathInfo = this,
      currentVersionIndex = _currentVersionIndex,
      { root, fullPath, path } = pathInfo,
      version = pathInfo.currentVersion,
      { stat, children, validateChildrenPromise } = version;
    if (!stat) return pathInfo.validate();
    if (children || !pathInfo.isDirectory) return;

    return (
      validateChildrenPromise ||
      (version.validateChildrenPromise = readdir_p(fullPath)
        .then(filenames => {
          filenames.sort();

          if (currentVersionIndex != _currentVersionIndex) return pathInfo.validate();

          Object.assign(version, {
            children: (filenames || []).map(filename => PathInfo.with(root, path ? `${path}/${filename}` : filename)),
            validateChildrenPromise: undefined
          });
        })
        .catch(() => {
          if (currentVersionIndex != _currentVersionIndex) return pathInfo.validate();

          Object.assign(version, {
            children: [],
            validateChildrenPromise: undefined
          });
        }))
    );
  }

  validateTree() {
    const pathInfo = this;

    return pathInfo.validate_p().then(() => {
      const children = pathInfo.children;
      if (!children) return;

      return Promise.all(children.map(child => child.validateTree())).then(() => undefined);
    });
  }

  get fullPath() {
    return this.path ? `${this.root}/${this.path}` : this.root;
  }

  get currentVersion() {
    return this.versions[_currentVersionIndex] || (this.versions[_currentVersionIndex] = {});
  }
  get stat() {
    return this.currentVersion.stat;
  }
  get children() {
    return this.currentVersion.children;
  }
  get exists() {
    return this.isFile || this.isDirectory;
  }
  get isFile() {
    return this.stat && this.stat.isFile();
  }
  get isDirectory() {
    return this.stat && this.stat.isDirectory();
  }
  get modTime() {
    return this.stat && this.stat.mtimeMs;
  }

  get jsonTree() {
    const ret = {
      path: this.path,
      isFile: this.isFile,
      isDirectory: this.isDirectory,
      exists: this.exists,
      modTime: this.modTime
    };
    if (this.children) {
      ret.children = this.children.map(child => child.jsonTree);
    }
    return ret;
  }
}

class JoinPathInfo {
  constructor(path, parent, sourcePathInfos) {
    const joinPathInfo = this;

    Object.assign(joinPathInfo, {
      path,
      parent,
      sources: sourcePathInfos,
      children: []
    });

    const joinChildPaths = {};
    for (const { children } of sourcePathInfos) {
      if (!children) continue;
      for (const child of children) {
        const joinChildPathSources = joinChildPaths[child.path] || (joinChildPaths[child.path] = []);
        joinChildPathSources.push(child);
      }
    }

    for (const [childPath, sources] of Object.entries(joinChildPaths)) {
      joinPathInfo.children.push(new JoinPathInfo(childPath, joinPathInfo, sources));
    }

    joinPathInfo.children.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  get jsonTree() {
    const ret = {
      path: this.path,
      sources: this.sources.map(({ root }) => root)
    };
    if (this.children.length) {
      ret.children = this.children.map(child => child.jsonTree);
    }
    return ret;
  }

  static async forRoots(roots) {
    await PathInfo.getAll(roots);
    return new JoinPathInfo('', undefined, roots.map(root_1 => PathInfo.with(root_1)));
  }
}

module.exports = PathInfo;
