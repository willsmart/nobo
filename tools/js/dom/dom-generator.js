const PublicApi = require('../general/public-api');
const ConvertIds = require('../convert-ids');
const TemplatedText = require('./templated-text');
const clone = require('../general/clone');
const diffAny = require('../general/diff');
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
  childRangeAtIndex,
  rangeForElement,
} = require('./dom-functions');

// API is auto-generated at the bottom from the public interface of this class

class DomGenerator {
  // public methods
  static publicMethods() {
    return [
      'createElementsForVariantOfRow',
      'createAllChildElements',
      'createElementsUsingTemplateDatapointId',
      'createElementsUsingDomDatapointId',
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
    domGenerator._replacements = [];

    domGenerator.elementsByDatapointId = {};
  }

  datapointIdsForElement(element) {
    const values = element.getAttribute('nobo-value-dbids');
    const ret = {
      template: element.getAttribute('nobo-template-dpid') || undefined,
      dom: element.getAttribute('nobo-dom-dpid') || undefined,
      children: element.getAttribute('nobo-children-dpid') || undefined,
      values: values ? values.split(' ') : undefined,
    };

    return ret;
  }

  stopWatchingDatapoint(element, type, proxyableDatapointId) {
    const uid = element.getAttribute('nobo-uid'),
      datapoint = this.cache.getExistingDatapoint({ datapointId: proxyableDatapointId });
    if (!datapoint || !uid) return;
    datapoint.stopWatching({ callbackKey: `dom__${uid}__${type}` });
  }

  watchDatapoint(element, type, proxyableDatapointId, callback) {
    let uid = element.getAttribute('nobo-uid'),
      datapoint = this.cache.getOrCreateDatapoint({ datapointId: proxyableDatapointId });
    if (!uid) element.setAttribute('nobo-uid', (uid = this.nextUid++));
    datapoint.watch({ callbackKey: `dom__${uid}__${type}`, onvalid: datapoint => callback(datapoint.valueIfAny) });
  }

  killRange([startElement, endElement]) {
    const domGenerator = this;

    for (let element = startElement; ; element = element.nextElementSibling) {
      if (element.classList.contains('nobo-dead')) continue;
      domGenerator.killElement(element);
      if (element.firstElementChild) {
        domGenerator.killRange([element.firstElementChild, element.lastElementChild]);
      }
      if (element === endElement) break;
    }
  }

  killElement(element) {
    const domGenerator = this;

    if (element.classList.contains('nobo-dead')) return;

    element.classList.add('nobo-dead');

    for (const [type, datapointId] of Object.entries(domGenerator.datapointIdsForElement(element))) {
      if (!datapointId) continue;
      if (type != 'values') {
        domGenerator.stopWatchingDatapoint(element, type, datapointId);
      } else {
        const datapointIds = datapointId;
        for (const datapointId of datapointIds) {
          domGenerator.stopWatchingDatapoint(element, type, datapointId);
        }
      }
    }
  }

  createElementsForVariantOfRow({ variant, proxyableRowId, placeholderUid, basedOnElement }) {
    variant = variant || '';
    if (typeof proxyableRowId == 'string' && ConvertIds.proxyableDatapointRegex.test(proxyableRowId)) {
      ({ proxyableRowId, fieldName: variant } = ConvertIds.decomposeId({ proxyableDatapointId: proxyableRowId }));
    }
    const domGenerator = this,
      templateDatapointId =
        typeof proxyableRowId == 'string' && ConvertIds.proxyableRowRegex.test(proxyableRowId)
          ? templateDatapointIdForRowAndVariant(proxyableRowId, variant)
          : undefined;
    return domGenerator.createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid, basedOnElement });
  }

  createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid, basedOnElement }) {
    const domGenerator = this;

    if (basedOnElement) {
      if (!templateDatapointId) templateDatapointId = basedOnElement.getAttribute('nobo-template-dpid');

      const path = uniquePathForElement(basedOnElement),
        overrides = SharedState.global.state.overriddenElementDatapoints,
        override = overrides && path ? overrides[path] : undefined;

      if (override && typeof override == 'string') {
        if (ConvertIds.fieldNameRegex.test(override)) {
          const { proxyableRowId } = ConvertIds.decomposeId({ proxyableDatapointId: templateDatapointId });
          templateDatapointId = templateDatapointIdForRowAndVariant(proxyableRowId, override);
        } else if (ConvertIds.proxyableDatapointRegex.test(override)) {
          const { proxyableRowId, fieldName: variant } = ConvertIds.decomposeId({ proxyableDatapointId: override });
          templateDatapointId = templateDatapointIdForRowAndVariant(proxyableRowId, variant);
        }
      }
    }

    if (basedOnElement && (!templateDatapointId || typeof templateDatapointId != 'string')) {
      templateDatapointId = basedOnElement.getAttribute('nobo-orig-template-dpid');
    }

    const templateDatapoint = templateDatapointId
      ? domGenerator.cache.getOrCreateDatapoint({ datapointId: templateDatapointId })
      : undefined;

    let domDatapointId, proxyableRowId;
    if (templateDatapoint) {
      proxyableRowId = ConvertIds.decomposeId({ proxyableDatapointId: templateDatapointId }).proxyableRowId;
      const templateDatapointValue = templateDatapoint.valueIfAny || [];
      if (
        Array.isArray(templateDatapointValue) &&
        templateDatapointValue.length == 1 &&
        ConvertIds.proxyableRowRegex.test(templateDatapointValue[0])
      ) {
        domDatapointId = ConvertIds.recomposeId({ proxyableRowId: templateDatapointValue[0], fieldName: 'dom' })
          .proxyableDatapointId;
      }
    }

    const elements = domGenerator.createElementsUsingDomDatapointId({
      templateDatapointId,
      domDatapointId,
      proxyableRowId,
      placeholderUid,
      basedOnElement,
    });

    return elements;
  }

  createElementsUsingDomDatapointId({
    templateDatapointId,
    domDatapointId,
    proxyableRowId,
    placeholderUid,
    basedOnElement,
  }) {
    const domGenerator = this;
    if (basedOnElement) {
      if (!placeholderUid) placeholderUid = basedOnElement.getAttribute('nobo-placeholder-uid');
      if (!domDatapointId) domDatapointId = basedOnElement.getAttribute('nobo-dom-dpid');
      if (!templateDatapointId) templateDatapointId = basedOnElement.getAttribute('nobo-template-dpid');
    }

    if (templateDatapointId && !proxyableRowId) {
      proxyableRowId = ConvertIds.decomposeId({ proxyableDatapointId: templateDatapointId }).proxyableRowId;
    }

    const domDatapoint = domDatapointId
      ? domGenerator.cache.getOrCreateDatapoint({ datapointId: domDatapointId })
      : undefined;

    const domString = (domDatapoint ? domDatapoint.valueIfAny : undefined) || '<div></div>';

    let element = (domGenerator.htmlToElement || htmlToElement)(domString);
    if (!element) element = (domGenerator.htmlToElement || htmlToElement)('<div></div>');

    if (basedOnElement) {
      element.setAttribute('nobo-orig-template-dpid', basedOnElement.getAttribute('nobo-orig-template-dpid'));
    } else {
      if (templateDatapointId) element.setAttribute('nobo-orig-template-dpid', templateDatapointId);
    }

    if (placeholderUid) element.setAttribute('nobo-placeholder-uid', placeholderUid);

    element.classList.add('nobodom'); // a coverall class for any element that is the root of a nobo dom tree,

    if (domDatapointId) {
      element.setAttribute('nobo-dom-dpid', domDatapointId);
      element.classList.add(datapointDomFieldClass(domDatapointId));

      domGenerator.watchDatapoint(element, 'dom', domDatapointId, value => {
        const replaceRange = rangeForElement(element);
        const elements = domGenerator.createElementsUsingDomDatapointId({
          templateDatapointId,
          domDatapointId,
          proxyableRowId,
          placeholderUid,
          basedOnElement: element,
        });
        domGenerator.killRange(replaceRange);
        domGenerator._replacements.push({ replaceRange, elements });
        domGenerator.queueDomReplacement();
      });
    }

    if (templateDatapointId) {
      element.setAttribute('nobo-template-dpid', templateDatapointId);
      element.classList.add(datapointTemplateFieldClass(templateDatapointId));

      domGenerator.watchDatapoint(element, 'template', templateDatapointId, value => {
        const replaceRange = rangeForElement(element);
        const elements = domGenerator.createElementsUsingTemplateDatapointId({
          templateDatapointId,
          placeholderUid,
          basedOnElement: element,
        });
        domGenerator.killRange(replaceRange);
        domGenerator._replacements.push({ replaceRange, elements });
        domGenerator.queueDomReplacement();
      });
    }

    const elements = [element];
    if (proxyableRowId) {
      const { additionalSiblings } = domGenerator.prepDomTreeAndCreateChildren({
        element,
        proxyableRowId,
      });
      elements.push(...additionalSiblings);
    }
    return elements;
  }

  prepDomTreeAndCreateChildren({ element, proxyableRowId, lidCounter }) {
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
      for (let index = additionalChildElements.length - 1; index >= 0; index--) {
        childElement.insertAdjacentElement('afterend', additionalChildElements[index]);
      }
    }

    if (lids) element.setAttribute('nobo-child-lids', ` ${lids.join(' ')} `);

    domGenerator.notifyListeners('onprepelement', { element, proxyableRowId });

    domGenerator.prepValueFields({ element, proxyableRowId });

    const { additionalSiblings, lids: sibLids } = domGenerator.prepChildrenPlaceholderAndCreateChildren({
      element,
      proxyableRowId,
      lidCounter,
    });
    if (sibLids) {
      if (!lids) lids = sibLids;
      else lids.push(...sibLids);
    }
    return { additionalSiblings, lids };
  }

  prepChildrenPlaceholderAndCreateChildren({ element, proxyableRowId, lidCounter }) {
    const domGenerator = this;

    let fieldName = childrenFieldNameForElement(element);
    if (!fieldName) return { additionalSiblings: [] };

    const proxyableDatapointId = ConvertIds.recomposeId({ proxyableRowId, fieldName }).proxyableDatapointId;

    return domGenerator.prepChildrenPlaceholderAndCreateChildrenGivenDatapointId({
      element,
      proxyableDatapointId,
      lidCounter,
    });
  }

  prepPage() {
    const domGenerator = this,
      page = document.getElementById('page'),
      newElements = domGenerator.prepChildrenPlaceholderAndCreateChildrenGivenDatapointId({
        element: page,
        proxyableDatapointId: 'page__1__items',
      });
    for (let index = newElements.length - 1; index >= 0; index--) {
      page.insertAdjacentElement('afterend', newElements[index]);
    }
  }

  prepChildrenPlaceholderAndCreateChildrenGivenDatapointId({ element, proxyableDatapointId, lidCounter }) {
    const domGenerator = this;

    let lid = lidCounter ? lidCounter[0]++ : 0;

    const placeholderUid = domGenerator.nextUid++;
    element.setAttribute('nobo-children-dpid', proxyableDatapointId);

    const childrenDatapoint = domGenerator.cache.getOrCreateDatapoint({ datapointId: proxyableDatapointId }),
      childrenDatapointValue = Array.isArray(childrenDatapoint.valueIfAny) ? clone(childrenDatapoint.valueIfAny) : [];

    const variant = element.getAttribute('variant') || undefined;

    domGenerator.watchDatapoint(element, 'children', proxyableDatapointId, value => {
      value = Array.isArray(value) ? value : [];

      const diff = diffAny(childrenDatapointValue, value);
      if (diff && diff.arrayDiff) {
        for (const diffPart of diff.arrayDiff) {
          if (!diffPart) continue;
          if (diffPart.deleteAt !== undefined) {
            const replaceRange = childRangeAtIndex({ placeholderDiv: element, index: diffPart.deleteAt });
            domGenerator.killRange(replaceRange);
            domGenerator._replacements.push({ replaceRange });
            domGenerator.queueDomReplacement();
          } else if (diffPart.insertAt !== undefined) {
            const [startElement, endElement] = childRangeAtIndex({
              placeholderDiv: element,
              index: diffPart.insertAt - 1,
            });
            const elements = this.createChildElementsFromValue({
              rowOrDatapointId: diffPart.value,
              defaultVariant: variant,
              placeholderUid,
            });
            domGenerator._replacements.push({ afterElement: endElement, elements });
            domGenerator.queueDomReplacement();
          } else if (diffPart.value !== undefined) {
            const replaceRange = childRangeAtIndex({ placeholderDiv: element, index: diffPart.deleteAt });
            const elements = this.createChildElementsFromValue({
              rowOrDatapointId: diffPart.value,
              defaultVariant: variant,
              placeholderUid,
            });
            domGenerator.killRange(replaceRange);
            domGenerator._replacements.push({ replaceRange, elements });
            domGenerator.queueDomReplacement();
          }
        }
      }
    });

    element.setAttribute('nobo-uid', placeholderUid);
    element.setAttribute('nobo-lid', lid);
    element.classList.add('noboplaceholder', datapointChildrenClass(proxyableDatapointId));

    const additionalSiblings = domGenerator.createAllChildElements({
      childRowsOrDatapointIds: childrenDatapointValue,
      variant,
      placeholderUid,
    });
    return { additionalSiblings, lids: lid ? [lid] : undefined };
  }

  createAllChildElements({ childRowsOrDatapointIds, variant, placeholderUid }) {
    const domGenerator = this;

    if (!Array.isArray(childRowsOrDatapointIds)) return [];

    const childElements = [];
    for (const rowOrDatapointId of childRowsOrDatapointIds) {
      childElements.push(
        ...createChildElementsFromValue({ rowOrDatapointId, defaultVariant: variant, placeholderUid })
      );
    }
    return childElements;
  }

  createChildElementsFromValue({ rowOrDatapointId, defaultVariant, placeholderUid }) {
    const domGenerator = this;
    let proxyableRowId,
      localVariant = defaultVariant;
    if (typeof rowOrDatapointId == 'string') {
      if (ConvertIds.proxyableRowRegex.test(rowOrDatapointId)) proxyableRowId = rowOrDatapointId;
      if (ConvertIds.proxyableDatapointRegex.test(rowOrDatapointId)) {
        const datapointInfo = ConvertIds.decomposeId({ proxyableDatapointId: rowOrDatapointId });
        proxyableRowId = datapointInfo.proxyableRowId;
        localVariant = datapointInfo.fieldName;
      }
    }
    return domGenerator.createElementsForVariantOfRow({
      variant: localVariant,
      proxyableRowId,
      placeholderUid,
    });
  }

  prepValueFields({ element, proxyableRowId }) {
    const domGenerator = this;

    let index = 0;
    const usesByDatapointId = {};

    for (let childNode = element.firstChild; childNode; childNode = childNode.nextSibling) {
      if (childNode.nodeType == 3) {
        const backupName = `nobo-backup-text-${index}`;
        if (element.hasAttribute(backupName)) continue;

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
          element.setAttribute(backupName, childNode.textContent);
          childNode.textContent = templatedText.evaluate.string;
        }

        index++;
      }
    }

    if (element.hasAttributes())
      for (const { name, value } of element.attributes) {
        if (name.startsWith('nobo-') || name == 'class' || name == 'id') continue;

        const backupName = `nobo-backup--${name}`;
        if (element.hasAttribute(backupName)) continue;

        const templatedText = new TemplatedText({ cache: domGenerator.cache, proxyableRowId, text: value });
        const proxyableDatapointIds = Object.keys(templatedText.nodesByDatapointId);
        if (proxyableDatapointIds.length) {
          for (const proxyableDatapointId of proxyableDatapointIds) {
            usesByDatapointId[proxyableDatapointId] = usesByDatapointId[proxyableDatapointId] || {};
            usesByDatapointId[proxyableDatapointId][name] = true;
          }
          element.setAttribute(backupName, value);
          element.setAttribute(name, templatedText.evaluate.string);
        }
      }

    if (Object.keys(usesByDatapointId).length) {
      element.setAttribute('nobo-row-id', proxyableRowId);
    }
    for (const [proxyableDatapointId, uses] of Object.entries(usesByDatapointId)) {
      const usesName = `nobo-uses-${proxyableDatapointId}`;
      if (element.hasAttribute(usesName)) continue;

      element.classList.add(datapointValueFieldClass(proxyableDatapointId));
      element.setAttribute(usesName, Object.keys(uses).join(' '));
    }

    const proxyableDatapointIds = Object.keys(usesByDatapointId);
    element.setAttribute('nobo-value-dbids', proxyableDatapointIds.join(' '));
    for (const proxyableDatapointId of proxyableDatapointIds) {
      domGenerator.watchDatapoint(element, 'values', proxyableDatapointId, value => {});
    }
  }

  queueDomReplacement() {
    const domGenerator = this;
    if (domGenerator.domReplacementTimer !== undefined) return;
    setInterval(() => {
      domGenerator.commitDomReplacements();
    }, 100);
  }

  commitDomReplacements() {
    const domGenerator = this,
      replacements = domGenerator._replacements;

    delete domGenerator.domReplacementTimer;
    domGenerator._replacements = [];

    for (const replacement of replacements) {
      const { replaceRange, afterElement, elements } = replacement;

      if (afterElement) {
        for (let index = elements.length - 1; index >= 0; index--) {
          afterElement.insertAdjacentElement('afterend', elements[index]);
        }
      } else if (replaceRange) {
        if (elements && elements.length) {
          let previousElementSibling;
          for (let element = replaceRange[1]; element !== replaceRange[0]; element = previousElementSibling) {
            previousElementSibling = element.previousElementSibling;
            if (element.parentNode) element.parentNode.removeChild(element);
          }
          if (replaceRange[0].parentNode) replaceRange[0].parentNode.replaceChild(elements[0], replaceRange[0]);
          for (let index = elements.length - 1; index > 0; index--) {
            elements[0].insertAdjacentElement('afterend', elements[index]);
          }
        } else {
          let previousElementSibling;
          for (let element = replaceRange[1]; ; element = previousElementSibling) {
            previousElementSibling = element.previousElementSibling;
            if (element.parentNode) element.parentNode.removeChild(element);
            if (element === replaceRange[0]) break;
          }
        }
      }
    }
  }
}

makeClassWatchable(DomGenerator);

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomGenerator,
  hasExposedBackDoor: true,
});
