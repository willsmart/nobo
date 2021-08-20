// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const DatapointCache = require('../../cache/datapoint-cache');
const DbDatapointConnection = require('../../db/db-datapoint-connection');
const DomGenerator = require('../../dom/dom-generator');
const DomUpdater = require('../../dom/dom-updater');
const { htmlToElement } = require('../../dom/node-dom-functions');

function domTree(element) {
  if (Array.isArray(element)) return element.map(domTree);

  const ret = { type: element.nodeName };
  for (const attribute of element.attributes) {
    if (attribute.name == 'class') continue;
    ret.attributes = ret.attributes || {};
    ret.attributes[attribute.name] = attribute.value;
  }
  for (const cls of element.classList) {
    ret.classes = ret.classes || {};
    ret.classes[cls] = 1;
  }

  for (let ch = element.firstChild; ch; ch = ch.nextSibling) {
    if (ch.nodeType == 1) {
      ret.children = ret.children || [];
      ret.children.push(domTree(ch));
    } else if (ch.nodeType == 3) {
      ret.textNodes = ret.textNodes || [];
      ret.textNodes.push(ch.textContent);
    }
  }
  return ret;
}

module.exports = async function(rig) {
  rig.startTask('DomUpdater tests');
  const schema = rig.schema,
    connection = rig.connection,
    datapointConnection = new DbDatapointConnection({ schema, connection }),
    cache = new DatapointCache({ schema, htmlToElement, datapointConnection }),
    domGenerator = new DomGenerator({
      htmlToElement,
      cache,
    }),
    domUpdater = new DomUpdater({
      cache,
      domGenerator,
    });

  await cache.validateAll();

  let holder = htmlToElement('<div></div>');
  let [element] = domGenerator.createElementsForVariantOfRow({ variant: '', rowOrDatapointId: 'user__1' });
  holder.appendChild(element);
  await cache.validateAll();
  element = holder.firstChild;

  await rig.assert(
    `that the dom updater creates template datapoints as required`,
    cache.getExistingDatapoint('user__1__template'})
  );
  await rig.assert(
    `that the dom updater creates dom datapoints as required`,
    cache.getExistingDatapoint('template__1__dom')
  );
  await rig.assert(
    `that the dom updater creates attribute datapoints as required`,
    cache.getExistingDatapoint('user__1__name')
  );
  await rig.assert(
    `that the dom updater creates text node datapoints as required`,
    cache.getExistingDatapoint('user__1__bio')
  );

  await rig.assert(`that a simple dom tree is generated correctly`, domTree(element), {
    includes: {
      type: 'DIV',
      attributes: {
        thedomtype: 'user',
        name: '1 user name',
        'nobo-depth': '1',
        'nobo-template-dpid': 'user__1__template',
        'nobo-dom-dpid': 'template__1__dom',
        'nobo-backup-text-0': '${bio}',
        'nobo-backup--name': '${name}',
        'nobo-row-id': 'user__1',
        'nobo-val-dpids': 'user__1__bio user__1__name',
        'nobo-use-user__1__name': 'name',
        'nobo-use-user__1__bio': '=0',
      },
      textNodes: ['1 user bio'],
    },
  });

  let elements = domGenerator.createElementsForVariantOfRow({ variant: '', rowOrDatapointId: 'app__1' });
  holder = htmlToElement('<div></div>');
  for (const element of elements) holder.appendChild(element);
  await cache.validateAll();
  elements = [];
  for (let element = holder.firstElementChild; element; element = element.nextElementSibling) {
    elements.push(element);
  }

  await rig.assert(`that a more complicated dom tree is generated correctly`, domTree(elements), {
    includes: [
      {
        type: 'DIV',
        attributes: {
          'nobo-depth': '1',
          'nobo-template-dpid': 'app__1__template',
          'nobo-dom-dpid': 'template__3__dom',
          'nobo-children-dpid': 'app__1__users',
          'nobo-child-depth': '2',
        },
        classes: { 'users-model-child': 1 },
      },
      {
        type: 'DIV',
        attributes: {
          thedomtype: 'user',
          name: '1 user name',
          'nobo-depth': '2',
          'nobo-template-dpid': 'user__1__template',
          'nobo-dom-dpid': 'template__1__dom',
          'nobo-backup-text-0': '${bio}',
          'nobo-backup--name': '${name}',
          'nobo-row-id': 'user__1',
          'nobo-val-dpids': 'user__1__bio user__1__name',
          'nobo-use-user__1__bio': '=0',
          'nobo-use-user__1__name': 'name',
        },
        textNodes: ['1 user bio'],
      },
      {
        type: 'DIV',
        attributes: {
          thedomtype: 'user',
          name: '2 user name',
          'nobo-depth': '2',
          'nobo-template-dpid': 'user__2__template',
          'nobo-dom-dpid': 'template__1__dom',
          'nobo-backup-text-0': '${bio}',
          'nobo-backup--name': '${name}',
          'nobo-row-id': 'user__2',
          'nobo-val-dpids': 'user__2__bio user__2__name',
          'nobo-use-user__2__bio': '=0',
          'nobo-use-user__2__name': 'name',
        },
        textNodes: ['2 user bio'],
      },
    ],
  });

  rig.endTask();
};
