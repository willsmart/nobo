import {
  ValueSource_abstract as ValueSource,
  ValueSourceInterfacePassback,
} from "../../../interfaces/value-source-abstract";
import { TypeHelper } from "../../../interfaces/misc";
import { HandlePromise } from "../../../interfaces/promise-handler";
import { anyValue } from "../../../interfaces/any";

export class MemberValueSource<T extends anyValue> extends ValueSource<T> {
  protected valueFromSubclass(): Promise<T> {
    return Promise.resolve(this.backingValue);
  }

  setValueInSubclass(v: T): Promise<T> {
    if (v === this.backingValue) return Promise.resolve(v);
    this.backingValue = v;
    return this.subclassHasNewValue(v);
  }

  // Private parts
  private backingValue: T;

  constructor({
    interfacePassback,
    typeHelper,
    handlePromise,
    propertyName,
    sourceObject,
  }: {
    interfacePassback: ValueSourceInterfacePassback<T>;
    typeHelper: TypeHelper<T>;
    handlePromise: HandlePromise;
    propertyName: string;
    sourceObject: { [propertyName: string]: anyValue };
  }) {
    super({ interfacePassback, value: typeHelper.getDefaultValue(), valid: true });
    this.backingValue = this.cachedValue;

    const sourcePropertyName = MemberValueSource.sourcePropertyName(propertyName);

    if (propertyName in sourceObject || sourcePropertyName in sourceObject) {
      throw new Error(
        `Cannot create a MemberValueSource since the passed object already has a ${propertyName} or ${sourcePropertyName} property defined`
      );
    }

    const memberValueSource = this;

    Object.defineProperty(sourceObject, propertyName, {
      configurable: false,
      enumerable: true,
      get: () => memberValueSource.backingValue,
      set: (v_any?: anyValue) => {
        const v = typeHelper.castFrom(v_any);
        if (v === memberValueSource.backingValue) return;
        memberValueSource.backingValue = v;
        handlePromise(this.subclassHasNewValue(v));
      },
    });

    Object.defineProperty(sourceObject, sourcePropertyName, {
      configurable: false,
      enumerable: false,
      get: () => this,
    });
  }

  static sourcePropertyName(propertyName: string) {
    return `${propertyName}~source`;
  }

  static getExisting<T extends anyValue>(
    propertyName: string,
    sourceObject: { [propertyName: string]: anyValue }
  ): MemberValueSource<T> | undefined {
    return <MemberValueSource<T> | undefined>sourceObject[MemberValueSource.sourcePropertyName(propertyName)];
  }
}
