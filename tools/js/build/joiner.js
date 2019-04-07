const fs = require('fs');
const processArgs = require('../general/process-args');
const { promisify } = require('util');

const stat_p = promisify(fs.stat),
  readdir_p = promisify(fs.readdir),
  unlink_p = promisify(fs.unlink),
  utimes_p = promisify(fs.utimes),
  mkdir_p = promisify(fs.mkdir),
  copyFile_p = promisify(fs.copyFile);

const _pathInfos = {};

let _currentVersionIndex = 1;

function log(...args) {
  console.log.apply(console, args);
}

function compareModTimes(a, b) {
  return Math.abs(a - b) < 1000 ? 0 : a < b ? -1 : 1;
}

class PathInfo {
  constructor(root, path) {
    const pathInfo = this,
      match = /^(.*)\/([^\/]+)$/.exec(path);
    Object.assign(pathInfo, {
      parent: path ? PathInfo.with(root, match ? match[1] : '') : undefined,
      path,
      root,
      versions: {}
    });
  }

  static keyFor(root, path) {
    return `${root}///${path}`;
  }

  static with(root, path = '') {
    const key = PathInfo.keyFor(root, path);
    return _pathInfos[key] || (_pathInfos[key] = new PathInfo(root, path));
  }

  static getAll(roots) {
    return Promise.all(roots.map(root => PathInfo.with(root).validateTree()));
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

class JoinPathPlan {
  constructor(existingJoinPathInfo, proposedJoinPathInfo) {
    const plan = this;
    Object.assign(plan, {
      existingJoinPathInfo,
      proposedJoinPathInfo,
      children: []
    });

    const existingChildren = existingJoinPathInfo && existingJoinPathInfo.children ? existingJoinPathInfo.children : [],
      proposedChildren = proposedJoinPathInfo.children;
    let existingChildrenIndex = 0,
      proposedChildrenIndex = 0;
    while (existingChildrenIndex < existingChildren.length && proposedChildrenIndex < proposedChildren.length) {
      const existingChild = existingChildren[existingChildrenIndex],
        proposedChild = proposedChildren[proposedChildrenIndex];
      if (existingChild.path == proposedChild.path) {
        plan.children.push(new JoinPathPlan(existingChild, proposedChild));
        existingChildrenIndex++;
        proposedChildrenIndex++;
      } else if (existingChild.path < proposedChild.path) {
        plan.children.push(new JoinPathPlan(existingChild, undefined));
        existingChildrenIndex++;
        proposedChildrenIndex++;
      } else {
        plan.children.push(new JoinPathPlan(undefined, proposedChild));
        proposedChildrenIndex++;
      }
    }
    while (existingChildrenIndex < existingChildren.length) {
      plan.children.push(new JoinPathPlan(existingChildren[existingChildrenIndex++], undefined));
    }
    while (proposedChildrenIndex < proposedChildren.length) {
      plan.children.push(new JoinPathPlan(undefined, proposedChildren[proposedChildrenIndex++]));
    }
  }

  get sourcePathInfo() {
    const plan = this,
      { proposedJoinPathInfo } = plan;

    return proposedJoinPathInfo ? proposedJoinPathInfo.sources.find(source => source.exists) : undefined;
  }

  get operations() {
    const plan = this,
      { sourcePathInfo, existingJoinPathInfo } = plan,
      sourceModTime = sourcePathInfo ? sourcePathInfo.modTime : undefined,
      existingModTime = existingJoinPathInfo ? existingJoinPathInfo.modTime : undefined;

    if (sourceModTime) {
      if (existingModTime) {
        if (sourcePathInfo.isDirectory) {
          if (existingJoinPathInfo.isDirectory) {
            switch (compareModTimes(sourceModTime, existingModTime)) {
              case 0:
                return ['children'];
              case -1:
                return ['children', '<modtime'];
              case 1:
                return ['children', 'modtime>'];
            }
          } else if (compareModTimes(sourceModTime, existingModTime) >= 0) {
            return ['delete>', 'mkdir>', 'children', 'modtime>'];
          } else {
            return ['<deletedirectory', '<copy', '<modtime'];
          }
        } else if (existingJoinPathInfo.isDirectory) {
          if (compareModTimes(sourceModTime, existingModTime) >= 0) {
            return ['deletedirectory>', 'copy>', 'modtime>'];
          } else {
            return ['<delete', '<mkdir', 'children', '<modtime'];
          }
        } else {
          switch (compareModTimes(sourceModTime, existingModTime)) {
            case 0:
              return [];
            case -1:
              return ['<delete', '<copy', '<modtime'];
            case 1:
              return ['delete>', 'copy>', 'modtime>'];
          }
        }
      } else if (sourcePathInfo.isDirectory) {
        return ['mkdir>', 'children', 'modtime>'];
      } else {
        return ['copy>', 'modtime>'];
      }
    } else if (existingModTime) {
      if (existingJoinPathInfo.isDirectory) {
        return ['deletedirectory>'];
      } else {
        return ['delete>'];
      }
    } else {
      return [];
    }
  }

  act(joinRoot, indent = '  ') {
    const plan = this,
      { operations, sourcePathInfo: source, existingJoinPathInfo: existing, children } = plan,
      joinFullPath = existing ? existing.fullPath : source ? `${joinRoot}/${source.path}` : undefined;

    return doOperationChain();

    function doOperationChain(operationIndex = 0) {
      if (operationIndex >= operations.length) return Promise.resolve();
      if (operationIndex == operations.length - 1) return doOperation(operations[operationIndex]);
      return doOperation(operations[operationIndex]).then(() => doOperationChain(operationIndex + 1));
    }

    function doOperation(operation) {
      if (operation)
        switch (operation) {
          case 'children':
            return Promise.all(children.map(child => child.act(joinRoot, indent + '  ')));
          case '<modtime': {
            log(`${indent}[${existing.path}]: pushing back mod time to ${source.root}`);
            const { mtimeMs } = existing.stat,
              { atimeMs } = source.stat;
            //return utimes_p(source.fullPath, atimeMs, mtimeMs);
            break;
          }
          case 'modtime>': {
            const { atime } = existing && existing.stat ? existing.stat : source ? source.stat : undefined,
              { mtime } = source.stat;
            log(`${indent}[${source.path}]: pushing mod time (${mtime}) from ${source.root}`);
            return utimes_p(joinFullPath, atime, mtime);
          }
          case '<delete':
            log(`${indent}[${source.path}]: deleting older source file from ${source.root}`);
            //return unlink_p(source.fullPath));
            break;
          case 'delete>':
            log(`${indent}[${existing.path}]: deleting file`);
            return unlink_p(joinFullPath);
          case '<deletedirectory':
            log(`${indent}[${source.path}]: deleting older source directory from ${source.root}`);
            //return unlink_p(source.fullPath);
            break;
          case 'deletedirectory>':
            log(`${indent}[${existing.path}]: deleting directory`);
            return unlink_p(joinFullPath);
          case '<mkdir':
            log(`${indent}[${source.path}]: making directory in source ${source.root}`);
            //return mkdir_p(source.fullPath);
            break;
          case 'mkdir>':
            log(`${indent}[${source.path}]: making directory`);
            return mkdir_p(joinFullPath);
          case '<copy':
            log(`${indent}[${existing.path}]: pushing back file to ${source.root}`);
            //return copyFile_p(existing.fullPath, source.fullPath);
            break;
          case 'copy>':
            log(`${indent}[${source.path}]: pushing file from ${source.root}`);
            return copyFile_p(source.fullPath, joinFullPath);
        }
      return Promise.resolve();
    }
  }

  get jsonTree() {
    const plan = this,
      { operation, existingJoinPathInfo, sourcePathInfo } = plan,
      ret = {
        operation,
        path: (existingJoinPathInfo || sourcePathInfo || {}).path,
        source: (sourcePathInfo || {}).root
      };

    if (operation != 'delete' && this.children.length) {
      ret.children = this.children.map(child => child.jsonTree);
    }
    return ret;
  }
}

(async function() {
  try {
    const args = processArgs(),
      joinRoot = 'joined',
      appConfiguration = args['--production'] ? 'prod' : args['--deploy'] ? 'deploy' : 'dev',
      roots = ['secrets', appConfiguration, 'app', 'nobo'],
      pushbackOrder = ['secrets', appConfiguration, 'nobo', 'app'],
      modTimeStackForJoin = [];
    modTimeStacks = [[], [], [], []];

    await Promise.all([PathInfo.getAll(roots), PathInfo.with(joinRoot).validateTree()]);

    const existingJoinTree = PathInfo.with(joinRoot).jsonTree;
    rootTrees = {};
    for (const root of roots) rootTrees[root] = PathInfo.with(root).jsonTree;

    const join = await JoinPathInfo.forRoots(roots),
      proposedJoinTree = join.jsonTree,
      plan = new JoinPathPlan(PathInfo.with(joinRoot), join),
      planTree = plan.jsonTree;

    console.log(
      `Trees:\n${JSON.stringify(
        {
          existingJoinTree,
          rootTrees,
          proposedJoinTree,
          planTree
        },
        null,
        2
      )}`
    );

    await plan.act(joinRoot);
    console.log('done');
  } catch (e) {
    console.error(e.stack);
  }
})();
