const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");
const TemplatedText = require("./templated-text");
const SharedState = require("./shared-state");

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
  childRangeAtIndex
} = require("./dom-functions");

// API is auto-generated at the bottom from the public interface of this class

class DomUpdater {
  // public methods
  static publicMethods() {
    return ["datapointUpdated"];
  }

  constructor({ domGenerator }) {
    const domUpdater = this;

    domUpdater.domGenerator = domGenerator;
    domUpdater.getDatapoint = domGenerator.getDatapoint;

    domUpdater.startWatch();
  }

  startWatch() {
    const domUpdater = this;

    SharedState.global.watch({
      callbackKey: "dom-updater",
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        const replacements = [];

        forEachChangedKeyPath((keyPath, change) => {
          if (!keyPath.length || keyPath[0] != "datapointsById") return;
          if (keyPath.length < 2) return true;

          const datapointId = keyPath[1];

          if (keyPath.length == 2) {
            replacements.push(...domUpdater.datapointUpdated({ datapointId: keyPath[1], change }));
            if (Array.isArray(change.is)) return true;
          } else if (keyPath.length == 3 && typeof keyPath[2] == "number") {
            replacements.push(
              ...domUpdater.datapointMemberUpdated({ datapointId: keyPath[1], index: +keyPath[2], change })
            );
          }
        });

        if (replacements.length) {
          domUpdater.commitDomReplacements({ replacements });
        }
      }
    });
  }

  createElementsWithUpdatedTemplateDatapoint({ element }) {
    const domUpdater = this,
      templateDatapointId = element.getAttribute("nobo-template-dpid"),
      placeholderUid = element.getAttribute("nobo-placeholder-uid");
    if (!templateDatapointId) return;

    return domUpdater.domGenerator.createElementsUsingTemplateDatapointId({ templateDatapointId, placeholderUid });
  }

  createElementsWithUpdatedDomDatapoint({ element }) {
    const domUpdater = this,
      templateDatapointId = element.getAttribute("nobo-template-dpid"),
      domDatapointId = element.getAttribute("nobo-dom-dpid"),
      placeholderUid = element.getAttribute("nobo-placeholder-uid");
    if (!(templateDatapointId && domDatapointId)) return;

    const rowId = ConvertIds.decomposeId({ datapointId: templateDatapointId }).rowId;

    return domUpdater.domGenerator.createElementsUsingDomDatapointId({
      templateDatapointId,
      domDatapointId,
      rowId,
      placeholderUid
    });
  }

  updateElementsWithUpdatedValueDatapoints({ element, datapointId }) {
    const domUpdater = this,
      getDatapoint = domUpdater.getDatapoint,
      usesString = element.getAttribute(`nobo-uses-${datapointId}`),
      rowId = element.getAttribute(`nobo-row-id`);

    if (!(usesString && rowId)) return;
    const uses = usesString.split(/\s+/g);

    for (const use of uses) {
      const match = /^=(\d+)$/.exec(use);
      if (match) {
        let childNode,
          index = +match[1],
          thisIndex = 0;
        for (let childNode = element.firstChild; childNode; childNode = childNode.nextSibling) {
          if (childNode.nodeType == 3) {
            if (thisIndex++ < index) continue;

            const backup = element.getAttribute(`nobo-backup-text-${index}`);
            if (!backup) break;

            const templatedText = new TemplatedText({ getDatapoint, rowId, text: backup });
            const string = templatedText.evaluate.string;
            childNode.textContent = string;
            break;
          }
        }
      } else {
        const name = use;
        const backup = element.getAttribute(`nobo-backup--${name}`);
        if (!backup) break;

        const templatedText = new TemplatedText({ getDatapoint, rowId, text: backup });
        element.setAttribute(name, templatedText.evaluate.string);
      }
    }
  }

  markRangeAsDead([start, end]) {
    for (let element = start; ; element = element.nextElementSibling) {
      element.classList.add("nobo-dead");
      if (element == end) break;
    }
  }
  datapointUpdated({ datapointId }) {
    const domUpdater = this,
      replacements = [];
    for (const element of datapointTemplateElements(datapointId)) {
      const range = rangeForElement(element);
      replacements.push({
        replaceRange: range,
        elements: domUpdater.createElementsWithUpdatedTemplateDatapoint({ element })
      });
      domUpdater.markRangeAsDead(range);
    }
    for (const element of datapointDomElements(datapointId)) {
      const range = rangeForElement(element);
      replacements.push({
        replaceRange: range,
        elements: domUpdater.createElementsWithUpdatedDomDatapoint({ element })
      });
      domUpdater.markRangeAsDead(range);
    }
    for (const element of datapointValueElements(datapointId)) {
      domUpdater.updateElementsWithUpdatedValueDatapoints({ element, datapointId });
    }

    return replacements;
  }

  datapointMemberUpdated({ datapointId, index, change }) {
    const domUpdater = this,
      replacements = [];

    for (const element of childrenPlaceholders(datapointId)) {
      let variant = element.getAttribute("variant") || undefined,
        placeholderUid = element.getAttribute("nobo-uid"),
        rowId = ConvertIds.rowRegex.test(change.is) ? change.is : undefined,
        datapointId = ConvertIds.datapointRegex.test(change.is) ? change.is : undefined,
        range = childRangeAtIndex({ placeholderDiv: element, index });
      if (datapointId) {
        const datapointInfo = ConvertIds.decomposeId({ datapointId });
        rowId = datapointInfo.rowId;
        variant = datapointInfo.fieldName;
      }
      if (change.index !== undefined) {
        switch (change.type) {
          case "insert":
            const afterRange = childRangeAtIndex({ placeholderDiv: element, index: index - 1 });
            replacements.push({
              afterElement: afterRange[1],
              elements: domUpdater.domGenerator.createElementsForVariantOfRow({
                rowId,
                variant,
                placeholderUid
              })
            });
            break;
          case "change":
            domUpdater.markRangeAsDead(range);
            replacements.push({
              replaceRange: range,
              elements: domUpdater.domGenerator.createElementsForVariantOfRow({
                rowId,
                variant,
                placeholderUid
              })
            });
            break;
          case "delete":
            domUpdater.markRangeAsDead(range);
            replacements.push({
              replaceRange: range
            });
            break;
        }
      }
    }

    return replacements;
  }

  commitDomReplacements({ replacements }) {
    for (const replacement of replacements) {
      const { replaceRange, afterElement, elements } = replacement;

      if (afterElement) {
        for (let index = elements.length - 1; index >= 0; index--) {
          afterElement.insertAdjacentElement("afterend", elements[index]);
        }
      } else if (replaceRange) {
        if (elements && elements.length) {
          let previousElementSibling;
          for (let element = replaceRange[1]; element !== replaceRange[0]; element = previousElementSibling) {
            previousElementSibling = element.previousElementSibling;
            element.parentNode.removeChild(element);
          }
          replaceRange[0].parentNode.replaceChild(elements[0], replaceRange[0]);
          for (let index = elements.length - 1; index > 0; index--) {
            elements[0].insertAdjacentElement("afterend", elements[index]);
          }
        } else {
          let previousElementSibling;
          for (let element = replaceRange[1]; ; element = previousElementSibling) {
            previousElementSibling = element.previousElementSibling;
            element.parentNode.removeChild(element);
            if (element === replaceRange[0]) break;
          }
        }
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: DomUpdater,
  hasExposedBackDoor: true
});
