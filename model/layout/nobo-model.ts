import { anyPrimitive } from "../../interface/any";

export class ModelClass {
  static all: { [name: string]: ModelClass } = {};
  static string = new ModelClass("string");
  static integer = new ModelClass("integer");
  static boolean = new ModelClass("boolean");

  name: string;
  as: string;
  attributes: { [key: string]: ModelAttribute } = {};

  static named(name: string): ModelClass {
    return ModelClass.all[name] || new ModelClass(name);
  }

  setAttribute(key: string, attribute: Attribute) {
    const linkage = attribute.linkage
        ? {
            ...attribute.linkage,
            as: attribute.linkage.as || this.as,
          }
        : undefined,
      modelAttribute = (this.attributes[key] = new ModelAttribute(
        attribute.dataType,
        attribute.default,
        linkage,
        attribute.attributes,
        this,
        key
      ));
    const opposingAttribute = modelAttribute.opposingLinkAttribute;
    if (opposingAttribute && linkage) attribute.dataType.setAttribute(linkage.as, opposingAttribute);
  }

  constructor(name: string, as: string | undefined = undefined, attributes: { [key: string]: Attribute } = {}) {
    this.name = name;
    this.as = as || name.replace(/^\w/, c => c.toLowerCase());
    for (const [key, attribute] of Object.entries(attributes)) {
      this.setAttribute(key, attribute);
    }
    ModelClass.all[name] = this;
  }
}

class Attribute {
  dataType: ModelClass;
  default: anyPrimitive | ValueReference | (() => anyPrimitive | ValueReference);
  linkage: LinkageType | undefined;
  attributes: { [key: string]: Attribute };

  constructor(
    dataType: ModelClass,
    defaultValue: anyPrimitive | ValueReference | (() => anyPrimitive | ValueReference),
    linkage: LinkageType | undefined,
    attributes: { [key: string]: Attribute }
  ) {
    this.dataType = dataType;
    this.default = defaultValue;
    this.linkage = linkage;
    this.attributes = attributes;
  }
}

class ModelAttribute extends Attribute {
  enclosingType: ModelClass;
  key: string;
  constructor(
    dataType: ModelClass,
    defaultValue: anyPrimitive | ValueReference | (() => anyPrimitive | ValueReference),
    linkage: LinkageType | undefined,
    attributes: { [key: string]: Attribute },
    enclosingType: ModelClass,
    key: string
  ) {
    super(dataType, defaultValue, linkage, attributes);
    this.enclosingType = enclosingType;
    this.key = key;
  }

  get opposingLinkAttribute(): Attribute | undefined {
    if (!this.linkage) return;
    return new Attribute(
      this.enclosingType,
      undefined,
      { arity: oppositeArity(this.linkage.arity), owner: oppositeOwner(this.linkage.owner), as: this.key },
      {}
    );
  }
}

type ValueReference = {
  clas: ModelClass | string;
  id?: string;
  field?: string;
  parent?: ValueReference;
};

export enum LinkageArity {
  oneLink = 1,
  manyChildren,
  manyParents,
  manyLinks,
}
function oppositeArity(arity: LinkageArity): LinkageArity {
  switch (arity) {
    case LinkageArity.oneLink:
    case LinkageArity.manyLinks:
      return arity;
    case LinkageArity.manyChildren:
      return LinkageArity.manyChildren;
    case LinkageArity.manyParents:
      return LinkageArity.manyParents;
  }
}
export enum LinkageOwner {
  child = 1,
  parent,
  none,
}
function oppositeOwner(owner?: LinkageOwner): LinkageOwner {
  switch (owner) {
    case LinkageOwner.none:
      return owner;
    case LinkageOwner.child:
      return LinkageOwner.parent;
    case LinkageOwner.parent:
    case undefined:
      return LinkageOwner.child;
  }
}

export type LinkageType = { arity: LinkageArity; owner: LinkageOwner; as?: string };

type AttributeDecl =
  | ModelClass
  | string
  | {
      clas: ModelClass | string;
      default?: anyPrimitive | ValueReference | (() => anyPrimitive | ValueReference);
      linkage?: LinkageArity | { arity: LinkageArity; owner?: LinkageOwner; as?: string };
      children?: { [key: string]: AttributeDecl };
    };

export function model(
  name: string | { name: string; as: string },
  attributeDecls: { [key: string]: AttributeDecl } = {}
): ModelClass {
  const attributes: { [key: string]: Attribute } = {};
  for (let [key, attributeDecl] of Object.entries(attributeDecls)) {
    attributes[key] = attribute(attributeDecl);
  }
  const as = typeof name === "object" ? name.as : name;
  name = typeof name === "object" ? name.name : name;
  return new ModelClass(name, as, attributes);
}

export function attribute(decl: AttributeDecl): Attribute {
  if (typeof decl === "string" || "name" in decl) decl = { clas: decl };

  const children: { [key: string]: Attribute } = {};
  if (decl.children)
    for (let [key, child] of Object.entries(decl.children)) {
      children[key] = attribute(child);
    }

  return new Attribute(
    typeof decl.clas === "string" ? ModelClass.named(decl.clas) : decl.clas,
    decl.default,
    decl.linkage
      ? { owner: LinkageOwner.parent, ...(typeof decl.linkage !== "object" ? { arity: decl.linkage } : decl.linkage) }
      : undefined,
    children
  );
}
