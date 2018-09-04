const PublicApi = require('../general/public-api');
const { cloneShowingElementNames } = require('../general/name-for-element');
const { rangeForElement, forEachInElementRange } = require('./dom-functions');

// API is auto-generated at the bottom from the public interface of the DomChangeQueue class

class DomChangeQueue {
  // public methods
  static publicMethods() {
    return ['push', 'apply'];
  }

  constructor() {
    const domChangeQueue = this;

    domChangeQueue.queue = [];
  }

  push(change) {
    const domChangeQueue = this,
      { queue } = domChangeQueue;

    queue.push(change);

    domChangeQueue.queueJob();
  }

  queueJob({ delay = 10 } = {}) {
    const domChangeQueue = this;

    if (delay <= 0) {
      domChangeQueue.applyDomChanges();
      return;
    }

    if (domChangeQueue._applyTimeout) return;
    domChangeQueue._applyTimeout = setTimeout(() => {
      delete domChangeQueue._applyTimeout;
      domChangeQueue.applyDomChanges();
    }, delay);
  }

  applyDomChanges() {
    const domChangeQueue = this;

    if (domChangeQueue._applyTimeout) {
      clearTimeout(domChangeQueue._applyTimeout);
      delete domChangeQueue._applyTimeout;
    }

    if (domChangeQueue.queue.length) {
      const changes = domChangeQueue.queue;

      domChangeQueue.queue = [];
      changes.forEach(domChangeQueue.apply);
    }
  }

  apply({ replace, insertAfter, parent, firstElement }) {
    if (replace) {
      parent = replace.parentElement;
      insertAfter = replace.previousSibling;

      forEachInElementRange(replace, el => parent.removeChild(el));
    }

    if (insertAfter) parent = insertAfter.parentNode;

    if (firstElement && parent) {
      const nextSibling = insertAfter ? insertAfter.nextSibling : parent.firstChild;
      forEachInElementRange(firstElement, el => parent.insertBefore(el, nextSibling));
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomChangeQueue,
  hasExposedBackDoor: true,
});
