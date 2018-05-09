// test-rig
// © Will Smart 2018. Licence: MIT

// This is a simple testing rig

const PublicApi = require("./public-api");
const DbSchemaUpdater = require("./db-schema-updater");

// API is auto-generated at the bottom from the public interface of this class

class TestRig {
  // public methods
  static publicMethods() {
    return ["go", "task", "startTask", "endTask"];
  }

  constructor({
    path,
    verbose,
    moduleName
  }) {
    Object.assign(this, {
      path,
      verbose,
      moduleName
    })
  }

  static async go({
    path,
    verbose,
    moduleName = "main"
  }, code) {
    const rig = new TestRig(arguments[0])

    await rig.start()
    await code.call(rig, rig)
    await rig.end()
  }

  async start() {
    const rig = this

    console.log(`
========================================
  Test the ${rig.moduleName} component
========================================
`);
    await rig.task({
      name: "Set up db"
    }, async function () {
      await rig.setupDB()
    })
  }

  async end() {
    const rig = this

    await rig.task({
      name: "Tear down db"
    }, async function () {
      await rig.tearDownDB()
    })

    console.log(`

    Done testing the ${rig.moduleName} component

`);
  }

  async task({
    name
  }, code) {
    const rig = this

    rig.startTask({
      name
    })
    await code()
    rig.endTask({
      name
    })
  }

  startTask({
    name
  }) {
    const rig = this

    if (rig.taskName !== undefined) {
      rig.endTask()
    }
    if (name === undefined) return

    this.taskName = name
    console.log(`
----------------------------------------
    ${name}
----------------------------------------
`)
  }

  endTask() {
    console.log(`
    Done ${this.taskName}

`)
  }

  async setupDB() {
    const rig = this,
      updater = rig.dbSchemaUpdater;

    const {
      schema
    } = await updater.performUpdate({
      dryRun: false,
      renew: true,
      quiet: !rig.verbose
    });

    rig.schema = schema
    rig.connection = updater.connection
  }

  async tearDownDB() {
    const rig = this,
      updater = rig.dbSchemaUpdater;

    await updater.performUpdate({
      dryRun: false,
      drop: true,
      quiet: !rig.verbose
    });
  }

  get dbSchemaUpdater() {
    return this._updater ? this._updater : (this._updater = new DbSchemaUpdater({
      path: `${rig.path}/db`
    }))
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: TestRig,
  hasExposedBackDoor: true
});