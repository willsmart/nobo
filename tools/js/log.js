module.exports = log;

const enabledLogs = { err: { other: true } };

function logIsEnabled(module) {
  let parent = enabledLogs;
  for (const part of module.split('.')) {
    let val = parent[part];
    if (!val) {
      val = parent.other;
      if (!val) return false;
    }
    if (val === true) return true;
    if (typeof val !== 'object') return false;
    parent = val;
  }
  return true;
}

function log(module, ...args) {
  if (!logIsEnabled(module)) return false;
  if (args.length == 1 && typeof args[0] == 'function') args = [args[0]()];
  if (module === 'err' || module.startsWith('err.')) console.error.apply(console, args);
  else console.log.apply(console, args);
  return true;
}

log.enableLog = function(module) {
  enabledLogs[module] = true;
};

log.disableLog = function(module) {
  delete enabledLogs[module];
};

if (typeof window !== 'undefined') {
  window.enableNoboLog = log.enableLog;
  window.disableNoboLog = log.disableLog;
}
