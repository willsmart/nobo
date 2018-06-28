const PublicApi = require('../general/public-api');
const ConvertIds = require('../convert-ids');
const TemplatedText = require('./templated-text');
const makeClassWatchable = require('../general/watchable');
const SharedState = require('../general/shared-state');

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
    if (!(Array.isArray(value) && value.length == 1 && ConvertIds.proxyableRowRegex.test(value[0]))) return;

    return ConvertIds.recomposeId({ proxyableRowId: value[0], fieldName }).proxyableDatapointId;
  }

  createElementsForVariantOfRow({ variant = undefined, proxyableRowOrDatapointId, depth = 1 }) {
    return this.createElementsUsingDatapointIds({
      templateDatapointId: templateDatapointIdforVariantOfRow({
        variant,
        proxyableRowOrDatapointId,
      }),
      depth,
    });
  }

  createElementsUsingDatapointIds({
    templateDatapointId,
    domDatapointId = undefined,
    proxyableRowId = undefined,
    depth = 1,
  }) {
    const domGenerator = this;

    let element;

    if (templateDatapointId) {
      if (!proxyableRowId) {
        proxyableRowId = ConvertIds.decomposeId({ proxyableDatapointId: templateDatapointId }).proxyableRowId;
      }
      if (!domDatapointId) {
        domDatapointId = domGenerator.dereferenceDatapointAsDatapointId({ datapointId: templateDatapointId });
      }
    }

    if (domDatapointId) {
      const domDatapoint = domGenerator.cache.getExistingDatapoint({ datapointId: domDatapointId });
      if (domDatapoint && typeof domDatapoint.valueIfAny == 'string') {
        element = (domGenerator.htmlToElement || htmlToElement)(domDatapoint.valueIfAny);
      }
    }

    if (!element) element = (domGenerator.htmlToElement || htmlToElement)('<div></div>');

    element.setAttribute('nobo-depth', depth);
    if (templateDatapointId) element.setAttribute('nobo-template-dpid', templateDatapointId);
    if (domDatapointId) element.setAttribute('nobo-dom-dpid', domDatapointId);

    if (!proxyableRowId) return [element];

    const { additionalSiblings } = domGenerator.prepDomTreeAndCreateChildren({
      element,
      proxyableRowId,
      depth,
    });
    return [element].concat(additionalSiblings);
  }

  prepDomTreeAndCreateChildren({ element, proxyableRowId, depth, lidCounter = undefined }) {
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
        proxyableRowId,
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

    domGenerator.prepValueFields({ element, proxyableRowId });

    const { additionalSiblings, lids: sibLids } = domGenerator.prepChildrenPlaceholderAndCreateChildren({
      element,
      proxyableRowId,
      lidCounter,
      depth,
    });

    domGenerator.notifyListeners('onprepelement', { element, proxyableRowId });

    if (sibLids) {
      if (!lids) lids = sibLids;
      else lids.push(...sibLids);
    }
    return { additionalSiblings, lids };
  }

  prepChildrenPlaceholderAndCreateChildren({ element, proxyableRowId, lidCounter, depth }) {
    const domGenerator = this;

    let lid,
      fieldName = childrenFieldNameForElement(element);
    if (!fieldName) return { additionalSiblings: [] };

    const proxyableDatapointId = ConvertIds.recomposeId({ proxyableRowId, fieldName }).proxyableDatapointId,
      childDepth = +(depth || 0) + 1;

    element.setAttribute('nobo-children-dpid', proxyableDatapointId);
    element.setAttribute('nobo-child-depth', childDepth);
    if (lidCounter) element.setAttribute('nobo-lid', (lid = lidCounter[0]++));

    const variant = element.getAttribute('variant') || undefined,
      additionalSiblings = domGenerator.createChildElements({
        proxyableDatapointId,
        variant,
        depth: childDepth,
      });
    return { additionalSiblings, lids: lid ? [lid] : undefined };
  }

  createChildElements({ proxyableDatapointId, variant, depth }) {
    const domGenerator = this,
      datapoint = domGenerator.cache.getExistingDatapoint({ datapointId: proxyableDatapointId }),
      rowOrDatapointIds = datapoint ? datapoint.valueIfAny : undefined;

    if (!Array.isArray(rowOrDatapointIds)) return [];

    const childElements = [];
    for (const proxyableRowOrDatapointId of rowOrDatapointIds) {
      childElements.push(
        ...domGenerator.createElementsForVariantOfRow({
          variant,
          proxyableRowOrDatapointId,
          depth,
        })
      );
    }
    return childElements;
  }

  prepValueFields({ element, proxyableRowId }) {
    const domGenerator = this;

    let index = 0;
    const usesByDatapointId = {};

    for (let childNode = element.firstChild; childNode; childNode = childNode.nextSibling) {
      if (childNode.nodeType == 3) {
        const templatedText = new TemplatedText({
          cache: domGenerator.cache,
          proxyableRowId,
          text: childNode.textContent,
        });
        const proxyableDatapointIds = Object.keys(templatedText.nodesByDatapointId);
        if (proxyableDatapointIds.length) {
          for (const proxyableDatapointId of proxyableDatapointIds) {
            usesByDatapointId[proxyableDatapointId] = usesByDatapointId[proxyableDatapointId] || {};
            usesByDatapointId[proxyableDatapointId][`=${index}`] = true;
          }
          element.setAttribute(`nobo-backup-text-${index}`, childNode.textContent);
          childNode.textContent = templatedText.evaluate.string;
        }

        index++;
      }
    }

    if (element.hasAttributes()) {
      for (const { name, value } of element.attributes) {
        if (name.startsWith('nobo-') || name == 'class' || name == 'id') continue;

        const templatedText = new TemplatedText({
          cache: domGenerator.cache,
          proxyableRowId,
          text: value,
        });
        const proxyableDatapointIds = Object.keys(templatedText.nodesByDatapointId);
        if (proxyableDatapointIds.length) {
          for (const proxyableDatapointId of proxyableDatapointIds) {
            usesByDatapointId[proxyableDatapointId] = usesByDatapointId[proxyableDatapointId] || {};
            usesByDatapointId[proxyableDatapointId][name] = true;
          }
          element.setAttribute(`nobo-backup--${name}`, value);
          element.setAttribute(name, templatedText.evaluate.string);
        }
      }
    }

    if (Object.keys(usesByDatapointId).length) {
      element.setAttribute('nobo-row-id', proxyableRowId);
      element.setAttribute(
        'nobo-val-dpids',
        Object.keys(usesByDatapointId)
          .sort()
          .join(' ')
      );
    }
    for (const [proxyableDatapointId, uses] of Object.entries(usesByDatapointId)) {
      element.setAttribute(
        `nobo-use-${proxyableDatapointId}`,
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
