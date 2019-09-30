import { anyPrimitive } from '../../interface/any';
import { attribute } from './model-decorators';

class ModelClass {
  name: string;
  attributes: { [key: string]: Attribute };

  constructor(name: string, attributes: { [key: string]: Attribute }) {
    this.name = name;
    this.attributes = attributes;
  }
}

class Attribute {
  clas: ModelClass;
  default: anyPrimitive | (() => string);
  attributes: { [key: string]: Attribute };

  constructor(clas: ModelClass, defaultValue: anyPrimitive | (() => string), attributes: { [key: string]: Attribute }) {
    this.clas = clas;
    this.default = defaultValue;
    this.attributes = attributes;
  }
}

type AttributeDecl = [
  Class,

    | anyPrimitive
    | {
        default: anyPrimitive | (() => string);
        [key: string]: AttributeDecl;
      }
];

function model(name: string, options: { [key: string]: AttributeDecl }): Model {
  const attributes: { [key: string]: Attribute } = {};
  for (const [key, [clas, rawAttributes]] of Object.entries(options)) {
    attributes[key] = attribute(clas, rawAttributes);
  }
  return new ModelClass(name, attributes);
}

function attribute(...[clas, rawAttributes]: AttributeDecl): Attribute {
  const attributes: { [key: string]: Attribute } = {};
  let defaultValue: anyPrimitive | (() => string);

  if (!rawAttributes || typeof rawAttributes !== 'object') {
    defaultValue = rawAttributes;
  } else {
    defaultValue = rawAttributes.default;
    for (const [key, rawAttribute] of Object.entries(rawAttributes)) {
      attributes[key] = attribute(...rawAttribute);
    }
  }
  return new Attribute(clas, defaultValue, attributes);
}

// function model()

// const App = model('App', {
//   name: [Model.string, "TriggerHappy demo"]
// }
// const App = model({
//   name: attribute(Model.string, "TriggerHappy demo")
// }
/*
- app(App):
    name(string): {default: "TriggerHappy demo"}

- user(User):
    name(string): {default: "Unnamed user"}
    email(string): null
    bio(string): null
    picture(string): "hello"
    tag_path: null

    ~< functions(Function):
      sig(string): null
      blurb(string): null
      body(string): null
      sig_json(string): null
      body_json(string): null
      tag_path(string): null
      ~< function_dependencies(FunctionDependency): null

    ~< posts(Post):
      body(string): null
      ~< replies(Post):
        as: reply_to_post

      ~< posted_objects(PostableObject):
        as: in_post

    ~< followed_objects(FollowableObject): null

    ~< tagged_objects(TagOfObject): null

    ~< topLevelTags(Tag):
      as: topLevelTagInUser

    ~< tags(Tag):
      name(string): null
      key(string): null
      blurb(string): null
      tag_path(string): null
      ~< tags_by_users(TagOfObject):
        -~ tagged_object(TaggedObject):
          as: user_tag
      ~< tagged_objects(TaggedObject):
        tag_count(integer): 0

- posted_object(PostableObject):
    -~ user(User): null
    -~ post(Post): null
    -~ function(Function): null
    -~ tag(Tag): null

- followed_object(FollowableObject):
    -~ user(User): null
    -~ function(Function): null
    -~ tag(Tag): null

- tagged_object(TaggedObject):
    -~ user(User): null
    -~ post(Post): null
    -~ function(Function): null
    -~ tag(Tag): null
*/
