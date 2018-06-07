const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");
const TemplatedText = require("./templated-text");
const makeClassWatchable = require("../general/watchable");
const SharedState = require("../general/shared-state");

const {
  templateDatapointIdForRowAndVariant,
  htmlToElement,
  datapointTemplateFieldClass,
  datapointDomFieldClass,
  datapointChildrenClass,
  datapointValueFieldClass,
  childrenFieldNameForElement,
  uniquePathForElement
} = require("./dom-functions");

// API is auto-generated at the bottom from the public interface of this class

class DomGenerator {
  // public methods
  static publicMethods() {
    return [
      "createElementsForVariantOfRow",
      "createChildElements",
      "createElementsUsingTemplateDatapointId",
      "createElementsUsingDomDatapointId",
      "getDatapoint",
      "watch",
      "stopWatching"
    ];
  }

  constructor({ getDatapoint, htmlToElement }) {
    const domGenerator = this;

    domGenerator._getDatapoint = getDatapoint;
    domGenerator.nextUid = 1;
    domGenerator.htmlToElement = htmlToElement;
  }

  get getDatapoint() {
    return this._getDatapoint;
  }

  createElementsForVariantOfRow({ variant, proxyableRowId, placeholderUid, basedOnElement }) {
    variant = variant || "";
    if (typeof proxyableRowId == "string" && ConvertIds.proxyableDatapointRegex.test(proxyableRowId)) {
      ({ proxyableRowId, fieldName: variant } = ConvertIds.decomposeId({ proxyableDatapointId: proxyableRowId }));
    }
    const domGenerator = this,
      templateDatapointId =
        typeof proxyableRowId == "string" && ConvertIds.proxyableRowRegex.test(proxyableRowId)
          ? templateDatapointIdForRowAndVariant(proxyableRowId, variant)
          : undefined;
    return domGenerator.createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid, basedOnElement });
  }

  createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid, basedOnElement }) {
    const domGenerator = this;

    if (basedOnElement) {
      if (!templateDatapointId) templateDatapointId = basedOnElement.getAttribute("nobo-template-dpid");

      const path = uniquePathForElement(basedOnElement),
        overrides = SharedState.global.state.overriddenElementDatapoints,
        override = overrides && path ? overrides[path] : undefined;

      if (override && typeof override == "string") {
        if (ConvertIds.fieldNameRegex.test(override)) {
          const { proxyableRowId } = ConvertIds.decomposeId({ proxyableDatapointId: templateDatapointId });
          templateDatapointId = templateDatapointIdForRowAndVariant(proxyableRowId, override);
        } else if (ConvertIds.proxyableDatapointRegex.test(override)) {
          const { proxyableRowId, fieldName: variant } = ConvertIds.decomposeId({ proxyableDatapointId: override });
          templateDatapointId = templateDatapointIdForRowAndVariant(proxyableRowId, variant);
        }
      }
    }

    if (basedOnElement && (!templateDatapointId || typeof templateDatapointId != "string")) {
      templateDatapointId = basedOnElement.getAttribute("nobo-orig-template-dpid");
    }

    let domDatapointId, proxyableRowId;
    if (templateDatapointId) {
      proxyableRowId = ConvertIds.decomposeId({ proxyableDatapointId: templateDatapointId }).proxyableRowId;
      const templateDatapoint = domGenerator.getDatapoint(templateDatapointId, []);
      if (
        Array.isArray(templateDatapoint) &&
        templateDatapoint.length == 1 &&
        ConvertIds.proxyableRowRegex.test(templateDatapoint[0])
      ) {
        domDatapointId = ConvertIds.recomposeId({ proxyableRowId: templateDatapoint[0], fieldName: "dom" })
          .proxyableDatapointId;
      }
    }

    const elements = domGenerator.createElementsUsingDomDatapointId({
      templateDatapointId,
      domDatapointId,
      proxyableRowId,
      placeholderUid,
      basedOnElement
    });

    return elements;
  }

  createElementsUsingDomDatapointId({
    templateDatapointId,
    domDatapointId,
    proxyableRowId,
    placeholderUid,
    basedOnElement
  }) {
    if (basedOnElement) {
      if (!placeholderUid) placeholderUid = basedOnElement.getAttribute("nobo-placeholder-uid");
      if (!domDatapointId) domDatapointId = basedOnElement.getAttribute("nobo-dom-dpid");
      if (!templateDatapointId) templateDatapointId = basedOnElement.getAttribute("nobo-template-dpid");
    }

    if (templateDatapointId && !proxyableRowId) {
      proxyableRowId = ConvertIds.decomposeId({ proxyableDatapointId: templateDatapointId }).proxyableRowId;
    }

    const domGenerator = this,
      domString =
        (domDatapointId ? domGenerator.getDatapoint(domDatapointId, "<div></div>") : undefined) || "<div></div>";

    let element = (domGenerator.htmlToElement || htmlToElement)(domString);
    if (!element) element = (domGenerator.htmlToElement || htmlToElement)("<div></div>");

    if (basedOnElement) {
      element.setAttribute("nobo-orig-template-dpid", basedOnElement.getAttribute("nobo-orig-template-dpid"));
    } else {
      if (templateDatapointId) element.setAttribute("nobo-orig-template-dpid", templateDatapointId);
    }

    if (placeholderUid) element.setAttribute("nobo-placeholder-uid", placeholderUid);

    element.classList.add("nobodom"); // a coverall class for any element that is the root of a nobo dom tree,

    if (domDatapointId) {
      element.setAttribute("nobo-dom-dpid", domDatapointId);
      element.classList.add(datapointDomFieldClass(domDatapointId));
    }

    if (templateDatapointId) {
      element.setAttribute("nobo-template-dpid", templateDatapointId);
      element.classList.add(datapointTemplateFieldClass(templateDatapointId));
    }

    const elements = [element];
    if (proxyableRowId) {
      const { additionalSiblings } = domGenerator.prepDomTreeAndCreateChildren({
        element,
        proxyableRowId
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
        lids: childLids
      } = domGenerator.prepDomTreeAndCreateChildren({
        element: childElement,
        proxyableRowId,
        lidCounter: childLidCounter
      });
      if (childLids) {
        if (!lids) lids = childLids;
        else lids.push(...childLids);
      }
      for (let index = additionalChildElements.length - 1; index >= 0; index--) {
        childElement.insertAdjacentElement("afterend", additionalChildElements[index]);
      }
    }

    if (lids) element.setAttribute("nobo-child-lids", ` ${lids.join(" ")} `);

    domGenerator.notifyListeners("onprepelement", { element, proxyableRowId });

    domGenerator.prepValueFields({ element, proxyableRowId });

    const { additionalSiblings, lids: sibLids } = domGenerator.prepChildrenPlaceholderAndCreateChildren({
      element,
      proxyableRowId,
      lidCounter
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

    let lid = lidCounter ? lidCounter[0]++ : 0;

    const placeholderUid = domGenerator.nextUid++;
    element.setAttribute("nobo-children-dpid", proxyableDatapointId);
    element.setAttribute("nobo-uid", placeholderUid);
    element.setAttribute("nobo-lid", lid);
    element.classList.add("noboplaceholder", datapointChildrenClass(proxyableDatapointId));

    const variant = element.getAttribute("variant") || undefined,
      additionalSiblings = domGenerator.createChildElements({ proxyableDatapointId, variant, placeholderUid });
    return { additionalSiblings, lids: lid ? [lid] : undefined };
  }

  createChildElements({ proxyableDatapointId, variant, placeholderUid }) {
    const domGenerator = this,
      rowOrDatapointIds = domGenerator.getDatapoint(proxyableDatapointId, []);

    if (!Array.isArray(rowOrDatapointIds)) return [];

    const childElements = [];
    for (const rowOrDatapointId of rowOrDatapointIds) {
      let proxyableRowId,
        localVariant = variant;
      if (typeof rowOrDatapointId == "string") {
        if (ConvertIds.proxyableRowRegex.test(rowOrDatapointId)) proxyableRowId = rowOrDatapointId;
        if (ConvertIds.proxyableDatapointRegex.test(rowOrDatapointId)) {
          const datapointInfo = ConvertIds.decomposeId({ proxyableDatapointId: rowOrDatapointId });
          proxyableRowId = datapointInfo.proxyableRowId;
          localVariant = datapointInfo.fieldName;
        }
      }
      childElements.push(
        ...domGenerator.createElementsForVariantOfRow({
          variant: localVariant,
          proxyableRowId,
          placeholderUid
        })
      );
    }
    return childElements;
  }

  prepValueFields({ element, proxyableRowId }) {
    const domGenerator = this,
      getDatapoint = domGenerator.getDatapoint;

    let index = 0;
    const usesByDatapointId = {};

    for (let childNode = element.firstChild; childNode; childNode = childNode.nextSibling) {
      if (childNode.nodeType == 3) {
        const backupName = `nobo-backup-text-${index}`;
        if (element.hasAttribute(backupName)) continue;

        const templatedText = new TemplatedText({ getDatapoint, proxyableRowId, text: childNode.textContent });
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
        if (name.startsWith("nobo-") || name == "class" || name == "id") continue;

        const backupName = `nobo-backup--${name}`;
        if (element.hasAttribute(backupName)) continue;

        const templatedText = new TemplatedText({ getDatapoint, proxyableRowId, text: value });
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
      element.setAttribute("nobo-row-id", proxyableRowId);
    }
    for (const [proxyableDatapointId, uses] of Object.entries(usesByDatapointId)) {
      const usesName = `nobo-uses-${proxyableDatapointId}`;
      if (element.hasAttribute(usesName)) continue;

      element.classList.add(datapointValueFieldClass(proxyableDatapointId));
      element.setAttribute(usesName, Object.keys(uses).join(" "));
    }
  }
}

makeClassWatchable(DomGenerator);

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomGenerator,
  hasExposedBackDoor: true
});
