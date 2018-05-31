const PublicApi = require("../general/public-api");

const ConvertIds = require("../convert-ids");

// API is auto-generated at the bottom from the public interface of this class

class TemplatedText {
  // public methods
  static publicMethods() {
    return ["ranges", "datapointIds"];
  }

  constructor({ text, rowId }) {
    this.templateString = text;
    this.rowId = rowId;
  }

  get ranges() {
    const templatedText = this,
      templateString = templatedText.templateString;
    if (templatedText._ranges) return templatedText._ranges;
    if (typeof templateString != "string") return (templatedText._ranges = []);
    return (templatedText._ranges = templatedText.getRanges(this.templateString));
  }

  getRanges(text, fromIndex, delimiters) {
    const templatedText = this,
      ranges = [];

    let prevIndex = fromIndex || 0,
      match;

    const regex = new RegExp(
        `^((?:\\\\\\\\|[^\\\\${delimiters || ""}])*)(${delimiters ? `([${delimiters}])|` : ""}(\\$\\{)|$)`,
        "g"
      ),
      delimiterCapi = delimiters ? 3 : undefined,
      bracketCapi = delimiters ? 4 : 3;

    while (true) {
      regex.lastIndex = prevIndex;
      if (!(match = regex.exec(text))) break;

      let textEnd = prevIndex + match[1].length,
        end = textEnd + match[2].length;
      if (!match[bracketCapi]) {
        if (prevIndex < textEnd) {
          const snippet = text.substring(prevIndex, textEnd);
          if (!prevIndex && ConvertIds.fieldNameRegex.test(snippet) && templatedText.rowId) {
            ranges.push({
              datapointId: ConvertIds.recomposeId({ rowId: templatedText.rowId, fieldName: snippet }).datapointId
            });
          } else ranges.push(snippet);
        }
        return {
          ranges,
          delimiter: delimiters && match[delimiterCapi] ? match[delimiterCapi] : undefined,
          matchEnd: end
        };
      }

      const range = {};
      let { delimiter, subRanges, matchEnd } = getRanges(text, end, "?|}");
      if (!delimiter) {
        ranges.push(text.substring(prevIndex));
        return { ranges };
      }

      if (delimiter == "?") {
        range.condition = subRanges;
        ({ delimiter, subRanges, matchEnd } = getRanges(text, matchEnd, "|}"));
        if (!delimiter) {
          ranges.push(text.substring(prevIndex));
          return { ranges };
        }
      }

      if (delimiter == "|") {
        range.truthy = subRanges;
        ({ delimiter, subRanges, matchEnd } = getRanges(text, matchEnd, "}"));
        if (!delimiter) {
          ranges.push(text.substring(prevIndex));
          return { ranges };
        }
        range.falsey = subRanges;
      } else range.truthy = subRanges;

      ranges.push(range);

      prevIndex = matchEnd;
    }
  }

  get datapointIds() {
    const templatedText = this;
    if (templatedText._datapointIds) return templatedText._datapointIds;

    const ranges = templatedText.ranges,
      datapointsById = {};

    gather(ranges);
    return (templatedText._datapointIds = Object.keys(datapointsById));

    function gather(range) {
      if (typeof range != "object") return;
      if (range.datapointId) {
        datapointsById[range.datapointId] = true;
        return;
      }
      if (range.condition) gather(range.condition);
      if (range.falsey) gather(range.falsey);
      if (range.truthy) gather(range.truthy);
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: TemplatedText,
  hasExposedBackDoor: true
});
