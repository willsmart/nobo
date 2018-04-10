// API
module.exports = PublicApi;

// simple function to wrap a class, exposing only the public interface to outsiders
function PublicApi({ fromClass, hasExposedBackDoor }) {
  const publicInstanceMethods = [],
    publicInstanceGetterMethods = [];

  fromClass.publicMethods().forEach(methodName => {
    if (fromClass.prototype.__lookupGetter__(methodName)) {
      let method = fromClass.prototype.__lookupGetter__(methodName);
      publicInstanceGetterMethods.push({ methodName, method });
    } else if (fromClass.prototype[methodName]) {
      let method = fromClass.prototype[methodName];
      publicInstanceMethods.push({ methodName, method });
    }
  });

  const PublicClass = function(arguments = {}) {
    const private = new fromClass(arguments);
    private.publicApi = this;

    if (hasExposedBackDoor) this.__private = private;
    else {
      publicInstanceGetterMethods.forEach(({ methodName, method }) => {
        this.__defineGetter__(methodName, function() {
          return method.apply(private, arguments);
        });
      });
      publicInstanceMethods.forEach(({ methodName, method }) => {
        this[methodName] = function() {
          return method.apply(private, arguments);
        };
      });
    }
  };

  fromClass.publicMethods().forEach(methodName => {
    if (fromClass.__lookupGetter__(methodName)) {
      let method = fromClass.__lookupGetter__(methodName);
      PublicClass.__defineGetter__(methodName, function() {
        return method.apply(fromClass, arguments);
      });
    } else if (fromClass[methodName]) {
      let method = fromClass[methodName];
      PublicClass[methodName] = function() {
        return method.apply(fromClass, arguments);
      };
    }

    publicInstanceGetterMethods.forEach(({ methodName, method }) => {
      PublicClass.prototype.__defineGetter__(methodName, function() {
        return method.apply(this.__private, arguments);
      });
    });
    publicInstanceMethods.forEach(({ methodName, method }) => {
      PublicClass.prototype[methodName] = function() {
        return method.apply(this.__private, arguments);
      };
    });
  });

  return PublicClass;
}
