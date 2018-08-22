const PublicApi = require('../general/public-api');
const locateEnd = require('../general/locate-end');
const CodeSnippet = require('../general/code-snippet');
const StateVar = require('../general/state-var');

const { locateEndOfString } = locateEnd;

const ConvertIds = require('../convert-ids');

// API is auto-generated at the bottom from the public interface of this class

class TemplatedText {
  // public methods
  static publicMethods() {
    return ['evaluate', 'dependencyTree', 'nodesByDatapointId'];
  }

  constructor({ text, rowId, cache }) {
    this.templateString = text;
    this.rowId = rowId;
    this.cache = cache;
  }

  get nodesByDatapointId() {
    this.dependencyTree;
    return this._nodesByDatapointId;
  }

  get dependencyTree() {
    const templatedText = this,
      templateString = templatedText.templateString,
      cache = templatedText.cache,
      rowId = templatedText.rowId;
    if (templatedText._dependencyTree) return templatedText._dependencyTree;
    templatedText._nodesByDatapointId = {};
    const rootPart = locateEndOfString(templateString, false);
    if (!rootPart) return;
    const parts = rootPart.children;
    if (!parts) return;

    const root = (templatedText._dependencyTree = {
      string: templateString,
    });
    for (const part of parts) {
      markup(part, root);
    }
    return root;

    function markup(part, parent) {
      if (part.type != '${}') {
        return;
      }
      const node = { range: part.range };
      parent.children = parent.children || [];
      parent.children.push(node);

      node.code = new CodeSnippet({ cache, code: templateString.substring(part.range[0] + 2, part.range[1] - 1) });
      if (!node.code.names) {
        delete node.code;
        return;
      }
      if (rowId) {
        for (const [fieldName, subNames] of Object.entries(node.code.names)) {
          let datapointId;
          if (fieldName.startsWith('state.')) {
            datapointId = StateVar.datapointId(fieldName);
          } else {
            if (typeof subNames == 'object' && Object.keys(subNames).length) continue;
            datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId;
          }
          node.datapointIdsByName = node.datapointIdsByName || {};
          node.datapointIdsByName[fieldName] = datapointId;
          templatedText._nodesByDatapointId[datapointId] = templatedText._nodesByDatapointId[datapointId] || [];
          templatedText._nodesByDatapointId[datapointId].push(node);
        }
      }
    }
  }

  get evaluate() {
    const templatedText = this,
      root = templatedText.dependencyTree;
    if (!root || !root.children) return { string: this.templateString };
    return this.evaluatePart({ nodes: root.children, range: [0, undefined] });
  }

  evaluatePart({ nodes, range }) {
    const templatedText = this,
      { cache, templateString, rowId } = templatedText;
    if (!nodes) return { string: this.templateString.substring(range[0], range[1]) };

    let string = '',
      wasIndex = 0,
      addIndex = 0;

    for (const node of nodes) {
      let repl = '...';
      if (node.children) {
        // TODO
      } else if (node.code) {
        repl =
          '' +
          node.code.evaluate({
            cache,
            rowId,
            valueForNameCallback: 'model',
          });
      }
      if (node.range[0] < wasIndex) continue;
      if (node.range[0] > wasIndex) string += templateString.substring(wasIndex, node.range[0]);
      if (repl.length) string += repl;
      wasIndex = node.range[1];
      if (wasIndex === undefined) break;
      addIndex += repl.length - (wasIndex - node.range[0]);
    }
    if (wasIndex !== undefined && wasIndex < templateString.length) {
      string += templateString.substring(wasIndex);
    }
    return { string };
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: TemplatedText,
  hasExposedBackDoor: true,
});
