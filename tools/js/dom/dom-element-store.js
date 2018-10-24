const PublicApi = require('../general/public-api');
const log = require('../general/log');
const domAttributeGetterSetter = require('./datapoint-getter-setters/dom-attribute');

// API is auto-generated at the bottom from the public interface of the ActiveElementStore class

class ActiveElement {
  static publicMethods() {
    return ['element', 'attributeNames'];
  }

  constructor() {
    const el = this;

    Object.assign(el, {
      _element: undefined,
      attributes: {},
    });

    cache.getterSetterInfo.finders.push(domAttributeGetterSetter({ elementsById }));
  }

  get element() {
    return this._element
  }

  get attributeNames() {
    return Object.keys(this.attributes)
  }

  setElement(element) {
    const el = this

    if (el._element) return;
    el._element = element;

    
  }
}


class ActiveElementStore {
  // public methods
  static publicMethods() {
    return ['elementWithId','generateElement'];
  }

  constructor() {
    const store = this,
      elementInfosById = {};

    Object.assign(store, {
      elementInfosById,
    });

    cache.getterSetterInfo.finders.push(domAttributeGetterSetter({ elementsById }));
  }

  elemementWithId(id) {
    const info = this.elementInfosById[id]
    return info ? info.element : undefined
  }

  addElement(id, element) {
    const store = this, info = store.elementInfosById[id]
    if (!info) {
      store.elementInfosById[id] = {element}
    } 
    else if (info.element) return;
    else {
      info.element = element;
      if (info.attributes)
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: ActiveElementStore,
  hasExposedBackDoor: true,
});
