const PublicApi = require("../general/public-api");
const ConvertIds = require("../convert-ids");

// API is just all the functions
module.exports = {
  datapointChildrenClass,
  datapointValueFieldClass,
  datapointTemplateFieldClass,
  datapointDomFieldClass,
  childrenPlaceholders,
  datapointValueElements,
  datapointTemplateElements,
  datapointDomElements,
  elementChildrenFieldName,
  childrenFieldNameForElement,
  htmlToElement,
  templateDatapointIdForRowAndVariant,
  nextChild,
  skipAllChildren,
  skipChildren,
  _nextChild,
  _skipAllChildren,
  _skipChildren,
  rangeForElement,
  childRangeAtIndex
};

function datapointChildrenClass(proxyableDatapointId) {
  return `children--${proxyableDatapointId}`;
}

function datapointValueFieldClass(proxyableDatapointId) {
  return `value--${proxyableDatapointId}`;
}

function datapointTemplateFieldClass(proxyableDatapointId) {
  return `template--${proxyableDatapointId}`;
}

function datapointDomFieldClass(proxyableDatapointId) {
  return `dom--${proxyableDatapointId}`;
}

function childrenPlaceholders(proxyableDatapointId) {
  return document.getElementsByClassName(datapointChildrenClass(proxyableDatapointId));
}
function datapointValueElements(proxyableDatapointId) {
  return document.getElementsByClassName(datapointValueFieldClass(proxyableDatapointId));
}
function datapointTemplateElements(proxyableDatapointId) {
  return document.getElementsByClassName(datapointTemplateFieldClass(proxyableDatapointId));
}
function datapointDomElements(proxyableDatapointId) {
  return document.getElementsByClassName(datapointDomFieldClass(proxyableDatapointId));
}

function elementChildrenFieldName(element) {
  for (const className of element.classList) {
    const match = /^(\w+)-model-child$/.exec(className);
    if (match) return ChangeCase.camelCase(match[1]);
  }
}

function childrenFieldNameForElement(element) {
  for (const className of element.classList) {
    const match = /(\w+)-model-child/.exec(className);
    if (match) return match[1];
  }
}
function htmlToElement(html) {
  var template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstChild;
}

function templateDatapointIdForRowAndVariant(proxyableRowId, variant) {
  return ConvertIds.recomposeId({
    proxyableRowId,
    fieldName: `template_${variant}`
  }).proxyableDatapointId;
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
    previousChildUid = previousChildElement.getAttribute("nobo-uid");
  let element = previousChildElement.nextElementSibling;
  currentChildElementArray[1] = previousChildElement;
  currentChildElementArray[0] = element;
  if (element && element.getAttribute("nobo-placeholder-uid") == placeholderUid) return element;

  if (!previousChildUid || element.getAttribute("nobo-placeholder-uid") != previousChildUid) return;
  element = _skipAllChildren(previousChildUid, currentChildElementArray);

  return element && element.getAttribute("nobo-placeholder-uid") == placeholderUid ? element : undefined;
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

function rangeForElement(startElement) {
  if (!startElement) return [undefined, undefined];
  const currentChildElementArray = [startElement];
  _nextChild(startElement.getAttribute("nobo-placeholder-uid"), currentChildElementArray);
  return [startElement, currentChildElementArray[1]];
}

function childRangeAtIndex({ placeholderDiv, index }) {
  if (index < 0) return [placeholderDiv, placeholderDiv];
  const placeholderUid = placeholderDiv.getAttribute("nobo-uid"),
    firstElement = placeholderDiv.nextElementSibling;

  if (!firstElement || firstElement.getAttribute("nobo-placeholder-uid") != placeholderUid) return [];
  const startElement = skipChildren(placeholderUid, firstElement, index);
  if (!startElement) return [];
  const currentChildElementArray = [startElement];
  _nextChild(placeholderUid, currentChildElementArray);
  return [startElement, currentChildElementArray[1]];
}
