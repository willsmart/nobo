// layout_to_db_schema
// © Will Smart 2018. Licence: MIT

const TestRig = require('../../general/test-rig');
const processArgs = require('../../general/process-args');
const DatapointCache = require('../../datapoint-cache');
const DbDatapointConnection = require('../../db/db-datapoint-connection');
const DomGenerator = require('../../dom/dom-generator');
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

(async function() {
  var args = processArgs();

  console.log('   args: ' + JSON.stringify(args));

  await TestRig.go(
    {
      path: __dirname,
      moduleName: 'DOM Generator',
      verbosity: 3,
      failVerbosity: 3,
    },
    async function(rig) {
      rig.startTask('DomGenerator tests');
      const schema = rig.schema,
        connection = rig.connection,
        datapointConnection = new DbDatapointConnection({ schema, connection }),
        cache = new DatapointCache({ schema, datapointConnection }),
        domGenerator = new DomGenerator({
          htmlToElement,
          cache,
        });

      async function validateAll() {
        while (true) {
          if (!(await cache.validateNewlyInvalidDatapoints()).length) break;
        }
      }

      await validateAll();

      await rig.assert(
        `that the depth and template dpid attributes are set correctly for nil variant unloaded template`,
        domTree(domGenerator.createElementsForVariantOfRow({ variant: '', proxyableRowOrDatapointId: 'user__1' })[0]),
        {
          equals: {
            type: 'DIV',
            attributes: { 'nobo-depth': '1', 'nobo-template-dpid': 'user__1__template' },
          },
        }
      );

      await rig.assert(
        `that the depth and template dpid attributes are set correctly for non-nil variant unloaded template`,
        domTree(
          domGenerator.createElementsForVariantOfRow({ variant: 'tablerow', proxyableRowOrDatapointId: 'user__1' })[0]
        ),
        {
          equals: {
            type: 'DIV',
            attributes: { 'nobo-depth': '1', 'nobo-template-dpid': 'user__1__template_tablerow' },
          },
        }
      );

      cache.getOrCreateDatapoint({ datapointId: 'user__1__template' }).watch({});
      cache.getOrCreateDatapoint({ datapointId: 'user__1__template_tablerow' }).watch({});
      cache.getOrCreateDatapoint({ datapointId: 'user__2__template' }).watch({});
      cache.getOrCreateDatapoint({ datapointId: 'app__1__template' }).watch({});
      await validateAll();

      await rig.assert(
        `that the dom datapoint id attribute is set correctly for nil variant loaded template`,
        domTree(domGenerator.createElementsForVariantOfRow({ variant: '', proxyableRowOrDatapointId: 'user__1' })[0]),
        {
          includes: {
            attributes: { 'nobo-dom-dpid': 'template__1__dom' },
          },
        }
      );

      await rig.assert(
        `that the dom datapoint id attribute is set correctly for non-nil variant loaded template`,
        domTree(
          domGenerator.createElementsForVariantOfRow({ variant: 'tablerow', proxyableRowOrDatapointId: 'user__1' })[0]
        ),
        {
          includes: {
            attributes: { 'nobo-dom-dpid': 'template__2__dom' },
          },
        }
      );

      cache.getOrCreateDatapoint({ datapointId: 'template__1__dom' }).watch({});
      cache.getOrCreateDatapoint({ datapointId: 'template__2__dom' }).watch({});
      cache.getOrCreateDatapoint({ datapointId: 'template__3__dom' }).watch({});
      await validateAll();

      await rig.assert(
        `that the correct template dom is used`,
        domTree(domGenerator.createElementsForVariantOfRow({ variant: '', proxyableRowOrDatapointId: 'user__1' })[0]),
        {
          includes: {
            attributes: { thedomtype: 'user' },
          },
        }
      );

      cache.getOrCreateDatapoint({ datapointId: 'user__1__name' }).watch({});
      cache.getOrCreateDatapoint({ datapointId: 'user__2__name' }).watch({});
      cache.getOrCreateDatapoint({ datapointId: 'app__1__users' }).watch({});
      await validateAll();

      await rig.assert(
        `that a more complicated dom tree is generated correctly`,
        domTree(domGenerator.createElementsForVariantOfRow({ variant: '', proxyableRowOrDatapointId: 'app__1' })),
        {
          equals: [
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
                name: '2 user name',
                'nobo-depth': '2',
                'nobo-template-dpid': 'user__2__template',
                'nobo-dom-dpid': 'template__1__dom',
                'nobo-backup-text-0': '${name}',
                'nobo-backup--name': '${name}',
                'nobo-row-id': 'user__2',
                'nobo-val-dpids': 'user__2__name',
                'nobo-use-user__2__name': '=0 name',
              },
              textNodes: ['2 user name'],
            },
            {
              type: 'DIV',
              attributes: {
                thedomtype: 'user',
                name: '1 user name',
                'nobo-depth': '2',
                'nobo-template-dpid': 'user__1__template',
                'nobo-dom-dpid': 'template__1__dom',
                'nobo-backup-text-0': '${name}',
                'nobo-backup--name': '${name}',
                'nobo-row-id': 'user__1',
                'nobo-val-dpids': 'user__1__name',
                'nobo-use-user__1__name': '=0 name',
              },
              textNodes: ['1 user name'],
            },
          ],
        }
      );

      rig.endTask();
    }
  );
})();
