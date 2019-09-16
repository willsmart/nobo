import { ValueSink_publicInterface as ValueSink } from "../../../interfaces/sinks-and-sources";
import { HTMLElementSinkManager_childInterface as HTMLElementSinkManager } from "./dom-element";

export class DomAttributeSinkManager {
  elementSinkManager: HTMLElementSinkManager;
  name: string;
  private value?: string;
  private sinks: {
    value: ValueSink<string | undefined>;
  };

  constructor({ elementSinkManager, name }: { elementSinkManager: HTMLElementSinkManager; name: string }) {
    const me = this;
    this.elementSinkManager = elementSinkManager;
    this.name = name;

    this.sinks = {
      value: {
        sourceHasNewValue(v: string | undefined): undefined {
          me.value = v;
          me.refresh();
          return;
        },
      },
    };
  }

  kill() {
    this.sinks.value.detachFromSource && this.sinks.value.detachFromSource();
  }

  refresh() {
    const { element, name, value } = this;
    if (!element || name === undefined) return;
    if (value !== undefined) element.setAttribute(name, value);
    else element.removeAttribute(name);
  }
}
