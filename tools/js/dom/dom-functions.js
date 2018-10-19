const ChangeCase = require('change-case');
const ConvertIds = require('../datapoints/convert-ids');
const nameForElement = require('../general/name-for-element');
const log = require('../general/log');

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
  childRanges,
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
  forEachInElementRange,
  mapInElementRange,
  findInElementRange,
  logChange,
  describeRange,
  describeTree,
  describeChange,
  logRange,
  logTree,
};

const waitCountAttributeName = 'nobo-wait-count',
  waitNamesAttributeName = 'nobo-wait-names',
  waitingChangesAttributeName = 'nobo-waiting-changes',
  rootInChangeIdAttributeName = 'nobo-root-in-change';

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

function nextChild(placeholderUid, previousChildElement, nextElementSiblingFn) {
  return _nextChild(placeholderUid, [previousChildElement], nextElementSiblingFn);
}

function skipAllChildren(placeholderUid, previousChildElement, nextElementSiblingFn) {
  return _skipAllChildren(placeholderUid, [previousChildElement], nextElementSiblingFn);
}

function skipChildren(placeholderUid, previousChildElement, count, nextElementSiblingFn) {
  return _skipChildren(placeholderUid, [previousChildElement], count, nextElementSiblingFn);
}

function _nextChild(placeholderUid, currentChildElementArray, nextElementSiblingFn) {
  const previousChildElement = currentChildElementArray[0],
    previousChildUid = previousChildElement.getAttribute('nobo-uid');
  let element = nextElementSiblingFn
    ? nextElementSiblingFn(previousChildElement)
    : previousChildElement.nextElementSibling;
  currentChildElementArray[1] = previousChildElement;
  currentChildElementArray[0] = element;
  if (!element || element.getAttribute('nobo-placeholder-uid') == placeholderUid) return element;

  if (!previousChildUid || element.getAttribute('nobo-placeholder-uid') != previousChildUid) return;
  element = _skipAllChildren(previousChildUid, currentChildElementArray, nextElementSiblingFn);

  return element && element.getAttribute('nobo-placeholder-uid') == placeholderUid ? element : undefined;
}

function _skipAllChildren(placeholderUid, currentChildElementArray, nextElementSiblingFn) {
  while (_nextChild(placeholderUid, currentChildElementArray, nextElementSiblingFn));
  return currentChildElementArray[0];
}

function _skipChildren(placeholderUid, currentChildElementArray, count, nextElementSiblingFn) {
  for (let index = 0; index < count; index++) {
    if (!_nextChild(placeholderUid, currentChildElementArray, nextElementSiblingFn)) return;
  }
  return currentChildElementArray[0];
}

function rangeForElement(startElement, nextElementSiblingFn) {
  if (!startElement) return [undefined, undefined];
  const currentChildElementArray = [startElement];
  _nextChild(startElement.getAttribute('nobo-placeholder-uid'), currentChildElementArray, nextElementSiblingFn);
  return [startElement, currentChildElementArray[1]];
}

function childRanges({ placeholderDiv, nextElementSiblingFn }) {
  const placeholderUid = placeholderDiv.getAttribute('nobo-uid'),
    ret = [];
  let element = nextElementSiblingFn ? nextElementSiblingFn(placeholderDiv) : placeholderDiv.nextElementSibling;

  while (element && element.getAttribute('nobo-placeholder-uid') == placeholderUid) {
    const currentChildElementArray = [element];
    _nextChild(placeholderUid, currentChildElementArray, nextElementSiblingFn);
    ret.push([element, currentChildElementArray[1]]);
    element = currentChildElementArray[0];
  }
  return ret;
}

