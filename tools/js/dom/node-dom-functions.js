module.exports = require('./dom-functions');
module.exports.htmlToElement = htmlToElement;

const { JSDOM } = require('jsdom');

function htmlToElement(html) {
  let element = JSDOM.fragment(html.trim()).firstElementChild;
  if (element && element.nodeType == 3) {
    let span = JSDOM.fragment('<span></span>').firstElementChild;
    span.innerText = element.textContent;
    element = span;
  }
  return element;
}
