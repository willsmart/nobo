const DomChangeQueue = require('./dom-change-queue');
const PublicApi = require('../general/public-api');
const { forEachInElementRange, findInElementRange, logChange, describeChange } = require('./dom-functions');

// API is auto-generated at the bottom from the public interface of the DomChangeQueue class

const waitCountAttributeName = 'nobo-wait-count',
  waitingChangesAttributeName = 'nobo-waiting-changes',
  rootInChangeIdAttributeName = 'nobo-root-in-change';

function elementRootInChangeId(element) {
  return element.getAttribute(rootInChangeIdAttributeName) || undefined;
}

function setElementRootInChangeId(element, changeId) {
  if (changeId) element.setAttribute(rootInChangeIdAttributeName, changeId);
  else element.removeAttribute(rootInChangeIdAttributeName);
}

function elementWaitingChangeIds(element) {
  const value = element.getAttribute(waitingChangesAttributeName);
  return value ? value.split(' ') : [];
}

function clearElementWaitingChangeIds(element) {
  element.removeAttribute(waitingChangesAttributeName);
}

function elementIsWaiting(element) {
  return element.getAttribute(waitCountAttributeName);
}

function rangeIsWaiting(element) {
  return Boolean(findInElementRange(element, treeIsWaiting));
}

function treeIsWaiting(element) {
  if (elementIsWaiting(element)) return true;
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (treeIsWaiting(child)) return true;
  }
}

function rangeWaitCount(element) {
  let ret = 0;
  forEachInElementRange(element, el => (ret += treeWaitCount(el)));
  return ret;
}

function treeWaitCount(element) {
  let ret = elementIsWaiting(element) ? 1 : 0;
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    ret += treeWaitCount(child);
  }
  return ret;
}

function addChangeIdToElement(element, changeId) {
  const value = element.getAttribute(waitingChangesAttributeName);
  element.setAttribute(waitingChangesAttributeName, value ? `${value} ${changeId}` : changeId);
}

function ensureChangeIdInElement(element, changeId) {
  changeId = String(changeId);
  const value = element.getAttribute(waitingChangesAttributeName);
  if (value && value.split(' ').includes(changeId)) return;
  element.setAttribute(waitingChangesAttributeName, value ? `${value} ${changeId}` : changeId);
}

function addChangeIdToWaitingElementsInRange(element, changeId, checkForExisting) {
  let ret = 0;
  forEachInElementRange(element, el => (ret += addChangeIdToWaitingElementsInTree(el, changeId, checkForExisting)));
  return ret;
}

function addChangeIdToWaitingElementsInTree(element, changeId, checkForExisting) {
  let ret = 0;
  if (elementIsWaiting(element)) {
    if (checkForExisting) ensureChangeIdInElement(element, changeId);
    else addChangeIdToElement(element, changeId);
    ret++;
  }
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    ret += addChangeIdToWaitingElementsInTree(child, changeId, checkForExisting);
  }
  return ret;
}

class DomWaitingChangeQueue {
  // public methods
  static publicMethods() {
    return ['push', 'elementIsDoneWaiting', 'changeDescriptions'];
  }

  constructor() {
    const domWaitingChangeQueue = this;

    Object.assign(domWaitingChangeQueue, {
      domChangeQueue: new DomChangeQueue(),
      changesById: {},
      queue: [],
      nextChangeId: 1,
    });
  }

  changeDescriptions(indent = '') {
    return this.queue.map(change => describeChange(change, indent));
  }

