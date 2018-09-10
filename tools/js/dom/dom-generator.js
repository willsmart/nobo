const PublicApi = require('../general/public-api');
const ConvertIds = require('../datapoints/convert-ids');
const TemplatedText = require('./templated-text');
const makeClassWatchable = require('../general/watchable');

const {
  templateDatapointIdForRowAndVariant,
  htmlToElement,
  datapointTemplateFieldClass,
  datapointDomFieldClass,
  datapointChildrenClass,
  datapointValueFieldClass,
  childrenFieldNameForElement,
  uniquePathForElement,
  templateDatapointIdforVariantOfRow,
} = require('./dom-functions');

// API is auto-generated at the bottom from the public interface of this class

class DomGenerator {
  // public methods
  static publicMethods() {
    return [
      'createElementsForVariantOfRow',
      'createChildElements',
      'createElementsUsingDatapointIds',
      'prepPage',
      'watch',
      'stopWatching',
    ];
  }

  constructor({ cache, htmlToElement }) {
    const domGenerator = this;

    domGenerator.cache = cache;
    domGenerator.nextUid = 1;
    domGenerator.htmlToElement = htmlToElement;
  }

  dereferenceDatapointAsDatapointId({ datapointId, fieldName = 'dom' }) {
    const domGenerator = this;

    if (!datapointId) return;

    const datapoint = domGenerator.cache.getExistingDatapoint({ datapointId });
    if (!datapoint) return;

    const value = datapoint.valueIfAny;
    if (!(Array.isArray(value) && value.length == 1 && ConvertIds.rowRegex.test(value[0]))) return;

    return ConvertIds.recomposeId({ rowId: value[0], fieldName }).datapointId;
  }

  createElementsForVariantOfRow({ variant = undefined, rowOrDatapointId, depth = 1 }) {
    const domGenerator = this;
    let variantDatapointIds, variantBackup;
    if (variant && ConvertIds.rowRegex.test(rowOrDatapointId)) {
      const templatedText = new TemplatedText({
        cache: domGenerator.cache,
        rowId: rowOrDatapointId,
        text: variant,
      });
      const dependencyTree = templatedText.dependencyTree;
      variantDatapointIds = Object.keys(templatedText.nodesByDatapointId);
      if (dependencyTree && dependencyTree.children) {
        variantBackup = variant;
        variant = templatedText.evaluate().string;
      }
    }
    return this.createElementsUsingDatapointIds({
      templateDatapointId: templateDatapointIdforVariantOfRow({
        variant,
        rowOrDatapointId,
      }),
      depth,
      variantDatapointIds,
      variantBackup,
    });
  }

  createElementsUsingDatapointIds({
    templateDatapointId,
    domDatapointId = undefined,
    rowId = undefined,
    domString = undefined,
    depth = 1,
    variantBackup,
    variantDatapointIds,
  }) {
    const domGenerator = this;

    let element;

    if (templateDatapointId) {
      if (!rowId) {
        rowId = ConvertIds.decomposeId({ datapointId: templateDatapointId }).rowId;
      }
      if (!domDatapointId) {
        domDatapointId = domGenerator.dereferenceDatapointAsDatapointId({ datapointId: templateDatapointId });
      }
    }

    if (domDatapointId) {
      const domDatapoint = domGenerator.cache.getExistingDatapoint({ datapointId: domDatapointId });
      if (domDatapoint && typeof domDatapoint.valueIfAny == 'string') {
        domString = domDatapoint.valueIfAny;
      }
    }
    if (domString) element = (domGenerator.htmlToElement || htmlToElement)(domString);
    if (!element) element = (domGenerator.htmlToElement || htmlToElement)('<div></div>');

    let usesByDatapointId;
    if (variantBackup) {
      element.setAttribute('nobo-backup---variant', variantBackup);
      element.setAttribute('nobo-variant-dpids', variantDatapointIds.join(' '));
      if (variantDatapointIds) {
        usesByDatapointId = {};
        for (const datapointId of variantDatapointIds) {
          usesByDatapointId[datapointId] = usesByDatapointId[datapointId] || {};
          usesByDatapointId[datapointId]['-variant'] = true;
        }
      }
    }

    if (templateDatapointId) element.setAttribute('nobo-template-dpid', templateDatapointId);
    if (domDatapointId) element.setAttribute('nobo-dom-dpid', domDatapointId);

    if (!rowId) return [element];

    const { additionalSiblings: elements } = domGenerator.prepDomTreeAndCreateChildren({
      element,
      rowId,
      depth,
      usesByDatapointId,
    });

    elements.unshift(element);

    element.setAttribute('nobo-uuid', domGenerator.nextUid++);

    const parent = (domGenerator.htmlToElement || htmlToElement)('<div></div>'); //TODO factory
    for (const child of elements) parent.appendChild(child);
    return elements;
  }

