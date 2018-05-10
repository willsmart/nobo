// test-rig
// © Will Smart 2018. Licence: MIT

// This is a simple testing rig

const PublicApi = require("./public-api");
const DbSchemaUpdater = require("./db-schema-updater");
const DbSeeder = require("./db-seeder");

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


  static isEqual(v1, v2, options = {}) {
    if (typeof (v1) != typeof (v2) || Array.isArray(v1) != Array.isArray(v2)) {
      return false
    }
    if (typeof (v1) == 'number' || typeof (v1) == 'boolean' || typeof (v1) == 'string') return v1 == v2
    if (Array.isArray(v1)) {
      const {
        looseArrays
      } = options
      if (v1.length != v2.length) return false;
      if (!v1.length) return true;
      if (!looseArrays) {
        let index = 0
        for (const c1 of v1)
          if (!TestRig.isEqual(c1, v2[index], options)) return false;
        return true
      } else {
        const unusedC1Indexes = Object.assign({}, v1.map(() => true))
        for (const c2 of v2) {
          let found = false
          for (const c1Index in unusedC1Indexes)
            if (unusedC1Indexes.hasOwnProperty(c1Index)) {
              const c1 = v1[c1Index]
              if (TestRig.isEqual(c1, c2, options)) {
                delete unusedC1Indexes[c1Index]
                found = true
                break;
              }
            }
          if (!found) return false
        }
        return true
      }
    }
    if (typeof (v1) == 'object') {
      const v1Keys = Object.keys(v1),
        v2Keys = Object.keys(v2)
      if (v1Keys.length != v2Keys.length) return false;
      for (const v1Key of v1Keys) {
        if (!TestRig.isEqual(v1[v1Key], v2[v1Key], options)) {
          return false
        }
      }
      return true
    }
    return v1 === v2
  }

  static isSupersetOrEqual(v1, v2, options) {
    if (typeof (v1) != typeof (v2) || Array.isArray(v1) != Array.isArray(v2)) {
      return false
    }
    if (typeof (v1) == 'number' || typeof (v1) == 'boolean' || typeof (v1) == 'string') {
      return v1 == v2 ? '=' : false
    }
    if (Array.isArray(v1)) {
      const {
        looseArrays
      } = options

      if (v1.length < v2.length) return false;
      if (!v1.length) return '=';

      let supersetMatch = v1.length > v2.length

      if (!looseArrays) {
        let index = 0
        for (const c2 of v2) {
          const res = TestRig.isSupersetOrEqual(v1[index], c2, options)
          if (!res) return false;
          if (res == '>') supersetMatch = true;
        }
        return supersetMatch ? '>' : '='
      } else {
        const unusedC1Indexes = Object.assign({}, v1.map(() => true))
        const unusedC2Indexes = {}
        let c2Index = 0
        for (const c2 of v2) {
          let found = false
          for (const c1Index in unusedC1Indexes) {
            if (unusedC1Indexes.hasOwnProperty(c1Index)) {
              const c1 = v1[c1Index]
              if (TestRig.isEqual(c1, c2, options)) {
                delete unusedC1Indexes[c1Index]
                found = true
                break;
              }
            }
          }
          if (!found) unusedC2Indexes[c2Index] = []
          c2Index++
        }
        if (!Object.keys(unusedC1Indexes).length) return '='

        for (const [c2Index, supersetsC1Indexes] of Object.entries(unusedC2Indexes)) {
          for (const c1Index of unusedC1Indexes) {
            if (TestRig.isSupersetOrEqual(v1[c1Index], v2[c2Index], options)) {
              supersetsC1Indexes.push(c1Index)
            }
          }
          if (!supersetsC1Indexes.length) return false
        }
        const c2IndexesInOrder = Object.keys(unusedC2Indexes).sort((a, b) => Object.keys(unusedC2Indexes[a]).length - Object.keys(unusedC2Indexes[b]).length)

        function findMapping(c2IndexIndex) {
          if (c2IndexIndex == c2IndexesInOrder.length) return true
          const c2Index = c2IndexesInOrder[c2IndexIndex]
          const supersetsC1Indexes = unusedC2Indexes[c2Index]
          for (const c1Index of supersetsC1Indexes)
            if (unusedC1Indexes[c1Index]) {
              delete unusedC1Indexes[c1Index]
              if (findMapping(c2IndexIndex)) return true
              unusedC1Indexes[c1Index] = true
            }
          return false
        }

        return findMapping(0) ? '>' : false
      }
    }
    if (typeof (v1) == 'object') {
      const v1Keys = Object.keys(v1),
        v2Keys = Object.keys(v2)
      if (v1Keys.length < v2Keys.length) return false;
      let supersetMatch = v1Keys.length > v2Keys.length
      for (const v2Key of v2Keys) {
        const res = TestRig.isSupersetOrEqual(v1[v1Key], v2[v1Key], options)
        if (!res) return false
        if (res == '>') supersetMatch = true
      }
      return supersetMatch ? '>' : '='
    }
    return v1 === v2 ? '=' : false
  }

  static verboseCompare(v1, v2, options) {
    const {
      exact
    } = options

    if (typeof (v1) != typeof (v2) || Array.isArray(v1) != Array.isArray(v2)) {
      if (!exact && v1 == v2) {
        return {
          result: true
        }
      }
      return {
        msg: `types differ: ${Array.isArray(v1) ? 'array' : typeof(v1)} vs ${Array.isArray(v2) ? 'array' : typeof(v2)}`
      }
    }

    if (typeof (v1) == 'number') return {
      result: exact ? v1 == v2 : v1 - v2,
      msg: (v1 == v2 ? undefined : `numbers differ: ${v1} vs ${v2}`)
    }
    if (typeof (v1) == 'boolean') return {
      result: v1 == v2,
      msg: (v1 == v2 ? undefined : `booleans differ: ${v1} vs ${v2}`)
    }
    if (typeof (v1) == 'string') return {
      result: v1 == v2,
      msg: (v1 == v2 ? undefined : `strings differ: "${v1}" vs "${v2}"`)
    }
    if (typeof (v1) == 'object') {
      const res = exact ? TestRig.isEqual(v1, v2, options) : TestRig.isSupersetOrEqual(v1, v2, options)
      return {
        result: res == '=' ? true : res,
        msg: (res ? undefined : `${Array.isArray(v1)?'Arrays':'Objects'} differ:
    ${JSON.stringify(v1)} 
      vs 
    ${JSON.stringify(v2)}`)
      }
    }
    return {
      result: v1 === v2,
      msg: (v1 === v2 ? undefined : `values differ: "${v1}" vs "${v2}"`)
    }
  }

  async assert(thisShouldHappen, value, options = {
    equals: true
  }) {
    const {
      equals,
      includes,
      includedBy
    } = options
    try {
      value = await value;
    } catch (err) {
      throw new Error(`Failed assert where ${thisShouldHappen}:
          Threw while getting value: $[err.stack}`)
    }
    if (options.hasOwnProperty('equals')) {
      const res = TestRig.verboseCompare(value, equals, {
        exact: true
      })
      if (res.msg) {
        throw new Error(`Failed assert where ${thisShouldHappen}:
          ${res.msg}`)
      }
    }
    if (options.hasOwnProperty('includes')) {
      const res = TestRig.verboseCompare(value, includes)
      if (res.msg) {
        throw new Error(`Failed assert where ${thisShouldHappen}:
          ${res.msg}
          (Expected value is to right. I would have allowed it to be a subset)`)
      }
    }
    if (options.hasOwnProperty('includedBy')) {
      const res = TestRig.verboseCompare(includedBy, value)
      if (res.msg) {
        throw new Error(`Failed assert where ${thisShouldHappen}:
          ${res.msg}
          (Expected value is to left. I would have allowed it to be a superset)`)
      }
    }

    console.log(`Successful in asserting that ${thisShouldHappen}`)
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
    await rig.task("Set up db", async function () {
      await rig.setupDb()
    })
    await rig.task("Seed db", async function () {
      await rig.seedDb()
    })
  }

  async end() {
    const rig = this

    // await rig.task("Tear down db", async function () {
    //   await rig.tearDownDB()
    // })

    console.log(`

    Done testing the ${rig.moduleName} component

`);
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
    delete this.taskName
  }

  async setupDb() {
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

  async seedDb() {
    const rig = this,
      seeder = rig.dbSeeder;

    await seeder.insertSeeds({
      quiet: !rig.verbose
    })
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
      path: `${this.path}/db`
    }))
  }

  get dbSeeder() {
    return this._seeder ? this._seeder : (this._seeder = new DbSeeder({
      path: `${this.path}/db`
    }))
  }

}

// API is the public facing class
module.exports = PublicApi({
  fromClass: TestRig,
  hasExposedBackDoor: true
});