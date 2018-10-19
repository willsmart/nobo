const PublicApi = require('../general/public-api');
const TemplatedText = require('./templated-text');
const diffAny = require('../general/diff');
const ConvertIds = require('../datapoints/convert-ids');
const DomWaitingChangeQueue = require('./dom-waiting-change-queue');
const { nameForElement, cloneShowingElementNames } = require('../general/name-for-element');
const log = require('../general/log');

const { rangeForElement, childRangeAtIndex, variantForTemplateDatapointId } = require('./dom-functions');

// API is auto-generated at the bottom from the public interface of the DomUpdater class

const waitCountAttributeName = 'nobo-wait-count';
const waitNamesAttributeName = 'nobo-wait-names';

function elementWaitCount(element) {
  return Number(element.getAttribute(waitCountAttributeName) || 0);
}

function elementWaitNames(element) {
  const names = element.getAttribute(waitNamesAttributeName);
  return names ? names.split(' ') : [];
}

function incElementWaitCount(element, name) {
  const waitCount = elementWaitCount(element) + 1;
  element.setAttribute(waitCountAttributeName, waitCount);
  const waitNames = elementWaitNames(element);
  if (waitNames.indexOf(name) != -1)
    log('err.dom', `Didn't expect element ${nameForElement(element)} to already be waiting on name ${name}`);
  waitNames.push(name);
  element.setAttribute(waitNamesAttributeName, waitNames.join(' '));
  return waitCount;
}

function decElementWaitCount(element, name) {
  const waitCount = elementWaitCount(element) - 1;
  if (waitCount) {
    element.setAttribute(waitCountAttributeName, waitCount);
  } else {
    element.removeAttribute(waitCountAttributeName);
  }
  const waitNames = elementWaitNames(element);
  const index = waitNames.indexOf(name);
  if (index == -1) log('err.dom', `Expected element ${nameForElement(element)} to be waiting on name ${name}`);
  else waitNames.splice(index, 1);
  if (waitNames.length) {
    element.setAttribute(waitNamesAttributeName, waitNames.join(' '));
  } else {
    element.removeAttribute(waitNamesAttributeName);
  }
  return waitCount;
}

function callbackKeyOnElement(element, type) {
  return `updater-${type}-${nameForElement(element)}`;
}

class DomUpdater {
  // public methods
  static publicMethods() {
    return ['datapointUpdated', 'domWaitingChangeQueue'];
  }

  get domWaitingChangeQueue() {
    return this._domWaitingChangeQueue;
  }