  prepDomTreeAndCreateChildren({ element, rowId, depth, lidCounter = undefined, usesByDatapointId = {} }) {
    const domGenerator = this;

    const childLidCounter = lidCounter || [1];

    let lids;

    let nextElementSibling;
    for (let childElement = element.firstElementChild; childElement; childElement = nextElementSibling) {
      nextElementSibling = childElement.nextElementSibling;
      const {
        additionalSiblings: additionalChildElements,
        lids: childLids,
      } = domGenerator.prepDomTreeAndCreateChildren({
        element: childElement,
        rowId,
        lidCounter: childLidCounter,
      });
      if (childLids) {
        if (!lids) lids = childLids;
        else lids.push(...childLids);
      }

      if (childElement.parentNode) {
        const nextSibling = childElement.nextSibling;
        for (const additionalChildElement of additionalChildElements) {
          childElement.parentNode.insertBefore(additionalChildElement, nextSibling);
        }
      }
    }

    if (lids) element.setAttribute('nobo-child-lids', ` ${lids.join(' ')} `);

    domGenerator.prepValueFields({ element, rowId, usesByDatapointId });

    const { additionalSiblings, lids: sibLids } = domGenerator.prepChildrenPlaceholderAndCreateChildren({
      element,
      rowId,
      lidCounter,
      depth,
    });

    domGenerator.notifyListeners('onprepelement', { element, rowId });

    if (sibLids) {
      if (!lids) lids = sibLids;
      else lids.push(...sibLids);
    }
    return { additionalSiblings, lids };
  }

  prepPage() {
    const domGenerator = this;

    const element = document.getElementById('page');
    domGenerator._prepChildrenPlaceholderAndCreateChildren({
      element,
      datapointId: 'page__1__items',
      childDepth: 1,
    });
    domGenerator.notifyListeners('onprepelement', { element, rowId: 'page__1' });
  }

  prepChildrenPlaceholderAndCreateChildren({ element, rowId, lidCounter, depth }) {
    const domGenerator = this;

    let rowOrDatapointIds;

    let fieldName = childrenFieldNameForElement(element);
    if (!fieldName) {
      if (element.classList.contains('model-child') && element.hasAttribute('model')) {
        const rowOrDatapointId = element.getAttribute('model');
        if (ConvertIds.rowRegex.test(rowOrDatapointId) || ConvertIds.datapointRegex.test(rowOrDatapointId)) {
          rowOrDatapointIds = [rowOrDatapointId];
        }
      }
      if (!rowOrDatapointIds) return { additionalSiblings: [] };
    }

    const datapointId = fieldName ? ConvertIds.recomposeId({ rowId, fieldName }).datapointId : undefined,
      childDepth = +(depth || 0) + 1;

    return domGenerator._prepChildrenPlaceholderAndCreateChildren({
      element,
      datapointId,
      rowOrDatapointIds,
      lidCounter,
      childDepth,
    });
  }

