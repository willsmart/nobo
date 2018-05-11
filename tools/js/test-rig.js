// test-rig
// © Will Smart 2018. Licence: MIT

// This is a simple testing rig

const Readline = require('readline');

const PublicApi = require("./public-api");
const DbSchemaUpdater = require("./db-schema-updater");
const DbSeeder = require("./db-seeder");
const isEqual = require('./is-equal')

// API is auto-generated at the bottom from the public interface of this class

class TestRig {
  // public methods
  static publicMethods() {
    return ["go", "task", "startTask", "endTask"];
  }

  constructor({
    path,
    verbose,
    verboseDb,
    moduleName,
    tearDownAfter
  }) {
    Object.assign(this, {
      path,
      verbose,
      verboseDb,
      moduleName,
      tearDownAfter
    })
    this.taskResults = []
  }

  async assert(thisShouldHappen, value, options = {
    equals: true
  }) {
    const rig = this

    const {
      equals,
      unsorted,
      exact,
      sameObject,
      includes,
      includedBy,
      essential
    } = options
    try {
      value = await value;
    } catch (err) {
      throw new Error(`Failed assert where ${thisShouldHappen}:
          Threw while getting value: $[err.stack}`)
    }
    let res = `No comparison options chosen. Please use one of: equals, sameObject, includes, includedBy`

    if (options.hasOwnProperty('sameObject')) {
      res = (value === options.sameObject) || `Values are different objects: ${value} vs ${options.sameObject}`
    } else if (options.hasOwnProperty('includes')) {
      res = isEqual(value, includes, {
        allowSuperset: true,
        verboseFail: true,
        unordered: true
      })
      if (res !== true && res !== '>') {
        res = `${res}
          (Expected value is to right. I would have allowed it to be a subset)`
      }
    } else if (options.hasOwnProperty('includedBy')) {
      res = isEqual(includedBy, value, {
        allowSuperset: true,
        verboseFail: true,
        unordered: true
      })
      if (res !== true && res !== '>') {
        res = `${res}
          (Expected value is to left. I would have allowed it to be a superset)`
      }
    } else {
      res = isEqual(value, equals, {
        verboseFail: true,
        unsorted,
        exact
      })
    }

    const ok = res === true || res === '>'

    rig.taskResults[rig.taskResults.length - 1].asserts.push({
      thisShouldHappen,
      ok: false
    })

    if (!ok) {
      console.log(`    ---X Failed to assert that ${thisShouldHappen}:
        ${res.replace('\n','\n        ')}`)

      if (essential) {
        throw new Error(res)
      }
    } else if (rig.verbose || !(rig.quiet || rig.lowNoise)) console.log(`    ---> Successful in asserting that ${thisShouldHappen}`)
    else if (!rig.quiet) {
      Readline.clearLine(process.stdout); // clear current text
      Readline.cursorTo(process.stdout, 0); // move cursor to beginning of line
      process.stdout.write(`       > ${rig.taskSummary()}`);
    }
  }

  taskSummary(index) {
    const rig = this

    if (index === undefined) index = rig.taskResults.length - 1
    return rig.taskResults[index].asserts.map(res => res.ok ? '.' : 'x').join("");
  }

  static async go(options, code) {
    const rig = new TestRig(options)

    await rig.start()
    await code.call(rig, rig)
    await rig.end()
  }

  async start() {
    const rig = this

    if (rig.verbose) {
      console.log(`
  ======================================================
  Test the ${rig.moduleName} component
  - - - - - - - - - - - - - - - - - - - - - - - - - - -`);
    } else if (!rig.quiet) console.log(`===> Test the ${rig.moduleName} component`)

    if (rig.path) {
      await rig.task("Set up db", async function () {
        await rig.setupDb()
      })
      await rig.task("Seed db", async function () {
        await rig.seedDb()
      })
    }
  }

  async end() {
    const rig = this

    if (rig.path && rig.tearDownAfter) {
      await rig.task("Tear down db", async function () {
        await rig.tearDownDB()
      })
    }

    if (rig.verbose) {
      console.log(`  - - - - - - - - - - - - - - - - - - - - - - - - - - -
  Done testing the ${rig.moduleName} component
  =====================================================

`);
    } else if (!rig.quiet) console.log(`---< Done testing the ${rig.moduleName} component`)
  }

  async task(name, code) {
    if (typeof (name) == 'object') name = name.name;

    const rig = this

    rig.startTask({
      name
    })
    await code()
    rig.endTask({
      name
    })
  }

  startTask(name) {
    if (typeof (name) == 'object') name = name.name;

    const rig = this

    if (rig.taskName !== undefined) {
      rig.endTask()
    }
    if (name === undefined) return

    rig.taskName = name
    rig.taskResults.push({
      taskName: name,
      asserts: []
    })

    if (rig.verbose) {
      console.log(`
    -------------------------------------------------
    ${name}
    - - - - - - - - - - - - - - - - - - - - - - - - -`)
    } else if (!rig.quiet) console.log(`  ---> ${rig.taskName}`)
  }

  endTask() {
    const rig = this

    if (rig.verbose) {
      console.log(`    - - - - - - - - - - - - - - - - - - - - - - - - -
    Done ${rig.taskName}
    -------------------------------------------------
`)
    }
    delete rig.taskName
  }

  async setupDb() {
    const rig = this,
      updater = rig.dbSchemaUpdater;

    const {
      schema
    } = await updater.performUpdate({
      dryRun: false,
      renew: true
    });

    rig.schema = schema
    rig.connection = updater.connection
  }

  async seedDb() {
    const rig = this,
      seeder = rig.dbSeeder;

    await seeder.insertSeeds({
      quiet: !rig.verboseDb
    })
  }

  async tearDownDB() {
    const rig = this,
      updater = rig.dbSchemaUpdater;

    await updater.performUpdate({
      dryRun: false,
      drop: true
    });
  }

  get dbSchemaUpdater() {
    const rig = this

    if (!rig.path) return
    return rig._updater ? rig._updater : (rig._updater = new DbSchemaUpdater({
      path: `${rig.path}/db`,
      verbose: rig.verboseDb
    }))
  }

  get dbSeeder() {
    const rig = this

    if (!rig.path) return
    return rig._seeder ? rig._seeder : (rig._seeder = new DbSeeder({
      path: `${rig.path}/db`,
      verbose: rig.verboseDb
    }))
  }

}

// API is the public facing class
module.exports = PublicApi({
  fromClass: TestRig,
  hasExposedBackDoor: true
});