const PublicApi = require("../general/public-api");
const locateEnd = require("../general/locate-end");
const CodeSnippet = require("../general/code-snippet");

const { locateEndOfString } = locateEnd;

const ConvertIds = require("../convert-ids");

// API is auto-generated at the bottom from the public interface of this class

class TemplatedText {
  // public methods
  static publicMethods() {
    return ["evaluate", "dependencyTree", "nodesByDatapointId"];
  }

  constructor({ text, proxyableRowId, getDatapoint }) {
    this.templateString = text;
    this.proxyableRowId = proxyableRowId;
    this.getDatapoint = getDatapoint;
  }

  get nodesByDatapointId() {
    this.dependencyTree;
    return this._nodesByDatapointId;
  }

  get dependencyTree() {
    const templatedText = this,
      templateString = templatedText.templateString,
      getDatapoint = templatedText.getDatapoint,
      proxyableRowId = templatedText.proxyableRowId;
    if (templatedText._dependencyTree) return templatedText._dependencyTree;
    templatedText._nodesByDatapointId = {};
    const rootPart = locateEndOfString(templateString, false);
    if (!rootPart) return;
    const parts = rootPart.children;
    if (!parts) return;

    const root = (templatedText._dependencyTree = {
      string: templateString
    });
    for (const part of parts) {
      markup(part, root);
    }
    return root;

    function markup(part, parent) {
      if (part.type != "${}") {
        if (part.children) for (const child of part.children) markup(child, parent);
        return;
      }
      const node = { range: part.range };
      parent.children = parent.children || [];
      parent.children.push(node);
      if (part.children) {
        for (const child of part.children) {
          markup(child, node);
        }
      }
      if (!node.children) {
        node.code = new CodeSnippet({ code: templateString.substring(part.range[0] + 2, part.range[1] - 1) });
        if (!node.code.script) {
          delete node.code;
          return;
        }
        if (proxyableRowId) {
          for (const [fieldName, subNames] of Object.entries(node.code.names)) {
            if (typeof subNames == "object" && Object.keys(subNames).length) continue;
            node.datapointIdsByName = node.datapointIdsByName || {};
            const proxyableDatapointId = ConvertIds.recomposeId({ proxyableRowId, fieldName }).proxyableDatapointId;
            node.datapointIdsByName[fieldName] = proxyableDatapointId;
            templatedText._nodesByDatapointId[proxyableDatapointId] =
              templatedText._nodesByDatapointId[proxyableDatapointId] || [];
            templatedText._nodesByDatapointId[proxyableDatapointId].push(node);
          }
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
      templateString = templatedText.templateString;
    if (!nodes) return { string: this.templateString.substring(range[0], range[1]) };

    let string = "",
      wasIndex = 0,
      addIndex = 0;

    for (const node of nodes) {
      let repl = "...";
      if (node.children) {
        // TODO
      } else if (node.code) {
        repl =
          "" +
          node.code.evaluate((...names) => {
            if (names.length > 1) return "...";
            const proxyableDatapointId = node.datapointIdsByName[names[0]];
            if (!proxyableDatapointId) return "...";
            const ret = this.getDatapoint(proxyableDatapointId, "...");
            return Array.isArray(ret) && !ret.length ? undefined : ret;
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
  hasExposedBackDoor: true
});
