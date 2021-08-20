// jobable
// © Will Smart 2018. Licence: MIT

// This is a stupidly simple job runner

// API is the function. Require via
//   const makeClassJobable = require(pathToFile)
// then after creating your class use as:
//   makeClassJobable(TheClass)

const { clearPromises } = require('./general');

module.exports = makeClassJobable;

function makeClassJobable(watchableClass) {
  Object.assign(watchableClass.prototype, {
    // Pass a function to this for queueing. It will be run the next time runJobs is called
    // alternately a Promise can be passed, which will be awaited the next time runJobs is called
    queueAsyncJob: function(job) {
      if (typeof job != 'function' && (typeof job != 'object' || typeof job.then != 'function')) return;
      const me = this;
      const asyncJobs = me._asyncJobs || (me._asyncJobs = []);
      asyncJobs.push(job);
      me.notifyListeners && me.notifyListeners('queuedAsyncJobs', me, [job]);
    },

    // Similar to queueAsyncJob, but takes an array of jobs
    queueAsyncJobs: function(jobs) {
      if (!Array.isArray(jobs)) return;
      const me = this;
      const asyncJobs = me._asyncJobs || (me._asyncJobs = []);
      asyncJobs.push(...jobs);
      me.notifyListeners && me.notifyListeners('queuedAsyncJobs', me, jobs);
    },

    // similar to queueAsyncJob, but you specify how long to wait until the jo0b should be run.
    // This is measured in seconds. Jobs are run in batches at this.secondsPerBatch intervals (def four per sec)
    // Note that the seconds parameter is not exact, but is a lower bound on how long it will actually take to kick off the job
    queueDelayedJob: function(seconds, job) {
      const me = this,
        { secondsPerBatch = 0.25 } = this,
        batchCount = Math.round(seconds / secondsPerBatch);
      if (batchCount <= 0) return this.queueAsyncJob(job);

      const delayedJobs = me._delayedJobs || (me._delayedJobs = []),
        jobs = delayedJobs[batchCount] || (delayedJobs[batchCount] = []);
      jobs.push(job);

      if (!me._delayedJobsTimeout) setDelayedJobTimeout();
      function setDelayedJobTimeout() {
        me._delayedJobsTimeout = setTimeout(() => {
          me.queueAsyncJobs(delayedJobs.shift());
          if (delayedJobs.length) setDelayedJobTimeout();
        }, secondsPerBatch);
      }
    },

    // This is the async function of this class.
    // Runs all the outstanding jobs. This is done by evaluating each job function providing a promises array
    // The job functions themselves can return a promise (i.e. be async functions) and/or can simply push any promises that result onto the promises array.
    // This function awaits over all those promises, allowing any number of jobs to be run cleanly and in parallel.
    runJobs: async function(previousPromises) {
      await clearPromises(this.prepareToRunJobs(previousPromises));
    },

    // helper function for runJobs. Exposed since it could be useful for caller code to take ownership of the promises array.
    prepareToRunJobs: function(previousPromises) {
      const me = this,
        { _asyncJobs: asyncJobs } = me;
      if (!(asyncJobs && asyncJobs.length)) return;
      me._asyncJobs = [];
      const promises = (previousPromises && previousPromises.slice()) || [];
      for (const job of asyncJobs) {
        if (typeof job == 'function') {
          try {
            job = job(promises);
          } catch (err) {
            console.error(err.stack);
          }
        }
        if (typeof job == 'object' && typeof job.then == 'function') {
          promises.push(job);
        }
      }
      return promises;
    }
  });
}
