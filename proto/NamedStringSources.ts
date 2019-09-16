import { OptionalStringSource } from "./sinks-and-sources/value-source";
import { ValueCoord } from "./StringSourceRegistry";
import { VariableStringSource } from "./sinks-and-sources/specific-sources/variable";
import { MemberStringSource } from "./sinks-and-sources/specific-sources/member";
import { HandlePromise } from "./promise-handler/promise-handler";

export function createGenerator(handlePromise: HandlePromise) {
  return (coord: ValueCoord): OptionalStringSource => {
    const { type, row, field } = coord;
    switch (type) {
      case "var":
        return new VariableStringSource();
      case "global":
        if (row) break;
        return MemberStringSource.getOrCreate(field, globalThis, handlePromise);
    }

    throw new Error(
      `I don't know how to make a StringSource for value at 'coord.stringCoord || StringSourceRegistry.constructStringCoord(coord)'`
    );
  };
}
