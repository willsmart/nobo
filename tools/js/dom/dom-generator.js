const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");
const TemplatedText = require("./templated-text");

const {
  templateDatapointIdForRowAndVariant,
  htmlToElement,
  datapointTemplateFieldClass,
  datapointDomFieldClass,
  datapointChildrenClass,
  datapointValueFieldClass,
  childrenFieldNameForElement
} = require("./dom-functions");

// API is auto-generated at the bottom from the public interface of this class

class DomGenerator {
  // public methods
  static publicMethods() {
    return [
      "createElementsForVariantOfRow",
      "createChildElements",
      "createElementsUsingTemplateDatapointId",
      "createElementsUsingDomDatapointId"
    ];
  }

  constructor({ getDatapoint, htmlToElement }) {
    const domGenerator = this;

    domGenerator.getDatapoint = getDatapoint;
    domGenerator.nextUid = 1;
    domGenerator.htmlToElement = htmlToElement;
  }

  createElementsForVariantOfRow({ variant, rowId, placeholderUid }) {
    variant = variant || "";
    const domGenerator = this,
      templateDatapointId =
        typeof rowId == "string" && typeof rowId == "string" && ConvertIds.rowRegex.test(rowId)
          ? templateDatapointIdForRowAndVariant(rowId, variant)
          : undefined;
    return domGenerator.createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid });
  }

  createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid }) {
    const domGenerator = this;

    let domDatapointId, rowId;
    if (templateDatapointId) {
      rowId = ConvertIds.decomposeId({ datapointId: templateDatapointId }).rowId;
      const templateDatapoint = domGenerator.getDatapoint(templateDatapointId, []);
      if (
        Array.isArray(templateDatapoint) &&
        templateDatapoint.length == 1 &&
        ConvertIds.rowRegex.test(templateDatapoint[0])
      ) {
        domDatapointId = ConvertIds.recomposeId({ rowId: templateDatapoint[0], fieldName: "dom" }).datapointId;
      }
    }

    const elements = domGenerator.createElementsUsingDomDatapointId({
      templateDatapointId,
      domDatapointId,
      rowId,
      placeholderUid
    });

    return elements;
  }

  createElementsUsingDomDatapointId({ templateDatapointId, domDatapointId, rowId, placeholderUid }) {
    const domGenerator = this,
      domString =
        (domDatapointId ? domGenerator.getDatapoint(domDatapointId, "<div></div>") : undefined) || "<div></div>";

    let element = (domGenerator.htmlToElement || htmlToElement)(domString);
    if (!element) element = (domGenerator.htmlToElement || htmlToElement)("<div></div>");

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
    if (rowId) {
      elements.push(
        ...domGenerator.prepDomTreeAndCreateChildren({
          element,
          rowId
        })
      );
    }
    return elements;
  }

  prepDomTreeAndCreateChildren({ element, rowId }) {
    const domGenerator = this;

    let nextElementSibling;
    for (let childElement = element.firstElementChild; childElement; childElement = nextElementSibling) {
      nextElementSibling = childElement.nextElementSibling;
      const additionalChildElements = domGenerator.prepDomTreeAndCreateChildren({ element: childElement, rowId });
      for (let index = additionalChildElements.length - 1; index >= 0; index--) {
        childElement.insertAdjacentElement("afterend", additionalChildElements[index]);
      }
    }

    domGenerator.prepValueFields({ element, rowId });

    return domGenerator.prepChildrenPlaceholderAndCreateChildren({ element, rowId });
  }

  prepChildrenPlaceholderAndCreateChildren({ element, rowId }) {
    const domGenerator = this;

    let fieldName = childrenFieldNameForElement(element);
    if (!fieldName) return [];

    const datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId;

    const placeholderUid = domGenerator.nextUid++;
    element.setAttribute("nobo-children-dpid", datapointId);
    element.setAttribute("nobo-uid", placeholderUid);
    element.classList.add("noboplaceholder", datapointChildrenClass(datapointId));

    const variant = element.getAttribute("variant") || undefined,
      additionalSiblings = domGenerator.createChildElements({ datapointId, variant, placeholderUid });
    return additionalSiblings;
  }

  createChildElements({ datapointId, variant, placeholderUid }) {
    const domGenerator = this,
      rowIds = domGenerator.getDatapoint(datapointId, []);

    if (!Array.isArray(rowIds)) return [];

    const childElements = [];
    for (const rowId of rowIds) {
      if (typeof rowId != "string" || !ConvertIds.rowRegex.test(rowId)) rowId = undefined;
      childElements.push(
        ...domGenerator.createElementsForVariantOfRow({
          variant,
          rowId,
          placeholderUid
        })
      );
    }
    return childElements;
  }

  prepValueFields({ element, rowId }) {
    let index = 0;
    const usesByDatapointId = {};

    for (let childNode = element.firstChild; childNode; childNode = childNode.nextSibling) {
      if (childNode.nodeType == 3) {
        const backupName = `nobo-backup-text-${index}`;
        if (element.hasAttribute(backupName)) continue;

        const templatedText = new TemplatedText({ rowId, text: childNode.textContent });
        if (templatedText.datapointIds.length) {
          for (const datapointId of templatedText.datapointIds) {
            usesByDatapointId[datapointId] = usesByDatapointId[datapointId] || {};
            usesByDatapointId[datapointId][`=${index}`] = true;
          }
          element.setAttribute(backupName, childNode.textContent);
          //TODO substituteTextNode({element, index})
        }

        index++;
      }
    }

    if (element.hasAttributes())
      for (const { name, value } of element.attributes) {
        if (name.startsWith("nobo-")) continue;

        const backupName = `nobo-backup--${name}`;
        if (element.hasAttribute(backupName)) continue;

        const templatedText = new TemplatedText({ rowId, text: value });
        if (templatedText.datapointIds.length) {
          for (const datapointId of templatedText.datapointIds) {
            usesByDatapointId[datapointId] = usesByDatapointId[datapointId] || {};
            usesByDatapointId[datapointId][name] = true;
          }
          element.setAttribute(backupName, value);
          //TODOsubstituteAttribute({element, attributeName: name})
        }
      }

    for (const [datapointId, uses] of Object.entries(usesByDatapointId)) {
      const usesName = `nobo-uses-${datapointId}`;
      if (element.hasAttribute(usesName)) continue;

      element.classList.add(datapointValueFieldClass(datapointId));
      element.setAttribute(usesName, Object.keys(uses).join(" "));
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomGenerator,
  hasExposedBackDoor: true
});
