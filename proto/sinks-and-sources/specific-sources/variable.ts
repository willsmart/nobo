import { ValueSource } from '../value-source';

export class VariableStringSource extends ValueSource<string | undefined> {
  private theValue?: string;

  constructor() {
    super();
  }

  setValue(v: string | undefined): Promise<void> {
    this.theValue = v;
    return this.sourceHasNewValue(v);
  }

  sourceValue(): Promise<string | undefined> {
    return Promise.resolve(this.theValue);
  }
}