  _prepChildrenPlaceholderAndCreateChildren({ element, datapointId, rowOrDatapointIds, lidCounter, childDepth }) {
    const domGenerator = this;

    if (datapointId) element.setAttribute('nobo-children-dpid', datapointId);
    element.setAttribute('nobo-child-depth', childDepth);
    let lid;
    if (lidCounter) element.setAttribute('nobo-lid', (lid = lidCounter[0]++));

    const variant = element.getAttribute('variant') || undefined,
      additionalSiblings = domGenerator.createChildElements({
        datapointId,
        rowOrDatapointIds,
        variant,
        depth: childDepth,
      });
    return { additionalSiblings, lids: lid ? [lid] : undefined };
  }

  createChildElements({ datapointId, rowOrDatapointIds, variant, depth }) {
    const domGenerator = this,
      datapoint = datapointId ? domGenerator.cache.getExistingDatapoint({ datapointId }) : undefined;

    if (datapoint) rowOrDatapointIds = datapoint.valueIfAny;

    if (!Array.isArray(rowOrDatapointIds)) return [];

    const childElements = [];
    for (const rowOrDatapointId of rowOrDatapointIds) {
      childElements.push(
        ...domGenerator.createElementsForVariantOfRow({
          variant,
          rowOrDatapointId,
          depth,
        })
      );
    }
    return childElements;
  }

  prepValueFields({ element, rowId, usesByDatapointId = {} }) {
    const domGenerator = this;

    let index = 0;

    for (let childNode = element.firstChild; childNode; childNode = childNode.nextSibling) {
      if (childNode.nodeType == 3) {
        let textContent = childNode.textContent;
        for (
          const nextSibling = childNode.nextSibling;
          nextSibling && nextSibling.nodeType == 3;
          childNode = nextSibling, nextSibling = childNode.nextSibling
        ) {
          textContent += nextSibling.textContent;
          childNode.parentNode.removeChild(childNode);
        }

        const templatedText = new TemplatedText({
          cache: domGenerator.cache,
          rowId,
          text: textContent,
        });
        const dependencyTree = templatedText.dependencyTree,
          datapointIds = Object.keys(templatedText.nodesByDatapointId);
        if (dependencyTree && dependencyTree.children) {
          for (const datapointId of datapointIds) {
            usesByDatapointId[datapointId] = usesByDatapointId[datapointId] || {};
            usesByDatapointId[datapointId][`=${index}`] = true;
          }
          element.setAttribute(`nobo-backup-text-${index}`, childNode.textContent);
          childNode.textContent = templatedText.evaluate().string;
        }

        index++;
      }
    }

    if (element.hasAttributes()) {
      let eventListeners;
      for (const { name, value } of element.attributes) {
        if (name.startsWith('nobo-') || name == 'class' || name == 'id' || name == 'variant') continue;

        const templatedText = new TemplatedText({
          cache: domGenerator.cache,
          rowId,
          text: value,
        });
        const dependencyTree = templatedText.dependencyTree,
          datapointIds = Object.keys(templatedText.nodesByDatapointId);
        if (dependencyTree && dependencyTree.children) {
          for (const datapointId of datapointIds) {
            usesByDatapointId[datapointId] = usesByDatapointId[datapointId] || {};
            usesByDatapointId[datapointId][name] = true;
          }
          element.setAttribute(`nobo-backup--${name}`, value);
          if (name.startsWith('on')) {
            if (!eventListeners) eventListeners = {};
            eventListeners[name] = event => {
              templatedText.evaluate({ event });
            };
          } else {
            element.setAttribute(name, templatedText.evaluate().string);
          }
        }
      }
      if (eventListeners)
        for (const [name, func] of Object.entries(eventListeners)) {
          element.removeAttribute(name);
          element[name] = func;
        }
    }

    if (Object.keys(usesByDatapointId).length) {
      element.setAttribute('nobo-row-id', rowId);
      element.setAttribute(
        'nobo-val-dpids',
        Object.keys(usesByDatapointId)
          .sort()
          .join(' ')
      );
    }
    for (const [datapointId, uses] of Object.entries(usesByDatapointId)) {
      element.setAttribute(
        `nobo-use-${datapointId}`,
        Object.keys(uses)
          .sort()
          .join(' ')
      );
    }
  }
}

makeClassWatchable(DomGenerator);

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomGenerator,
  hasExposedBackDoor: true,
});
