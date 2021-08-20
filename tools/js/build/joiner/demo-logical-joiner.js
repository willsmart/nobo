const processArgs = require('../../general/process-args'),
  LogicalJoiner = require('./logical-joiner');

(async function() {
  try {
    var args = processArgs();

    console.log('Show required operations to join file trees');

    const pathInfos = new LogicalJoiner('test-join', ['test', 'test2']);

    pathInfos.watch({
      callbackKey: 'demo',
      copy: ({ source, destinationPath, type }) => {
        console.log({ do: 'copy', source: source.path, destinationPath, type });
      },
      delete: ({ path, type }) => {
        console.log({ do: 'delete', path, type });
        console.log({ deleted: path });
      },
      overwrite: ({ source, destination, type }) => {
        console.log({ do: 'overwrite', source: source.path, destination: destination.path, type });
      }
    });
  } catch (err) {
    console.error(err.stack);
  }
})();