  constructor({ cache, domGenerator }) {
    const domUpdater = this;

    Object.assign(domUpdater, {
      cloneShowingElementNames,
      cache,
      domGenerator: domGenerator,
      _domWaitingChangeQueue: new DomWaitingChangeQueue(),
    });

    domUpdater.dg_callbackKey = domGenerator.watch({
      onprepelement: ({ element }) => {
        const templateDatapointId = element.getAttribute('nobo-template-dpid'),
          domDatapointId = element.getAttribute('nobo-dom-dpid'),
          childrenDatapointId = element.getAttribute('nobo-children-dpid'),
          valueDatapointIdsString = element.getAttribute('nobo-val-dpids'),
          valueDatapointIds = valueDatapointIdsString ? valueDatapointIdsString.split(' ') : undefined,
          depth = element.getAttribute('nobo-depth');

        if (!(templateDatapointId || domDatapointId || childrenDatapointId || valueDatapointIds)) {
          return;
        }

        if (templateDatapointId) {
          const datapoint = cache.getOrCreateDatapoint(templateDatapointId);
          if (!datapoint.initialized) {
            log(
              'dom',
              'dom',
              `> dp ${datapoint.datapointId} not initialized (wanted for template on element ${nameForElement(
                element
              )})`
            );
            incElementWaitCount(element, datapoint.datapointId);
          }
          datapoint.watch({
            callbackKey: callbackKeyOnElement(element, 'template'),
            onchange: () => {
              const variantBackup = element.getAttribute('nobo-backup---variant'),
                variantDatapointIdsString = element.getAttribute('nobo-variant-dpids'),
                variantDatapointIds = variantDatapointIdsString ? variantDatapointIdsString.split(' ') : [];
              domUpdater.queueDomChange({
                replace: element,
                firstElement: domGenerator.createElementsUsingDatapointIds({
                  templateDatapointId,
                  depth,
                  variantBackup,
                  variantDatapointIds,
                })[0],
              });
            },
          });
        }
        if (domDatapointId) {
          const datapoint = cache.getOrCreateDatapoint(domDatapointId);
          if (!datapoint.initialized) {
            log(
              'dom',
              `> dp ${datapoint.datapointId} not initialized (wanted for dom on element ${nameForElement(element)})`
            );
            incElementWaitCount(element, datapoint.datapointId);
          }
          datapoint.watch({
            callbackKey: callbackKeyOnElement(element, 'dom'),
            onchange: () => {
              const variantBackup = element.getAttribute('nobo-backup---variant'),
                variantDatapointIdsString = element.getAttribute('nobo-variant-dpids'),
                variantDatapointIds = variantDatapointIdsString ? variantDatapointIdsString.split(' ') : [];
              domUpdater.queueDomChange({
                replace: element,
                firstElement: domGenerator.createElementsUsingDatapointIds({
                  templateDatapointId,
                  domDatapointId,
                  depth,
                  variantBackup,
                  variantDatapointIds,
                })[0],
              });
            },
          });
        }
        if (childrenDatapointId) {
          const datapoint = cache.getOrCreateDatapoint(childrenDatapointId),
            childDepth = element.getAttribute('nobo-child-depth') || 1;
          let childrenWere = Array.isArray(datapoint.valueIfAny) ? datapoint.valueIfAny : [];

          if (!datapoint.initialized) {
            log(
              'dom',
              `> dp ${datapoint.datapointId} not initialized (wanted for children of element ${nameForElement(
                element
              )})`
            );
            incElementWaitCount(element, datapoint.datapointId);
          }
          datapoint.watch({
            callbackKey: callbackKeyOnElement(element, 'children'),
            oninit: () => {
              log(
                'dom',
                `< dp ${datapoint.datapointId} is now initialized (wanted for children of element ${nameForElement(
                  element
                )})`,
                datapoint.valueIfAny
              );
              domUpdater.decWaitCount(element, datapoint.datapointId);
            },
            onchange: () => {
              const children = Array.isArray(datapoint.valueIfAny) ? datapoint.valueIfAny : [],
                diff = diffAny(childrenWere, children),
                variant = element.getAttribute('variant') || undefined;

              if (!diff) return;
              if (!diff.arrayDiff) {
                log('err', 'Expected array diff');
                return;
              } else {
                for (const diffPart of diff.arrayDiff) {
                  if (diffPart.insertAt !== undefined) {
                    domUpdater.queueDomChange({
                      insertAfter: childRangeAtIndex({ placeholderDiv: element, index: diffPart.insertAt - 1 })[1],
                      firstElement: domGenerator.createElementsForVariantOfRow({
                        variant,
                        rowOrDatapointId: diffPart.value,
                        depth: childDepth,
                      })[0],
                    });
                    continue;
                  }
                  if (diffPart.deleteAt !== undefined) {
                    domUpdater.queueDomChange({
                      replace: childRangeAtIndex({ placeholderDiv: element, index: diffPart.deleteAt })[0],
                    });
                    continue;
                  }
                  if (diffPart.at !== undefined) {
                    domUpdater.queueDomChange({
                      replace: childRangeAtIndex({ placeholderDiv: element, index: diffPart.at })[0],
                      firstElement: domGenerator.createElementsForVariantOfRow({
                        variant,
                        rowOrDatapointId: diffPart.value,
                        depth: childDepth,
                      })[0],
                    });
                    continue;
                  }
                }
              }
              childrenWere = children;
            },
          });
        }
        if (valueDatapointIds) {
          for (const datapointId of valueDatapointIds) {
            const datapoint = cache.getOrCreateDatapoint(datapointId);
            if (!datapoint.initialized) {
              log(
                'dom',
                `> dp ${datapoint.datapointId} not initialized (wanted for value on element ${nameForElement(element)})`
              );
              incElementWaitCount(element, datapoint.datapointId);
            }
            datapoint.watch({
              callbackKey: callbackKeyOnElement(element, 'value'),
              oninit: () => {
                log(
                  'dom',
                  `< dp ${datapoint.datapointId} is now initialized (wanted for value on element ${nameForElement(
                    element
                  )})`,
                  datapoint.valueIfAny
                );
                domUpdater.decWaitCount(element, datapoint.datapointId);
              },
              onchange: () => {
                const usesString = element.getAttribute(`nobo-use-${datapointId}`),
                  uses = usesString ? usesString.split(' ') : undefined,
                  rowId = element.getAttribute('nobo-row-id');

                if (uses) {
                  for (const use of uses) {
                    const indexMatch = /^=(\d+)$/.exec(use);
                    if (indexMatch) {
                      const index = indexMatch[1],
                        templateText = element.getAttribute(`nobo-backup-text-${index}`);
                      let upToIndex = 0;
                      for (let childNode = element.firstChild; childNode; childNode = childNode.nextSibling) {
                        if (childNode.nodeType == 3) {
                          if (index < upToIndex++) continue;

                          const templatedText = new TemplatedText({
                            cache,
                            rowId,
                            text: templateText,
                          });

                          // Delete runs of text nodes, which were probably put there by an edit with contentEditable
                          for (
                            let nextSibling = childNode.nextSibling;
                            nextSibling && nextSibling.nodeType == 3;
                            childNode = nextSibling, nextSibling = childNode.nextSibling
                          ) {
                            childNode.parentNode.removeChild(childNode);
                          }

                          childNode.textContent = templatedText.evaluate().string;
                          break;
                        }
                      }
                      continue;
                    }
                    const name = use,
                      templateText = element.getAttribute(`nobo-backup--${name}`);
                    const templatedText = new TemplatedText({
                      cache,
                      rowId,
                      text: templateText,
                    });
                    if (name.startsWith('on')) {
                      element[name] = event => {
                        templatedText.evaluate({ event });
                      };
                    } else
                      switch (name) {
                        default:
                          element.setAttribute(name, templatedText.evaluate().string);
                          break;
                        case '-variant':
                          if (!templateDatapointId) break;
                          const newVariant = templatedText.evaluate().string,
                            oldVariant = variantForTemplateDatapointId(templateDatapointId);
                          if (newVariant == oldVariant) break;
                          domUpdater.queueDomChange({
                            replace: element,
                            firstElement: domGenerator.createElementsForVariantOfRow({
                              variant: templateText,
                              rowOrDatapointId: ConvertIds.decomposeId({ datapointId: templateDatapointId }).rowId,
                              depth,
                            })[0],
                          });
                          break;
                      }
                  }
                }
              },
            });
          }
        }
      },
    });
  }

