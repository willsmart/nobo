import { model, ModelClass as Class, LinkageArity as Link, LinkageOwner as Owner } from "./nobo-model";

const App = model("App", {
    name: { clas: Class.string, default: "TriggerHappy demo" },
  }),
  User = model("User", {
    name: { clas: Class.string, default: "Unnamed user" },
    email: { clas: Class.string },
    bio: { clas: Class.string },
    picture: { clas: Class.string, default: "hello" },
    tagPath: { clas: Class.string },
    functions: {
      clas: "Function",
      linkage: Link.manyChildren,
      children: {
        sig: { clas: Class.string },
        blurb: { clas: Class.string },
        body: { clas: Class.string },
        sigJson: { clas: Class.string },
        bodyJson: { clas: Class.string },
        tagPath: { clas: Class.string },
        functionDependencies: { clas: "FunctionDependency", linkage: Link.manyChildren },
      },
    },
    posts: {
      clas: "Post",
      linkage: Link.manyChildren,
      children: {
        body: { clas: Class.string },
        replies: { clas: "Post", linkage: { arity: Link.manyChildren, parentName: "replyToPost" } },

        postedObjects: { clas: "PostableObject", linkage: { arity: Link.manyChildren, parentName: "inPost" } },
      },
    },
    followedObjects: { clas: "FollowableObject", linkage: Link.manyChildren },

    taggedObjects: { clas: "TagOfObject", linkage: Link.manyChildren },

    topLevelTags: { clas: "Tag", linkage: { arity: Link.manyChildren, parentName: "topLevelTagInUser" } },

    tags: {
      clas: "Tag",
      linkage: Link.manyChildren,
      children: {
        name: { clas: Class.string },
        key: { clas: Class.string },
        blurb: { clas: Class.string },
        tagPath: { clas: Class.string },
        tagsByUsers: {
          clas: "TagOfObject",
          linkage: Link.manyChildren,
          children: {
            taggedObject: { clas: "TaggedObject", linkage: { arity: Link.oneLink, parentName: "userTag" } },
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
