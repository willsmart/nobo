const processArgs = require('../../general/process-args'),
  FsPathInfos = require('./fs-path-infos');

(async function() {
  try {
    var args = processArgs();

    console.log('Show changes to a file tree');

    const pathInfos = new FsPathInfos(args.path || 'test');

    pathInfos.watch({
      callbackKey: 'demo',
      created: ({ path, stat }) => {
        console.log({ created: path, at: stat.mtime });
      },
      deleted: ({ path }) => {
        console.log({ deleted: path });
      },
      modified: ({ path, stat }) => {
        console.log({ modified: path, at: stat.mtime });
      },
      job: pathInfos => {
        console.log('job');
        pathInfos.runJobs();
      }
    });
  } catch (err) {
    console.error(err.stack);
  }
})();