  decWaitCount(element, name) {
    const domUpdater = this,
      waitCount = decElementWaitCount(element, name);
    if (!waitCount) {
      domUpdater.domWaitingChangeQueue.elementIsDoneWaiting(element);
    }
  }

  queueDomChange(change) {
    const domUpdater = this;
    let { replace } = change;

    if (replace) {
      domUpdater.stopWatchersOnRange(replace);
    }

    domUpdater.domWaitingChangeQueue.push(change);
  }

  stopWatchersOnRange(range) {
    const domUpdater = this;

    if (!range) return;

    if (!Array.isArray(range)) {
      range = rangeForElement(range);
    }

    const [start, end] = range;
    parent = start.parentElement;

    for (let element = start; element; element = element.nextElementSibling) {
      domUpdater.stopWatchers(element);
      if (element == end) break;
    }
  }

  stopWatchers(element) {
    const domUpdater = this,
      templateDatapointId = element.getAttribute('nobo-template-dpid'),
      domDatapointId = element.getAttribute('nobo-dom-dpid'),
      childrenDatapointId = element.getAttribute('nobo-children-dpid'),
      valueDatapointIdsString = element.getAttribute('nobo-val-dpids'),
      valueDatapointIds = valueDatapointIdsString ? valueDatapointIdsString.split(' ') : undefined;

    if (!(templateDatapointId || domDatapointId || childrenDatapointId || valueDatapointIds)) {
      return;
    }

    if (templateDatapointId) {
      const datapoint = domUpdater.cache.getExistingDatapoint(templateDatapointId);
      datapoint.stopWatching({
        callbackKey: callbackKeyOnElement(element, 'template'),
      });
    }
    if (domDatapointId) {
      const datapoint = domUpdater.cache.getExistingDatapoint(domDatapointId);
      datapoint.stopWatching({
        callbackKey: callbackKeyOnElement(element, 'dom'),
      });
    }
    if (childrenDatapointId) {
      const datapoint = domUpdater.cache.getExistingDatapoint(childrenDatapointId);
      datapoint.stopWatching({
        callbackKey: callbackKeyOnElement(element, 'children'),
      });
    }
    if (valueDatapointIds) {
      for (const datapointId of valueDatapointIds) {
        const datapoint = domUpdater.cache.getExistingDatapoint(datapointId);
        datapoint.stopWatching({
          callbackKey: callbackKeyOnElement(element, 'value'),
        });
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomUpdater,
  hasExposedBackDoor: true,
});