  push(change) {
    const domWaitingChangeQueue = this;

    const consumedChangeIds = domWaitingChangeQueue.existingWaitingChildChangeIds(change);
    for (const changeId of Object.keys(consumedChangeIds)) {
      const consumedChange = domWaitingChangeQueue.changesById[changeId];
      logChange('dom.changes', `Change was consumed by pushed change`, consumedChange);

      forEachInElementRange(consumedChange.firstElement, setElementRootInChangeId);
      const index = domWaitingChangeQueue.queue.indexOf(consumedChange);
      domWaitingChangeQueue.queue.splice(index, 1);
      delete domWaitingChangeQueue.changesById[consumedChange.id];
    }

    const parentChange = domWaitingChangeQueue.existingWaitingParentChange(change);
    if (parentChange) {
      logChange('dom.changes', 'Pushed change has a parent change and will be applied immediately', change);
      if (parentChange.firstElement == change.replace) {
        forEachInElementRange(parentChange.firstElement, setElementRootInChangeId);
        parentChange.firstElement = change.firstElement;
      } else {
        domWaitingChangeQueue.domChangeQueue.apply(change);
      }
      domWaitingChangeQueue.refreshChangeWaitInfo(parentChange);
      if (!parentChange.waitCount) {
        logChange('dom.changes', `Parent change is now ready to go`, parentChange);
        forEachInElementRange(parentChange.firstElement, setElementRootInChangeId);
        const index = domWaitingChangeQueue.queue.indexOf(parentChange);
        delete domWaitingChangeQueue.changesById[parentChange.id];
        domWaitingChangeQueue.queue.splice(index, 1);
        domWaitingChangeQueue.domChangeQueue.push(parentChange);
      } else {
        logChange('dom.changes', `Parent change`, parentChange);
      }
      return;
    }

    if (!(change.firstElement && rangeIsWaiting(change.firstElement))) {
      logChange('dom.changes', `Pushed change isn't waiting on any datapoints, and will be queued immediately`, change);
      domWaitingChangeQueue.domChangeQueue.push(change);
      return;
    }

    change.id = domWaitingChangeQueue.nextChangeId++;

    domWaitingChangeQueue.queue.push(change);
    domWaitingChangeQueue.changesById[change.id] = change;
    domWaitingChangeQueue.addChangeWaitInfo(change);
    logChange('dom.changes', 'Change was pushed', change);
  }

  refreshChangeWaitInfo(change) {
    forEachInElementRange(change.firstElement, el => setElementRootInChangeId(el, change.id));
    change.waitCount = addChangeIdToWaitingElementsInRange(change.firstElement, change.id, true);
  }

  addChangeWaitInfo(change) {
    forEachInElementRange(change.firstElement, el => setElementRootInChangeId(el, change.id));
    change.waitCount = addChangeIdToWaitingElementsInRange(change.firstElement, change.id);
  }

  elementIsDoneWaiting(element) {
    const domWaitingChangeQueue = this,
      changeIds = elementWaitingChangeIds(element);
    if (!changeIds.length) return;
    clearElementWaitingChangeIds(element);

    for (const changeId of changeIds) {
      const change = domWaitingChangeQueue.changesById[changeId];

      if (!--change.waitCount) {
        forEachInElementRange(change.firstElement, setElementRootInChangeId);
        const index = domWaitingChangeQueue.queue.indexOf(change);
        delete domWaitingChangeQueue.changesById[change.id];
        domWaitingChangeQueue.queue.splice(index, 1);
        logChange('dom.changes', 'Change is ready to go', change);
        domWaitingChangeQueue.domChangeQueue.push(change);
      }
    }
  }

  existingWaitingParentChange({ replace, insertAfter, parent, firstElement }) {
    const domWaitingChangeQueue = this,
      { changesById } = domWaitingChangeQueue;

    for (; replace; replace = replace.parentElement) {
      const changeId = elementRootInChangeId(replace);
      if (changeId) return changesById[changeId];
    }

    if (insertAfter) parent = insertAfter.parentElement;
    for (; parent; parent = parent.parentElement) {
      const changeId = elementRootInChangeId(parent);
      if (changeId) return changesById[changeId];
    }

    if (insertAfter) {
      const changeId = elementRootInChangeId(insertAfter);
      if (changeId) {
        const next = insertAfter.nextElementSibling,
          parentChange = changesById[changeId];

        if (next && elementRootInChangeId(next) == changeId) return parentChange;
        const placeholderUid = firstElement.getAttribute('nobo-placeholder-uid');
        if (
          placeholderUid &&
          findInElementRange(change.firstElement, el => el.getAttribute('nobo-uid') == placeholderUid)
        ) {
          return parentChange;
        }
      }
    }
  }

  existingWaitingChildChangeIds(change) {
    const domWaitingChangeQueue = this,
      { replace } = change,
      changeIds = {};

    if (replace) {
      forEachInElementRange(replace, el => {
        if (el == replace) return;
        domWaitingChangeQueue.addExistingWaitingChildChangeIdsForElement(el, changeIds);
      });
    }

    return changeIds;
  }

  addExistingWaitingChildChangeIdsForElement(element, changeIds) {
    const domWaitingChangeQueue = this;

    for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
      domWaitingChangeQueue.addExistingWaitingChildChangesForElement(child, changeIds);
    }

    const changeId = elementRootInChangeId(element);
    if (changeId) changeIds[changeId] = true;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomWaitingChangeQueue,
  hasExposedBackDoor: true,
});
