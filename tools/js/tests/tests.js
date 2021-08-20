// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const TestRig = require('../general/test-rig');
const processArgs = require('../general/process-args');
const fs = require('fs');

function filteredTests({ dir, filter = '.*' } = {}) {
  if (!dir) dir = __dirname;
  return fs
    .readdirSync(dir)
    .filter(subdir => {
      return new RegExp(`^${filter}$`).test(subdir);
    })
    .map(subdir => {
      return { moduleName: subdir, path: `${dir}/${subdir}`, testPath: `${dir}/${subdir}/test.js` };
    })
    .filter(({ testPath }) => fs.existsSync(testPath));
}

async function test({ moduleName, path, testPath, verbose }) {
  const rig = await TestRig.go(
    {
      path,
      moduleName,
      verbosity: verbose ? 3 : 1,
      failVerbosity: verbose ? 3 : 1,
    },
    require(testPath)
  );
  return rig.failCount;
}

(async function() {
  var args = processArgs();

  console.log('   args: ' + JSON.stringify(args));

  const testFiles = filteredTests(args);
  console.log('Running tests: ' + testFiles.map(({ moduleName }) => moduleName).join(', '));

  const failedTests = [];
  for (const { moduleName, path, testPath } of testFiles) {
    console.log('\n');
    let failed = false;
    try {
      const failCount = await test({ moduleName, path, testPath, verbose: false });
      if (failCount > 0) {
        console.log(
          `\n\n!!!!  Test '${moduleName}' has ${failCount} failing tests. It will be run again later in verbose mode`
        );
        failed = true;
      }
    } catch (err) {
      console.log(
        `\n\n!!!!  Test '${moduleName}' errored out. It will be run again later in verbose mode:\n${err.stack}`
      );
      failed = true;
    }
    if (failed) failedTests.push({ moduleName, path, testPath });
  }

  if (!failedTests.length) {
    console.log(`\n\nAll tests succeeded! Congrats 🎉`);
  } else {
    console.log(`\n\n!!!!  The ${failedTests.map(({ moduleName }) => moduleName).join(', ')} ${
      failedTests.length == 1 ? 'module has' : 'modules have'
    } failing tests.
Here ${failedTests.length == 1 ? 'it is' : 'they are'} again in verbose mode...`);
  }
  for (const { moduleName, path, testPath } of failedTests) {
    console.log('\n');
    try {
      await test({ moduleName, path, testPath, verbose: true });
    } catch (err) {
      console.log(`\n\n   Test '${moduleName}' errored out:\n${err.stack}`);
    }
  }
})();
