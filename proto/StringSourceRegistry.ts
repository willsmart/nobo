import { StringSource } from './sinks-and-sources/value-source';

export type ValueCoord = {
  type: string;
  row: string;
  field: string;
  stringCoord?: string;
};

export type StringSourceGenerator = (coord: ValueCoord) => StringSource;

export class StringSourceRegistry {
  private valueCoords: { [stringCoord: string]: ValueCoord } = {};
  private sources: { [stringCoord: string]: StringSource } = {};
  sourceGenerator: StringSourceGenerator;

  constructor(sourceGenerator: StringSourceGenerator) {
    this.sourceGenerator = sourceGenerator;
  }

  getExistingSource(coord: string | ValueCoord): StringSource | undefined {
    if (typeof coord !== 'string') {
      coord = coord.stringCoord || StringSourceRegistry.constructStringCoord(coord);
    }
    return this.sources[coord];
  }

  getSource(coord: string | ValueCoord): StringSource {
    let valueCoord: ValueCoord | undefined;
    if (typeof coord !== 'string') {
      valueCoord = coord;
      coord = coord.stringCoord || StringSourceRegistry.constructStringCoord(coord);
    }

    if (this.sources[coord]) return this.sources[coord];

    if (!valueCoord) {
      valueCoord = this.valueCoords[coord] || (this.valueCoords[coord] = StringSourceRegistry.parseStringCoord(coord));
    } else if (!this.valueCoords[coord]) this.valueCoords[coord] = valueCoord;

    return (this.sources[coord] = this.sourceGenerator(valueCoord));
  }

  static parseStringCoord(stringCoord: string): ValueCoord {
    const match = /^([A-Za-z1-9_-][A-Za-z0-9_-]*)~([A-Za-z1-9_-][A-Za-z0-9_-]*|)~([A-Za-z1-9_-][A-Za-z0-9_-]*|)$/.exec(
      stringCoord
    );
    if (!match) throw new Error(`Could not parse value coordinate: '${stringCoord}`);
    return {
      type: match[1],
      row: match[1],
      field: match[1],
    };
  }

  static constructValueCoord(type: string, row: string, field: string) {
    return {
      type,
      row,
      field,
      stringCoord: `${type}~${row}~${valueCoord.field}`,
    };
  }

  static constructStringCoord(valueCoord: ValueCoord) {
    return `${valueCoord.type}~${valueCoord.row}~${valueCoord.field}`;
  }
}
