const ChangeCase = require('change-case');
const ConvertIds = require('../datapoints/convert-ids');
const nameForElement = require('../general/name-for-element');
const log = require('../general/log');

// API is just all the functions
module.exports = {
  htmlToElement,
  templateDatapointIdForRowAndVariant,
  variantForTemplateDatapointId,
  describeTree,
  rangeForElement,
  forEachInElementRange,
  mapInElementRange,
  findInElementRange,
  forEachChildRange,
  mapChildRanges,
  findChildRange,
  childRangesForElement,
  insertChildRange,
  deleteChildRange,
};

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
    fieldName: `template_${variant || 'default'}`,
  }).datapointId;
}

function variantForTemplateDatapointId(datapointId) {
  const { fieldName } = ConvertIds.decomposeId({ datapointId });
  if (fieldName.startsWith('template')) {
    const variant = ChangeCase.camelCase(fieldName.substring('template'.length));
    return variant == 'default' ? undefined : variant;
  }
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

function describeTree(element, indent = '') {
  let ret = '';
  const templateDatapointId = element.getAttribute('nobo-template-dpid'),
    variant = templateDatapointId ? variantForTemplateDatapointId(templateDatapointId) : undefined,
    rowId = templateDatapointId ? ConvertIds.decomposeId({ datapointId: templateDatapointId }).rowId : undefined,
    name = nameForElement(element),
    clas = element.className.replace(' ', '+'),
    desc = `${name}${clas ? `.${clas}` : ''}${templateDatapointId ? `:${rowId}${variant ? `[${variant}]` : ''}` : ''}`;
  ret += `${indent}${desc}\n`;
  indent += '. ';
  forEachChildRange(element, ([child]) => {
    ret += describeTree(child, indent);
  });
  return ret;
}

function rangeForElement(element) {
  const parentId = parent.getAttribute('nobo-uid');
  if (!parentId) return [element, element];
  for (let child = parent.nextElementSibling, lastChildEnd = parent; child; child = lastChildEnd.nextElementSibling) {
    if (child.getAttribute('nobo-parent-uid') != parentId) break;
    lastChildEnd = rangeForElement(child)[1];
  }
  return [element, lastChildEnd];
}

function forEachChildRange(parent, fn) {
  const parentId = parent.getAttribute('nobo-uid');
  for (let child = parent.nextElementSibling, lastChildRange; child; child = lastChildRange[1].nextElementSibling) {
    if (child.getAttribute('nobo-parent-uid') != parentId) break;
    fn((lastChildRange = rangeForElement(child)));
  }
}

function mapChildRanges(parent, fn) {
  const ret = [];
  forEachChildRange(parent, range => ret.push(fn(range)));
  return ret;
}

function findChildRange(parent, fn) {
  const parentId = parent.getAttribute('nobo-uid');
  for (let child = parent.nextElementSibling, lastChildRange; child; child = lastChildRange[1].nextElementSibling) {
    if (child.getAttribute('nobo-parent-uid') != parentId) break;
    if (fn((lastChildRange = rangeForElement(child)))) {
      return lastChildRange;
    }
  }
}

function childRangesForElement(parent) {
  const ranges = [];
  forEachChildRange(parent, range => ranges.push(range));
  return ranges;
}

function insertChildRange({ parent, before, childRange }) {
  for (
    let [child, end] = childRange, nextSibling = child === end ? undefined : child.nextSibling;
    child;
    child = nextSibling, nextSibling = !child || child === end ? undefined : child.nextSibling
  ) {
    parent.insertBefore(child, before);
  }
}

function deleteChildRange([child, end]) {
  for (
    let nextSibling = child === end ? undefined : child.nextSibling;
    child;
    child = nextSibling, nextSibling = !child || child === end ? undefined : child.nextSibling
  ) {
    if (child.parentNode) child.parentNode.removeChild(child);
  }
}
