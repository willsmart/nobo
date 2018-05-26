const PublicApi = require("../general/public-api");

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const SharedState = require("./shared-state");

const callbackKey = "ClientDom";

function datapointChildrenClass(datapointId) {
  return `${datapointId}__children`;
}

function datapointFieldClass(datapointId) {
  return `${datapointId}__field`;
}

function datapointTemplateFieldClass(datapointId) {
  return `${datapointId}__template`;
}

function datapointDomFieldClass(datapointId) {
  return `${datapointId}__dom`;
}

function childrenPlaceholders(datapointId) {
  return document.getElementsByClassName(datapointChildrenClass(datapointId));
}
function datapointFieldElements(datapointId) {
  return document.getElementsByClassName(datapointFieldClass(datapointId));
}
function datapointTemplateElements(datapointId) {
  return document.getElementsByClassName(datapointTemplateClass(datapointId));
}
function datapointDomElements(datapointId) {
  return document.getElementsByClassName(datapointDomClass(datapointId));
}

function elementChildrenFieldName(element) {
  for (const className of element.classList) {
    const match = /^(\w+)-model-child$/.exec(className);
    if (match) return ChangeCase.camelCase(match[1]);
  }
}

function htmlToElement(html) {
  var template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

function nextChild(placeholderUid, previousChildElement) {
  return _nextChild(placeholderUid, [previousChildElement]);
}

function skipAllChildren(placeholderUid, previousChildElement) {
  return _skipAllChildren(placeholderUid, [previousChildElement]);
}

function skipChildren(placeholderUid, previousChildElement, count) {
  return _skipChildren(placeholderUid, [previousChildElement], count);
}

function _nextChild(placeholderUid, currentChildElementArray) {
  const previousChildElement = currentChildElementArray[0],
    previousChildUid = previousChildElement.getAttribute("nobouid");
  let element = previousChildElement.nextElement;
  currentChildElementArray[1] = previousChildElement;
  currentChildElementArray[0] = element;
  if (element && element.getAttribute("placeholderuid") == placeholderUid) return element;

  if (!previousChildUid || element.getAttribute("placeholderuid") != previousChildUid) return;
  element = _skipAllChildren(previousChildUid, currentChildElementArray);

  return element && element.getAttribute("placeholderuid") == placeholderUid ? element : undefined;
}

function _skipAllChildren(placeholderUid, currentChildElementArray) {
  while (_nextChild(placeholderUid, currentChildElementArray));
  return currentChildElementArray[0];
}

function _skipChildren(placeholderUid, currentChildElementArray, count) {
  for (let index = 0; index < count; index++) {
    if (!_nextChild(placeholderUid, currentChildElementArray)) return;
  }
  return currentChildElementArray[0];
}

function childRangeAtIndex({ placeholderDiv, index }) {
  if (index < 0) return placeholderDiv;
  const placeholderUid = placeholderDiv.getAttribute("nobouid"),
    firstElement = placeholderDiv.nextElement;

  if (!firstElement || element.getAttribute("placeholderuid") != placeholderUid) return [];
  const startElement = skipChildren(placeholderUid, element, index);
  if (!startElement) return [];
  const currentChildElementArray = [startElement];
  _nextChild(placeholderUid, element, index);
  return [startElement, currentChildElementArray[1]];
}

class ClientDom {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({ clientDatapoints }) {
    const clientDom = this;

    clientDom.clientDatapoints = clientDatapoints;

    clientDom.nextUid = 1;

    SharedState.global.watch({
      callbackKey: "adjust-divs",
      onchangedstate: (diff, changes, forEachChangedKeyPath, fromState, toState) => {
        const datapointsById = toState.datapointsById || {};

        let payloadObject;

        const subscribe = {},
          getDatapoint = datapointId => {
            if (datapointsById[datapointId]) return datapointsById[datapointId];
            subscribe[datapointId] = true;
          };

        forEachChangedKeyPath((keyPath, change) => {
          if (!keyPath.length || keyPath[0] != "datapointsById") return;
          if (keyPath.length == 1) return true;
          const datapointId = keyPath[1];
          if (!ConvertIds.datapointRegex.test(datapointId)) return;

          if (keyPath.length == 2) {
            if (Array.isArray(change.is)) return true;

            clientDom.updateFieldValue({
              datapointId,
              was: change.was,
              is: change.is
            });
          } else if (keyPath.length == 3 && typeof keyPath[3] == "number") {
            const wasRowId =
                typeof change.was == "string" && ConvertIds.rowRegex.test(change.was) ? change.was : undefined,
              isRowId = typeof change.is == "string" && ConvertIds.rowRegex.test(change.is) ? change.is : undefined;

            if (wasRowId == isRowId) return;

            if (change.type == "change" || change.type == "delete") {
              clientDom.deleteDOMChild({
                datapointId,
                index: keyPath[2],
                rowId: wasRowId
              });
            }
            if (change.type == "change" || change.type == "insert") {
              clientDom.insertDOMChild({
                datapointId,
                index: keyPath[2],
                rowId: isRowId,
                getDatapoint
              });
            }
            if (change.type == "change") {
              clientDom.replaceDOMChild({
                datapointId,
                index: keyPath[2],
                rowId: isRowId,
                getDatapoint
              });
            }
          }
        });

        if (Object.keys(subscribe).length) clientDatapoints.subscribe(subscribe);
      }
    });
  }

  prepPage() {
    const clientDom = this,
      childrenDatapointId = "page";
    for (const element of childrenPlaceholders(childrenDatapointId)) {
      if (element.style.display && !element.style.getAttribute("nobo-style-display")) {
        element.style.setAttribute("nobo-style-display", element.style.display);
      }
      element.style.display = "none";
      const uid = clientDom.nextUid++;
      element.setAttribute("nobouid", uid);
    }
  }

  replaceDOMChild({ datapointId, index, rowId, getDatapoint }) {
    const clientDom = this;

    clientDom.deleteDOMChild({ datapointId, index, rowId });
    clientDom.insertDOMChild({ datapointId, index, rowId, getDatapoint });
  }

  deleteDOMChild({ datapointId, index, rowId }) {
    const clientDom = this;

    for (const placeholderDiv of childrenPlaceholders(datapointId)) {
      const [startOfChild, endOfChild] = childRangeAtIndex({ placeholderDiv, index });
      if (!startOfChild) continue;
      while (true) {
        const child = startOfChild;
        startOfChild = startOfChild.nextElement;
        child.parentElement.removeChild(child);
        if (child === endOfChild) break;
      }
    }
  }

  insertDOMChild({ datapointId, index, rowId, getDatapoint }) {
    const clientDom = this;

    for (const placeholderDiv of childrenPlaceholders(datapointId)) {
      const variant = placeholderDiv.getAttribute("variant"),
        placeholderUid = placeholderDiv.getAttribute("nobouid");

      let [startOfChild, afterElement] = childRangeAtIndex({ placeholderDiv, index });
      if (!afterElement) continue;

      const childElements = createChildElements({
        variant,
        rowId,
        getDatapoint,
        placeholderUid
      });
      for (const childElement of childElements) {
        afterElement.insertAdjacentElement("afterend", childElement);
        afterElement = childElement;
      }
    }
  }

  updateFieldValue({ datapointId, was, is }) {}

  createChildElements({ variant, rowId, decomposedRowId, getDatapoint, placeholderUid }) {
    if (rowId && !decomposedRowId) decomposedRowId = ConvertIds.decomposeId({ rowId });

    const clientDom = this,
      element = this.elementForVariantOfRow({
        variant,
        decomposedRowId,
        getDatapoint
      });

    return clientDom.prepDomElement({
      element: childElement,
      decomposedRowId,
      getDatapoint,
      placeholderUid
    });
  }

  domForVariantOfRow({ variant, decomposedRowId, getDatapoint }) {
    const templateDatapointId = ConvertIds.recomposeId(decomposedRowId, {
        fieldName: `template_${ChangeCase.snakeCase(variant)}`
      }).datapointId,
      templateDatapoint = getDatapoint(templateDatapointId);

    let domDatapointId, dom;

    if (
      Array.isArray(templateDatapoint) &&
      templateDatapoint.length == 1 &&
      ConvertIds.rowRegex.test(templateDatapoint[0])
    ) {
      domDatapointId = ConvertIds.recomposeId(
        ConvertIds.decomposeId({
          rowId: templateDatapoint[0]
        }),
        {
          variant: "dom"
        }
      ).datapointId;

      dom = getDatapoint(domDatapointId);
    }

    return { dom, templateDatapointId, domDatapointId };
  }

  elementForVariantOfRow({ variant, decomposedRowId, getDatapoint }) {
    const clientDom = this,
      defaultDom = "<div></div>",
      { dom, templateDatapointId, domDatapointId } = clientDom.domForVariantOfRow({
        variant,
        decomposedRowId,
        getDatapoint
      });

    let element;
    if (dom) {
      element = htmlToElement(dom);
    }
    if (!element) element = htmlToElement(defaultDom);

    if (templateDatapointId) element.classList.add(classForDatapointTemplateField(templateDatapointId));
    if (domDatapointId) element.classList.add(classForDatapointDomField(domDatapointId));

    return element;
  }

  prepDomElement({ element, decomposedRowId, getDatapoint, placeholderUid }) {
    const clientDom = this;

    element.setAttribute("noborowid", decomposedRowId.rowId);
    if (placeholderUid) element.setAttribute("placeholderuid", placeholderUid);

    for (let childElement = element.firstElementChild; childElement; childElement = nextElementSibling) {
      const nextElementSibling = childElement.nextElementSibling;
      const preppedChildElements = clientDom.prepDomElement({
        element: childElement,
        decomposedRowId,
        getDatapoint,
        placeholderUid
      });
      for (let index = preppedChildElements.length - 1; index > 0; index--) {
        childElement.insertAdjacentElement("afterend", preppedChildElements[index]);
      }
    }

    const elements = [element],
      childrenFieldName = elementChildrenFieldName(element);

    if (childrenFieldName) {
      const childrenDatapointId = ConvertIds.recomposeId(decomposedRowId, {
        fieldName: childrenFieldName
      });

      if (element.style.display && !element.style.getAttribute("nobo-style-display")) {
        element.style.setAttribute("nobo-style-display", element.style.display);
      }
      element.style.display = "none";
      const uid = clientDom.nextUid++;
      element.setAttribute("nobouid", uid);
      element.classList.add(datapointChildrenClass(childrenDatapointId));

      const childrenElements = createChildrenElements({
        childrenDatapointId,
        variant: element.getAttribute("variant") || undefined,
        getDatapoint,
        placeholderUid: uid
      });
      elements.push(...childrenElements);
    }

    return elements;
  }

  createChildrenElements({ datapointId, variant, getDatapoint, placeholderUid }) {
    const clientDom = this,
      rowIds = getDatapoint(datapointId);

    if (!Array.isArray(rowIds)) return [];

    return rowIds.flatMap(rowId => {
      if (typeof rowId != "string" || !ConvertIds.rowRegex.test(rowId)) rowId = undefined;
      return clientDom.createChildElements({
        variant,
        rowId,
        getDatapoint,
        placeholderUid
      });
    });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: ClientDom,
  hasExposedBackDoor: true
});
