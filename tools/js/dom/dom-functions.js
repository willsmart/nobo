const ChangeCase = require('change-case');
const ConvertIds = require('../convert-ids');

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
  variantForTemplateDatapointId,
  nextChild,
  skipAllChildren,
  skipChildren,
  _nextChild,
  _skipAllChildren,
  _skipChildren,
  rangeForElement,
  childRangeAtIndex,
  elementForUniquePath,
  uniquePathForElement,
  templateDatapointIdforVariantOfRow,
};

function datapointChildrenClass(datapointId) {
  return `children--${datapointId}`;
}

function datapointValueFieldClass(datapointId) {
  return `value--${datapointId}`;
}

function datapointTemplateFieldClass(datapointId) {
  return `template--${datapointId}`;
}

function datapointDomFieldClass(datapointId) {
  return `dom--${datapointId}`;
}

function childrenPlaceholders(datapointId) {
  return document.getElementsByClassName(datapointChildrenClass(datapointId));
}
function datapointValueElements(datapointId) {
  return document.getElementsByClassName(datapointValueFieldClass(datapointId));
}
function datapointTemplateElements(datapointId) {
  return document.getElementsByClassName(datapointTemplateFieldClass(datapointId));
}
function datapointDomElements(datapointId) {
  return document.getElementsByClassName(datapointDomFieldClass(datapointId));
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
  var template = document.createElement('template');
  template.innerHTML = html.trim();
  let element = template.content.firstChild;
  if (element && element.nodeType == 3) {
    let span = document.createElement('span');
    span.innerText = element.textContent;
    element = span;
  }
  return element;
}

function templateDatapointIdForRowAndVariant(rowId, variant) {
  return ConvertIds.recomposeId({
    rowId,
    fieldName: `template_${variant}`,
  }).datapointId;
}

function variantForTemplateDatapointId(datapointId) {
  const { fieldName } = ConvertIds.decomposeId({ datapointId });
  if (fieldName.startsWith('template')) {
    return ChangeCase.camelCase(fieldName.substring('template'.length));
  }
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
    previousChildUid = previousChildElement.getAttribute('nobo-uid');
  let element = previousChildElement.nextElementSibling;
  currentChildElementArray[1] = previousChildElement;
  currentChildElementArray[0] = element;
  if (!element || element.getAttribute('nobo-placeholder-uid') == placeholderUid) return element;

  if (!previousChildUid || element.getAttribute('nobo-placeholder-uid') != previousChildUid) return;
  element = _skipAllChildren(previousChildUid, currentChildElementArray);

  return element && element.getAttribute('nobo-placeholder-uid') == placeholderUid ? element : undefined;
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
  _nextChild(startElement.getAttribute('nobo-placeholder-uid'), currentChildElementArray);
  return [startElement, currentChildElementArray[1]];
}

function childRangeAtIndex({ placeholderDiv, index }) {
  if (index < 0) return [placeholderDiv, placeholderDiv];
  const placeholderUid = placeholderDiv.getAttribute('nobo-uid'),
    firstElement = placeholderDiv.nextElementSibling;

  if (!firstElement || firstElement.getAttribute('nobo-placeholder-uid') != placeholderUid) return [];
  const startElement = skipChildren(placeholderUid, firstElement, index);
  if (!startElement) return [];
  const currentChildElementArray = [startElement];
  _nextChild(placeholderUid, currentChildElementArray);
  return [startElement, currentChildElementArray[1]];
}

function findPlaceholderDescendent(element, lid) {
  if (!lid) {
    for (let sib = element.nextElementSibling; sib; sib = sib.nextElementSibling) {
      const childLid = child.getAttribute('nobo-lid');
      if (child.getAttribute('nobo-lid') == lid) return sib;
    }
  } else
    for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
      const childLid = child.getAttribute('nobo-lid');
      if (childLid) {
        if (childLid == lid) return child;
      } else {
        const lids = child.getAttribute('nobo-child-lids');
        if (lids && lids.includes(` ${lid} `)) {
          const ret = findPlaceholderDescendent(child, lid);
          if (ret) return ret;
        }
      }
    }
}

function elementForUniquePath(path) {
  path = path.split(' ');
  const roots = childrenPlaceholders('page');
  if (!roots.length) return;
  let element = roots[0];
  for (const pathComponent of path) {
    const match = /^([^_]+)__(.*)__#(\d+)$/.exec(pathComponent);
    if (!match) return;
    const lid = match[1],
      templateDatapointId = match[2];
    let index = +match[3];

    let placeholderElement = element.hasAttribute('nobo-uid') ? element : findPlaceholderDescendent(element, lid);
    if (!placeholderElement) return;
    const placeholderUid = placeholderElement.getAttribute('nobo-uid');

    element = undefined;
    for (let sib = placeholderElement.nextElementSibling; sib; sib = sib.nextElementSibling) {
      if (
        sib.getAttribute('nobo-placeholder-uid') == placeholderUid &&
        sib.getAttribute('nobo-orig-template-dpid') == templateDatapointId
      ) {
        if (index--) continue;
        element = sib;
        break;
      }
    }
    if (!element) return;
  }
  return element;
}

function uniquePathForElement(element) {
  while (!(element.hasAttribute('nobo-placeholder-uid') && element.hasAttribute('nobo-orig-template-dpid'))) {
    if (!(element = element.parentElement)) return;
  }
  const placeholderUid = element.getAttribute('nobo-placeholder-uid'),
    templateDatapointId = element.getAttribute('nobo-orig-template-dpid');
  let index = 0;
  for (let sib = element.previousElementSibling; sib; sib = sib.previousElementSibling) {
    const sibUid = sib.getAttribute('nobo-uid'),
      sibLid = sib.getAttribute('nobo-lid');
    if (sibUid == 'page') {
      return `0__${templateDatapointId}__#${index}`;
    }
    if (sibUid == placeholderUid) {
      const sibPath = uniquePathForElement(sib);
      if (sibPath === undefined) return;
      return `${sibPath} ${sibLid}__${templateDatapointId}__#${index}`;
    }
    if (
      sib.getAttribute('nobo-placeholder-uid') == placeholderUid &&
      sib.getAttribute('nobo-orig-template-dpid') == templateDatapointId
    ) {
      index++;
    }
  }
  return;
}

function templateDatapointIdforVariantOfRow({ variant = undefined, rowOrDatapointId }) {
  variant = variant || '';
  let rowId = rowOrDatapointId;

  if (typeof rowOrDatapointId == 'string' && ConvertIds.datapointRegex.test(rowOrDatapointId)) {
    ({ rowId, fieldName: variant } = ConvertIds.decomposeId({
      datapointId: rowOrDatapointId,
    }));
  }

  return typeof rowId == 'string' && ConvertIds.rowRegex.test(rowId)
    ? templateDatapointIdForRowAndVariant(rowId, variant)
    : undefined;
}
