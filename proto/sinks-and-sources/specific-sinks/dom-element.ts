import { ValueSink_publicInterface as ValueSink } from "../../../interfaces/sinks-and-sources";
import sourceRegistries, {
  HTMLElementName,
  NumberName,
  OptStringName,
} from "../../../interfaces/standard-source-registries";
import { DomAttributeSinkManager } from "./dom-attribute";
import { DomTextNodeSinkManager } from "./dom-text-node";

export interface HTMLElementSinkManager_childInterface {
  refresh(): void;
  element(): HTMLElement;
}

export class HTMLElementSinkManager {
  private _element: HTMLElement;
  get element() {
    return this._element;
  }

  private attributeSinks: { [name: string]: ValueSink<string | undefined> } = {};
  private textNodeSinks: { [index: number]: ValueSink<string | undefined> } = {};

  constructor(element: HTMLElement) {
    const me = this;
    this._element = element;

    for (const { name, value } of Array.from(element.attributes)) {
      this.setAttribute(name, value);
    }
  }

  kill() {
    //TODO
  }

  private setAttribute(name: string, value?: string) {
    const valueIsSource = value && /^`.*`$/.test(value);
    const sink = this.attributeSinks[name];
    if (!valueIsSource) {
      if (sink) {
        sink.detachFromSource && sink.detachFromSource();
      }
      if (value == null) this.element.removeAttribute(name);
      else {
        this.element.setAttribute(name, value);
      }
    } else if (valueIsSource) {
      if (!this.attributeSinks[name]) {
        this.attributeSinks[name] = {
          sourceHasNewValue: (value: string | undefined): undefined => {
            if (value == null) this.element.removeAttribute(name);
            else {
              this.element.setAttribute(name, value);
            }
            return;
          },
        };
      }
      sourceRegistries.optStrings.attachSinkToSource(value, this.attributeSinks[name]);
    }
  }

  private setTextNode(index: number, value?: string) {
    const valueIsSource = value && /^`.*`$/.test(value);
    const sink = this.attributeSinks[name];
    if (!valueIsSource) {
      if (sink) {
        sink.detachFromSource && sink.detachFromSource();
      }
      if (value == null) this.element.removeAttribute(name);
      else {
        this.element.setAttribute(name, value);
      }
    } else if (valueIsSource) {
      if (!this.attributeSinks[name]) {
        this.attributeSinks[name] = {
          sourceHasNewValue: (value: string | undefined): undefined => {
            if (value == null) this.element.removeAttribute(name);
            else {
              this.element.setAttribute(name, value);
            }
            return;
          },
        };
      }
      optStrings.attachSinkToSource(value, this.attributeSinks[name]);
    }
  }

  setTextNode(index: number, source: StringSource | string) {
    const { textNodeSinks } = this,
      sink = textNodeSinks[index];
    if (sink) {
      if (sink.source === source) return;

      sink.kill();
      delete textNodeSinks[index];
    }
    if (typeof source === "string") {
      TextNodeSink.textNodeAtIndex(this.element, index).textContent = source;
    } else {
      textNodeSinks[index] = new TextNodeSink(this, index, source);
    }
  }
}

function textNodeAtIndex(element: HTMLElement, index: number): Node {
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
