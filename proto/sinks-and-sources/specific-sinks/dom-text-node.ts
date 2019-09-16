import { ValueSink_publicInterface as ValueSink } from "../../../interfaces/sinks-and-sources";
import sourceRegistries, {
  HTMLElementName,
  NumberName,
  OptStringName,
} from "../../../interfaces/standard-source-registries";

export class DomTextNodeSinkManager {
  private sinks: {
    element: ValueSink<HTMLElement>;
    index: ValueSink<number>;
    value: ValueSink<string | undefined>;
  };
  private values: {
    element?: HTMLElement;
    index?: number;
    value?: string;
  } = {};

  constructor(sources: { element: HTMLElementName; index: NumberName; value: OptStringName }) {
    const me = this;
    this.sinks = {
      element: sourceRegistries.htmlElements.attachSinkToSource(sources.element, {
        sourceHasNewValue(v: HTMLElement): undefined {
          me.values.element = v;
          me.refresh();
          return;
        },
      }),
      index: sourceRegistries.numbers.attachSinkToSource(sources.index, {
        sourceHasNewValue(v: number): undefined {
          me.values.index = v;
          me.refresh();
          return;
        },
      }),
      value: sourceRegistries.optStrings.attachSinkToSource(sources.value, {
        sourceHasNewValue(v: string | undefined): undefined {
          me.values.value = v;
          me.refresh();
          return;
        },
      }),
    };
  }

  kill() {
    this.sinks.element.detachFromSource && this.sinks.element.detachFromSource();
    this.sinks.value.detachFromSource && this.sinks.value.detachFromSource();
  }

  refresh() {
    const { element, index, value } = this.values;
    if (!element || index === undefined || index < 0) return;
    DomTextNodeSinkManager.textNodeAtIndex(element, index).textContent = value || "";
  }

  static textNodeAtIndex(element: HTMLElement, index: number): Node {
    if (index < 0) throw new Error("Invalid input passed to TextNodeSink::textNodeAtIndex: index<0");
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType == 3 && !index--) return child;
    }
    const document = element.ownerDocument;
    if (!document) throw new Error("element has no ownerDocument, cannot create a text node");
    while (true) {
      const child = document.createTextNode("");
      element.appendChild(child);
      if (!index--) return child;
    }
  }
}
