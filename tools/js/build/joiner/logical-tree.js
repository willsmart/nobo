class LogicalTree {
  constructor({ joinedLocationTrees }) {
    const lt = this,
      callbackKey = "LogicalTree";
    Object.assign(lt, {
      joinedLocationTrees,
    });

    for (const jlt of joinedLocationTrees) {
      jlt.watch({
        callbackKey,
        oncreate: function(jli, promises, event) {
          lt.oncreate(jli, jlt, promises, event);
        },
        onmodify: function(jli, promises, event) {
          lt.onmodify(jli, jlt, promises, event);
        },
        ondelete: function(jli, promises, event) {
          lt.ondelete(jli, jlt, promises, event);
        },
      });
    }
  }

  oncreate({ location }, joinedLocationTree, promises, event) {
      for (const )
  }

  onmodify({ location },joinedLocationTree, promises, event) {}

  ondelete({ location },joinedLocationTree, promises, event) {}
}