function childRangeAtIndex({ placeholderDiv, index, nextElementSiblingFn }) {
  if (index < 0) return [placeholderDiv, placeholderDiv];
  const placeholderUid = placeholderDiv.getAttribute('nobo-uid'),
    firstElement = nextElementSiblingFn ? nextElementSiblingFn(placeholderDiv) : placeholderDiv.nextElementSibling;

  if (!firstElement || firstElement.getAttribute('nobo-placeholder-uid') != placeholderUid) return [];
  const startElement = skipChildren(placeholderUid, firstElement, index, nextElementSiblingFn);
  if (!startElement) return [];
  const currentChildElementArray = [startElement];
  _nextChild(placeholderUid, currentChildElementArray, nextElementSiblingFn);
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

function forEachInElementRange(element, fn) {
  let [_start, end] = rangeForElement(element);
  while (true) {
    const next = element.nextElementSibling;
    fn(element);
    if (element == end) break;
    element = next;
  }
}

function mapInElementRange(element, fn) {
  let [_start, end] = rangeForElement(element);
  const ret = [];
  while (true) {
    const next = element.nextElementSibling;
    ret.push(fn(element));
    if (element == end) break;
    element = next;
  }
  return ret;
}

function findInElementRange(element, fn) {
  let [_start, end] = rangeForElement(element);
  while (true) {
    const next = element.nextElementSibling;
    if (fn(element)) return element;
    if (element == end) return;
    element = next;
  }
}

function logRange(module, prompt, element) {
  log(module, () => `${prompt ? `${prompt}:\n` : ''}${describeRange(element)}`);
}

function logTree(module, prompt, element) {
  log(module, () => `${prompt ? `${prompt}:\n` : ''}${describeTree(element)}`);
}

function logChange(module, prompt, change) {
  log(module, () => `${prompt ? `${prompt}:\n` : ''}${describeChange(change)}`);
}

function describeChange(change, indent = '') {
  let ret = '';
  if (change.firstElement) {
    ret += `${indent} Change${change.id ? ` #${change.id}` : ''} has new elements:\n${describeRange(
      change.firstElement,
      indent + '    + '
    )}`;
  } else {
    ret += `${indent} Change${change.id ? ` #${change.id}` : ''} has no new elements:\n`;
  }
  if (change.replace) {
    ret += `${indent} ... it replaces elements:\n${describeRange(change.replace, indent + '    x ')}`;
  } else if (change.insertAfter) {
    ret += `${indent} ... it inserts new elements after:\n${describeRange(change.insertAfter, indent + '    > ')}`;
  } else if (change.parent) {
    ret += `${indent} ... it} inserts new elements as first under:\n${describeRange(change.parent, indent + '    v ')}`;
  }
  return ret;
}

function describeRange(element, indent = '') {
  let ret = '';
  let isFirst = true;
  forEachInElementRange(element, el => {
    ret += describeTree(el, indent + (isFirst ? '- ' : '  '));
    isFirst = false;
  });
  return ret;
}

function describeTree(element, indent = '') {
  let ret = '';
  const templateDatapointId = element.getAttribute('nobo-template-dpid'),
    variant = templateDatapointId ? variantForTemplateDatapointId(templateDatapointId) : undefined,
    rowId = templateDatapointId ? ConvertIds.decomposeId({ datapointId: templateDatapointId }).rowId : undefined,
    name = nameForElement(element),
    clas = element.className.replace(' ', '+'),
    waitCount = elementWaitCount(element),
    waitNames = elementWaitNames(element),
    rootInChangeId = elementRootInChangeId(element),
    waitingChangeIds = elementWaitingChangeIds(element),
    waitInfo = `${waitCount ? `Wx${waitCount}` : ''}${waitNames.length ? `[${waitNames.join(',')}]` : ''}${
      rootInChangeId ? `R${rootInChangeId}` : ''
    }${waitingChangeIds.length ? `C[${waitingChangeIds.join(',')}]` : ''}`,
    desc = `${name}${clas ? `.${clas}` : ''}${templateDatapointId ? `:${rowId}${variant ? `[${variant}]` : ''}` : ''}${
      waitInfo ? `{${waitInfo}}` : ''
    }`;
  ret += `${indent}${desc}\n`;
  indent += '. ';
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    ret += describeRange(child, indent);
    child = rangeForElement(child)[1];
  }
  return ret;
}

function elementWaitCount(element) {
  return Number(element.getAttribute(waitCountAttributeName) || 0);
}

function elementWaitNames(element) {
  const names = element.getAttribute(waitNamesAttributeName);
  return names ? names.split(' ') : [];
}

function elementRootInChangeId(element) {
  return element.getAttribute(rootInChangeIdAttributeName) || undefined;
}

function elementWaitingChangeIds(element) {
  const value = element.getAttribute(waitingChangesAttributeName);
  return value ? value.split(' ') : [];
}
