const PublicApi = require('../general/public-api');
const ConvertIds = require('../convert-ids');
const TemplatedText = require('./templated-text');
const SharedState = require('../general/shared-state');
const diffAny = require('../general/diff');
const { elementForUniquePath } = require('../dom/dom-functions');

const {
  templateDatapointIdForRowAndVariant,
  htmlToElement,
  datapointTemplateFieldClass,
  datapointDomFieldClass,
  datapointChildrenClass,
  datapointValueFieldClass,
  childrenFieldNameForElement,
  childrenPlaceholders,
  datapointValueElements,
  datapointTemplateElements,
  datapointDomElements,
  rangeForElement,
  childRangeAtIndex,
} = require('./dom-functions');

// API is auto-generated at the bottom from the public interface of this class

class DomUpdater {
  // public methods
  static publicMethods() {
    return ['datapointUpdated'];
  }

  constructor({ cache, domGenerator }) {
    const domUpdater = this;

    domUpdater.nextUid = 1;

    domUpdater.domChanges = [];
    domUpdater.cache = cache;
    domUpdater.domGenerator = domGenerator;

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

        const uid = domUpdater.nextUid++;
        element.setAttribute('nobo-cb-uid', uid);

        if (templateDatapointId) {
          const datapoint = cache.getOrCreateDatapoint({ datapointId: templateDatapointId });
          datapoint.watch({
            callbackKey: `updater-${uid}-template`,
            onvalid: () => {
              domUpdater.queueDomChange({
                replace: element,
                withElements: domGenerator.createElementsUsingDatapointIds({
                  templateDatapointId,
                  depth,
                }),
              });
            },
          });
        }
        if (domDatapointId) {
          const datapoint = cache.getOrCreateDatapoint({ datapointId: domDatapointId });
          datapoint.watch({
            callbackKey: `updater-${uid}-dom`,
            onvalid: () => {
              domUpdater.queueDomChange({
                replace: element,
                withElements: domGenerator.createElementsUsingDatapointIds({
                  templateDatapointId,
                  domDatapointId,
                  depth,
                }),
              });
            },
          });
        }
        if (childrenDatapointId) {
          const datapoint = cache.getOrCreateDatapoint({ datapointId: childrenDatapointId }),
            childDepth = element.getAttribute('nobo-child-depth');
          let childrenWere = Array.isArray(datapoint.valueIfAny) ? datapoint.valueIfAny : [];

          datapoint.watch({
            callbackKey: `updater-${uid}-children`,
            onvalid: () => {
              const children = Array.isArray(datapoint.valueIfAny) ? datapoint.valueIfAny : [],
                diff = diffAny(childrenWere, children),
                variant = element.getAttribute('variant') || undefined;

              if (!diff) return;
              if (!diff.arrayDiff) {
                let [startElement, endElement] = rangeForElement(element);
                startElement = startElement.nextElementSibling;

                domUpdater.queueDomChange({
                  replace: [startElement, endElement],
                  withElements: domGenerator.createChildElements({
                    proxyableDatapointId: childrenDatapointId,
                    variant,
                    depth: childDepth,
                  }),
                });
              } else {
                for (const diffPart of diff.arrayDiff) {
                  if (diffPart.insertAt !== undefined) {
                    domUpdater.queueDomChange({
                      insertAfter: childRangeAtIndex({ placeholderDiv: element, index: diffPart.insertAt - 1 })[1],
                      withElements: domGenerator.createElementsForVariantOfRow({
                        variant,
                        proxyableRowOrDatapointId: diffPart.value,
                        depth: childDepth,
                      }),
                    });
                    continue;
                  }
                  if (diffPart.deleteAt !== undefined) {
                    domUpdater.queueDomChange({
                      replace: childRangeAtIndex({ placeholderDiv: element, index: diffPart.deleteAt }),
                    });
                    continue;
                  }
                  if (diffPart.at !== undefined) {
                    domUpdater.queueDomChange({
                      replace: childRangeAtIndex({ placeholderDiv: element, index: diffPart.at }),
                      withElements: domGenerator.createElementsForVariantOfRow({
                        variant,
                        proxyableRowOrDatapointId: diffPart.value,
                        depth: childDepth,
                      }),
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
            const datapoint = cache.getOrCreateDatapoint({ datapointId });
            datapoint.watch({
              callbackKey: `updater-${uid}-value`,
              onvalid: () => {
                const usesString = element.getAttribute(`nobo-use-${datapointId}`),
                  uses = usesString ? usesString.split(' ') : undefined,
                  proxyableRowId = element.getAttribute('nobo-row-id');

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
                            proxyableRowId,
                            text: templateText,
                          });
                          childNode.textContent = templatedText.evaluate.string;
                        }
                      }
                      continue;
                    }
                    const name = use,
                      templateText = element.getAttribute(`nobo-backup--${name}`);
                    const templatedText = new TemplatedText({
                      cache,
                      proxyableRowId,
                      text: templateText,
                    });
                    element.setAttribute(name, templatedText.evaluate.string);
                  }
                }
              },
            });
          }
        }
      },
    });

    domUpdater.cache_callbackKey = cache.watch({
      onvalid: () => {
        domUpdater.applyDomChanges();
      },
    });
  }

  queueDomChange({ replace, insertAfter, withElements }) {
    const domUpdater = this;

    domUpdater.domChanges.push({ replace, insertAfter, withElements });
  }

  applyDomChanges() {
    const domUpdater = this;

    if (domUpdater.domChanges.length) {
      const changes = domUpdater.domChanges;
      domUpdater.domChanges = [];
      for (const change of changes) {
        domUpdater.applyDomChange(change);
      }
    }
  }

  applyDomChange({ replace, insertAfter, parent, withElements }) {
    const domUpdater = this;

    if (replace) {
      if (!Array.isArray(replace)) {
        replace = rangeForElement(replace);
      }

      const [start, end] = replace;
      parent = start.parentElement;

      for (let element = start; element; element = element.nextElementSibling) {
        domUpdater.stopWatchers(element);
        if (element == end) break;
      }

      insertAfter = start.previousElementSibling;

      for (
        let element = start, next = element.nextElementSibling;
        element;
        element = next, next = element ? element.nextElementSibling : undefined
      ) {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }
    }

    if (insertAfter) parent = insertAfter.parentNode;

    if (withElements && withElements.length && parent) {
      const nextSibling = insertAfter ? insertAfter.nextSibling : parent.firstChild;
      for (const element of withElements) {
        parent.insertBefore(element, nextSibling);
      }
    }
  }

  stopWatchers(element) {
    const domUpdater = this,
      templateDatapointId = element.getAttribute('nobo-template-dpid'),
      domDatapointId = element.getAttribute('nobo-dom-dpid'),
      childrenDatapointId = element.getAttribute('nobo-children-dpid'),
      valueDatapointIdsString = element.getAttribute('nobo-val-dpids'),
      valueDatapointIds = valueDatapointIdsString ? valueDatapointIdsString.split(' ') : undefined,
      uid = element.getAttribute('nobo-cb-uid');

    if (!uid || !(templateDatapointId || domDatapointId || childrenDatapointId || valueDatapointIds)) {
      return;
    }

    if (templateDatapointId) {
      const datapoint = domUpdater.cache.getExistingDatapoint({ datapointId: templateDatapointId });
      datapoint.stopWatching({
        callbackKey: `updater-${uid}-template`,
      });
    }
    if (domDatapointId) {
      const datapoint = domUpdater.cache.getExistingDatapoint({ datapointId: domDatapointId });
      datapoint.stopWatching({
        callbackKey: `updater-${uid}-dom`,
      });
    }
    if (childrenDatapointId) {
      const datapoint = domUpdater.cache.getExistingDatapoint({ datapointId: childrenDatapointId });
      datapoint.stopWatching({
        callbackKey: `updater-${uid}-children`,
      });
    }
    if (valueDatapointIds) {
      for (const datapointId of valueDatapointIds) {
        const datapoint = domUpdater.cache.getExistingDatapoint({ datapointId });
        datapoint.stopWatching({
          callbackKey: `updater-${uid}-value`,
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
