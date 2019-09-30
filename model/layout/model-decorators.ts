import { anyValue } from '../../interface/any';

type Constructor = { new (...args: any[]): {} };
type Prototype = object;

export class Class {
  name: string;
  attributes: Attribute[];
  from: (options: { [arg: string]: anyValue }) => anyValue;

  constructor(name: string, attributes: Attribute[], from: (options: { [arg: string]: anyValue }) => anyValue) {
    this.name = name;
    this.attributes = attributes;
    this.from = from;
  }
}

type AttributeArguments = {
  key: string;
  class: Class;
};
export class Attribute {
  key: string;
  class: Class;
  constructor(args: AttributeArguments) {
    this.key = args.key;
    this.class = args.class;
  }
}
//export function attribute(args:AttributeArguments):Attribute {
//  return new Attribute(args)
//}

export function model<T extends Constructor>(constructor: T): Constructor {
  // save a reference to the original constructor
  const original = constructor;

  // a utility function to generate instances of a class
  function construct(constructor: Constructor, args) {
    var c: any = function() {
      return constructor.apply(this, args);
    };
    c.prototype = constructor.prototype;
    return new c();
  }

  // the new constructor behaviour
  var f: any = function(...args) {
    console.log('New: ' + original.name);
    return construct(original, args);
  };

  // copy prototype so intanceof operator still works
  f.prototype = original.prototype;

  // return new constructor (will override original)
  return f;
}

export function attribute<T extends Prototype>(constructor: T, key: string): any {
  // save a reference to the original constructor
  const original = constructor;

  // a utility function to generate instances of a class
  function construct(constructor: Constructor, args) {
    var c: any = function() {
      return constructor.apply(this, args);
    };
    c.prototype = constructor.prototype;
    return new c();
  }

  // the new constructor behaviour
  var f: any = function(...args) {
    console.log('New: ' + original.name);
    return construct(original, args);
  };

  // copy prototype so intanceof operator still works
  f.prototype = original.prototype;

  // return new constructor (will override original)
  return f;
}
