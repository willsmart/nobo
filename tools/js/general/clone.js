// clone
// © Will Smart 2018. Licence: MIT

// This is a stupidly simple cloning device for basic objects and arrays

// API is the function. Use via
//   const clone = require(pathToClone)
// or
//   const {shallowCopy, shallowCopyObjectIfSame} = require(pathToClone)

module.exports = clone;
Object.assign(clone, {
  shallowCopy,
  shallowCopyObjectIfSame,
});

function clone(val) {
  if (Array.isArray(val)) return cloneArray(val);
  if (typeof val == 'object') return cloneObject(val);
  return val;
}

function cloneArray(array) {
  const ret = [];
  for (let index = 0; index < array.length; index++) {
    const child = array[index];
    ret.push(Array.isArray(child) ? cloneArray(child) : typeof child == 'object' ? cloneObject(child) : child);
  }
  return ret;
}

function cloneObject(obj) {
  const ret = {},
    keys = Object.keys(obj);
  // I'm under the belief that this is ever so slightly quicker than had I used forEach
  // I might well be wrong but it's my hill and I'm holding it
  for (let keyIndex = 0; keyIndex < keys.length; keyIndex++) {
    const key = keys[keyIndex],
      value = obj[key];
    ret[key] = Array.isArray(value) ? cloneArray(value) : typeof value == 'object' ? cloneObject(value) : value;
  }
  return ret;
}

// copy first layer of an array of object
function shallowCopy(val) {
  if (Array.isArray(val)) return val.slice();
  else if (typeof val == 'object') {
    const copy = {};
    for (const key in val)
      if (val.hasOwnProperty(key)) {
        copy[key] = val[key];
      }
    return copy;
  } else return val;
}

// returns a copy of immutableChild if an object, or {} if not, as mutableParent[key]
// Assumes that mutableParent[key] is already a copy of immutableChild if it exists.
// This is used by the SharedState module
function shallowCopyObjectIfSame(immutableChild, mutableParent, key) {
  if (typeof immutableChild != 'object') {
    if (typeof mutableParent[key] != 'object') mutableParent[key] = {};
  } else if (typeof mutableParent[key] != 'object' || mutableParent[key] === immutableChild) {
    mutableParent[key] = shallowCopy(immutableChild);
  }
  return mutableParent[key];
}
