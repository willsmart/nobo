// diff
// © Will Smart 2018. Licence: MIT

// This is a stupidly simple diff generator
// It is used by the SharedState module.
// output is a fairly custom format
//  for example
// diff({a:1,b:[2,1]},{b:[1],c:2}) 
// == 
// {
//   objectDiff: {
//     a: undefined,
//     b: {arrayDiff:[
//       { at: 0, value: 1 }
//       { deleteAt: 1 }
//     ]},
//     c: {value: 2}
//   }
// }



// API is the function. Use via
//   const diff = require(pathToDiff)

module.exports = diff;

function diff(was, is) {
  if (was === is) return;
  if (Array.isArray(is)) return diffArray(Array.isArray(was) ? was : undefined, is);
  if (typeof is == "object") return diffObject(typeof was == "object" ? was : undefined, is);
  if (typeof was == typeof is && was == is) return;
  return {
    value: is
  };
}

function diffObject(was, is) {
  let diff;
  if (was) {
    for (const key in was) {
      if (was.hasOwnProperty(key)) {
        if (!is.hasOwnProperty(key)) {
          if (!diff) diff = {};
          diff[key] = undefined;
          continue;
        }
        const wasChild = was[key],
          isChild = is[key],
          diffChild = diff(wasChild, isChild);

        if (diffChild) {
          if (!diff) diff = {};
          diff[key] = diffChild;
        }
      }
    }
  }

  for (const key in is) {
    if (is.hasOwnProperty(key) && !(was && was.hasOwnProperty(key))) {
      const isChild = is[key];

      if (!diff) diff = {};
      diff[key] = {
        value: isChild
      };
    }
  }
  return diff ? {
      objectDiff: diff
    } :
    undefined;
}

function diffArray(was, is) {
  let diff;
  // TODO better diff algorithm
  let index;
  for (index = 0; index < was.length && index < is.length; index++) {
    const wasChild = was[index],
      isChild = is[index],
      diffChild = diff(wasChild, isChild);

    if (diffChild) {
      if (!diff) diff = {
        arrayDiff: []
      };
      diff.arrayDiff.push(Object.assign(diffChild, {
        at: index
      }))
    }
  }
  for (index = 0; index < was.length; index++) {
    const wasChild = was[index],
      diffChild = diff(wasChild);

    if (diffChild) {
      if (!diff) diff = {
        arrayDiff: []
      };
      diff.arrayDiff.push({
        deleteAt: index
      })
    }
  }
  for (index = 0; index < is.length; index++) {
    const isChild = is[index];

    if (!diff) diff = {
      arrayDiff: []
    };
    diff.arrayDiff.push(Object.assign({
      insertAt: index,
      value: isChild
    }))
  }

  return diff;
}