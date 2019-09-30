import { model, ModelClass as Class, LinkageArity as Link, LinkageOwner as Owner } from "./nobo-model";

const App = model("App", {
    name: { clas: Class.string, default: "TriggerHappy demo" },
  }),
  User = model("User", {
    name: { clas: Class.string, default: "Unnamed user" },
    email: Class.string,
    bio: Class.string,
    picture: { clas: Class.string, default: "hello" },
    tagPath: Class.string,
    functions: {
      clas: "Function",
      linkage: Link.manyChildren,
      children: {
        sig: Class.string,
        blurb: Class.string,
        body: Class.string,
        sigJson: Class.string,
        bodyJson: Class.string,
        tagPath: Class.string,
        functionDependencies: { clas: "FunctionDependency", linkage: Link.manyChildren },
      },
    },
    posts: {
      clas: "Post",
      linkage: Link.manyChildren,
      children: {
        body: Class.string,
        replies: { clas: "Post", linkage: { arity: Link.manyChildren, as: "replyToPost" } },

        postedObjects: { clas: "PostableObject", linkage: { arity: Link.manyChildren, as: "inPost" } },
      },
    },
    followedObjects: { clas: "FollowableObject", linkage: Link.manyChildren },

    taggedObjects: { clas: "TagOfObject", linkage: Link.manyChildren },

    topLevelTags: { clas: "Tag", linkage: { arity: Link.manyChildren, as: "topLevelTagInUser" } },

    tags: {
      clas: "Tag",
      linkage: Link.manyChildren,
      children: {
        name: Class.string,
        key: Class.string,
        blurb: Class.string,
        tagPath: Class.string,
        tagsByUsers: {
          clas: "TagOfObject",
          linkage: Link.manyChildren,
          children: {
            taggedObject: { clas: "TaggedObject", linkage: { arity: Link.oneLink, as: "userTag" } },
          },
        },
        taggedObjects: {
          clas: "TaggedObject",
          linkage: Link.manyChildren,
          children: {
            tagCount: { clas: Class.integer, default: 0 },
          },
        },
      },
    },
    postedObject: {
      clas: "PostableObject",
      children: {
        user: { clas: "User", linkage: { arity: Link.oneLink, owner: Owner.child } },
        post: { clas: "Post", linkage: { arity: Link.oneLink, owner: Owner.child } },
        function: { clas: "Function", linkage: { arity: Link.oneLink, owner: Owner.child } },
        tag: { clas: "Tag", linkage: { arity: Link.oneLink, owner: Owner.child } },
      },
    },
    followedObject: {
      clas: "FollowableObject",
      children: {
        user: { clas: "User", linkage: { arity: Link.oneLink, owner: Owner.child } },
        function: { clas: "Function", linkage: { arity: Link.oneLink, owner: Owner.child } },
        tag: { clas: "Tag", linkage: { arity: Link.oneLink, owner: Owner.child } },
      },
    },
    taggedObject: {
      clas: "TaggedObject",
      children: {
        user: { clas: "User", linkage: { arity: Link.oneLink, owner: Owner.child } },
        post: { clas: "Post", linkage: { arity: Link.oneLink, owner: Owner.child } },
        function: { clas: "Function", linkage: { arity: Link.oneLink, owner: Owner.child } },
        tag: { clas: "Tag", linkage: { arity: Link.oneLink, owner: Owner.child } },
      },
    },
  });
export default { App, User };
