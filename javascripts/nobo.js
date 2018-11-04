(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
module.exports = undefined;

},{}],2:[function(require,module,exports){
const PageState = require('./page-state'),
  WebSocketClient = require('../web-socket/web-socket-client'),
  WebSocketProtocol = require('../web-socket/web-socket-protocol-client'),
  DomFunctions = require('../dom/dom-functions'),
  { htmlToElement, describeTree } = require('../dom/dom-functions'),
  DatapointCache = require('../datapoints/cache/datapoint-cache'),
  installDomDatapointGetterSetters = require('../dom/datapoint-getter-setters/install'),
  Schema = require('../general/schema'),
  appClient = require('./app-client'),
  log = require('../general/log');
require('./page-util');
require('./datapoint-util');

const schema = new Schema();
schema.loadSource([
  {
    'modelChange(ModelChangeLog)': {
      'type(string)': null,
      'rowId(integer)': null,
      'field(string)': null,
      'at(datetime)': 'now',
      '~- notifyRequest(ModelChangeNotifyRequest)': {
        'at(datetime)': 'now',
        'name(string)': null,
      },
    },
  },
  {
    SchemaHistory: {
      'modelLayout(text)': null,
      'layoutToSchemaVersion(string)': null,
      'at(datetime)': 'now',
    },
  },
  {
    'app(App)': {
      'cookiePrefix(string)': {
        default: 'noboapp',
      },
      '~< users(User)': {
        'phoenixKey(string)': null,
      },
      '~< templates(Template)': {
        'classFilter(string)': null,
        'ownerOnly(boolean)': false,
        'variant(string)': null,
        'dom(text)': null,
        'filename(string)': null,
        '~< displayedFields(TemplateDisplayedField)': {
          as: 'template',
          'field(string)': null,
        },
        '~< subtemplates(Subtemplate)': {
          as: 'template',
          'domField(string)': null,
          'variant(string)': null,
          'modelView(string)': null,
        },
        '~< templateChildren(TemplateChild)': {
          as: 'template',
          'domField(string)': null,
          'modelField(string)': null,
          'variant(string)': null,
          'classFilter(string)': null,
          'ownerOnly(boolean)': false,
        },
      },
    },
  },
  {
    'app(App)': {
      'name(string)': {
        default: 'NoBo demo',
      },
      '~< users(User)': {
        'name(string)': {
          default: 'Unnamed user',
        },
        'appName(string)': {
          get: 'app.name',
        },
        'bio(string)': null,
        '~< posts(Post)': {
          as: 'user',
          'title(string)': null,
          'body(string)': null,
          '~< replies(Post)': {
            as: 'reply_to_post',
          },
        },
      },
    },
  },
  {
    User: {
      'breadcrumbTitle(string)': {
        get: "'<'+name+'>'",
      },
    },
  },
]);

const appDbRowId = 1,
  wsclient = new WebSocketClient(),
  cache = new DatapointCache({
    schema,
    htmlToElement,
    appDbRowId,
    isClient: true,
  }),
  wsprotocol = new WebSocketProtocol({ cache, ws: wsclient }),
  pageState = new PageState({
    cache,
  });

installDomDatapointGetterSetters({ cache, htmlToElement });

pageState.visit();

window.logDOM = element => {
  console.log(`tree:\n${describeTree(element || document.getElementById('page'), 't     ')}`);
};

window.nobo = {
  PageState,
  WebSocketClient,
  WebSocketProtocol,
  DomFunctions,
  DatapointCache,
  Schema,
  appDbRowId,
  schema,
  wsclient,
  cache,
  pageState,
  appClient,
  wsprotocol,
  log,
};

window.c = cache;
window.dp = id => cache.getOrCreateDatapoint(id);
window.dpv = async function(id) {
  return await dp(id).value;
};
window.setdpv = function(id, value) {
  dp(id).setValue(value);
};

dp('dom__id_page__tree').watch({});
setdpv('dom__id_page__context', 'state__page');
setpage = pageid => setdpv('state__page__items', [pageid]);

},{"../datapoints/cache/datapoint-cache":6,"../dom/datapoint-getter-setters/install":23,"../dom/dom-functions":24,"../general/log":30,"../general/schema":35,"../web-socket/web-socket-client":66,"../web-socket/web-socket-protocol-client":67,"./app-client":1,"./datapoint-util":3,"./page-state":4,"./page-util":5}],3:[function(require,module,exports){
const ConvertIds = require('../datapoints/convert-ids');

let nextLocalId = 1;
window.newdp = (typeName, fieldName) => {
  const datapointInfo = ConvertIds.recomposeId({ typeName, proxyKey: `l${nextLocalId++}`, fieldName });
  return datapointInfo.datapointId || datapointInfo.rowId;
};

},{"../datapoints/convert-ids":7}],4:[function(require,module,exports){
const PublicApi = require('../general/public-api');
const ConvertIds = require('../datapoints/convert-ids');

let globalPageState;

const callbackKey = 'page-state';

// API is auto-generated at the bottom from the public interface of this class

class PageState {
  // public methods
  static publicMethods() {
    return ['visit', 'global', 'currentWindowState'];
  }

  constructor({ cache, defaultPageDatapointInfo } = {}) {
    const pageState = this;

    globalPageState = pageState;

    pageState.defaultPageDatapointInfo =
      defaultPageDatapointInfo ||
      ConvertIds.recomposeId({
        typeName: 'app',
        dbRowId: 1,
        fieldName: '',
      });

    pageState.cache = cache;

    window.onpopstate = event => {
      const pageState = this;

      pageState.visit();
      pageState.itemsDatapoint.invalidate();
    };

    const itemsDatapoint = (pageState.itemsDatapoint = cache.getOrCreateDatapoint('page__default__items'));
    itemsDatapoint.watch({ callbackKey: 'page-state' });
    itemsDatapoint.value;
  }

  static get global() {
    return globalPageState;
  }

  static get currentWindowState() {
    const oldState = window.history.state;
    return oldState && typeof oldState == 'object' && oldState.nobo ? oldState : {};
  }

  static get datapointInfoFromPath() {
    const pathName = window.location.pathname,
      match = /^\/(\w+)(?:\/(?:(\d+)|(\w+))?(?:\/(\w*))?)?($|\/)/.exec(pathName);
    if (!match) return;
    return ConvertIds.recomposeId({
      typeName: match[1],
      dbRowId: match[2] ? +match[2] : undefined,
      proxyKey: match[2] || match[3] ? match[3] : 'default',
      fieldName: match[4] || '',
    });
  }

  visit(rowOrDatapointId) {
    const pageState = this;

    pageState.updateState(rowOrDatapointId);
  }

  updateState(rowOrDatapointId) {
    const pageState = this;

    let pageDatapointInfo = ConvertIds.datapointRegex.test(rowOrDatapointId)
      ? ConvertIds.recomposeId({
          datapointId: rowOrDatapointId,
          permissive: true,
        })
      : ConvertIds.recomposeId({
          rowId: rowOrDatapointId,
          fieldName: '',
          permissive: true,
        });
    if (!pageDatapointInfo) {
      pageDatapointInfo = PageState.datapointInfoFromPath;
      if (!pageDatapointInfo) {
        pageDatapointInfo = pageState.defaultPageDatapointInfo;
      }
    }
    const pageDatapointId = pageDatapointInfo.datapointId,
      titleDatapointId = ConvertIds.recomposeId(pageDatapointInfo, {
        fieldName: 'name',
      }).datapointId;

    const titleDatapoint = pageState.cache.getOrCreateDatapoint(titleDatapointId);
    if (titleDatapoint !== pageState.titleDatapoint) {
      if (pageState.titleDatapoint) pageState.titleDatapoint.stopWatching({ callbackKey });
      (pageState.titleDatapoint = titleDatapoint).watch({
        callbackKey,
        onchange: () => {
          pageState.updateState(PageState.currentWindowState.pageDatapointId);
        },
      });
    }

    const title = typeof titleDatapoint.valueIfAny == 'string' ? titleDatapoint.valueIfAny : undefined;

    const oldState = PageState.currentWindowState,
      newState = {
        nobo: true,
        pageDatapointId,
        titleDatapointId,
        title,
      };

    if (!oldState.nobo) {
      if (title) document.title = title;
      window.history.replaceState(newState, title, pageState.pathNameForState(newState));
      pageState.itemsDatapoint.invalidate();
    } else if (newState.pageDatapointId == oldState.pageDatapointId) {
      if (newState.title != oldState.title) {
        if (title) document.title = title;
        window.history.replaceState(newState, title, pageState.pathNameForState(newState));
      }
    } else {
      if (title) document.title = title;
      window.history.pushState(newState, title, pageState.pathNameForState(newState));
      pageState.itemsDatapoint.invalidate();
    }

    return newState;
  }

  pathNameForState(state) {
    const pageState = this,
      datapointInfo = ConvertIds.decomposeId({ datapointId: state.pageDatapointId, permissive: true });
    if (!datapointInfo) return;
    const regex = /(?=((?:[\!\$&'\(\)\*\+,;=a-zA-Z0-9\-._~:@\/?]|%[0-9a-fA-F]{2})*))\1./g,
      titleForFragment = !state.title ? undefined : state.title.substring(0, 100).replace(regex, '$1-');

    const dbRowIdOrProxyKey = datapointInfo.proxyKey == 'default' ? '' : datapointInfo.dbRowIdOrProxyKey;
    let ret = `/${datapointInfo.typeName}`;
    if (dbRowIdOrProxyKey || datapointInfo.fieldName || titleForFragment) {
      ret += `/${dbRowIdOrProxyKey || ''}`;
      if (datapointInfo.fieldName || titleForFragment) {
        ret += `/${datapointInfo.fieldName || ''}`;
        if (titleForFragment) {
          ret += `/${titleForFragment}`;
        }
      }
    }
    return ret;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: PageState,
  hasExposedBackDoor: true,
});

},{"../datapoints/convert-ids":7,"../general/public-api":34}],5:[function(require,module,exports){
window.forEachLocal = (el, cb) => {
  while (el && !el.hasAttribute('sourcetemplate')) el = el.parentElement;
  if (!el) return;
  go(el);
  function go(el) {
    cb(el);
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
      if (!child.hasAttribute('sourcetemplate')) go(child);
    }
  }
};

window.filterLocal = (el, select) => {
  while (el && !el.hasAttribute('sourcetemplate')) el = el.parentElement;
  if (!el) return;
  const ret = [];
  go(el);
  return ret;
  function go(el) {
    if (select(el)) ret.push(el);
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
      if (!child.hasAttribute('sourcetemplate')) go(child);
    }
  }
};

window.findLocal = (el, select) => {
  while (el && !el.hasAttribute('sourcetemplate')) {
    el = el.parentElement;
  }
  if (!el) return;
  return go(el);
  function go(el) {
    if (select(el)) return el;
    for (let child = el.firstElementChild; child; child = child.nextElementSibling) {
      if (!child.hasAttribute('sourcetemplate')) {
        const ret = go(child);
        if (ret) return ret;
      }
    }
  }
};

window.localElement = (el, name) => {
  return findLocal(el, el => el.getAttribute('localid') === name);
};

},{}],6:[function(require,module,exports){
const makeClassWatchable = require('../../general/watchable');
const Datapoint = require('../../datapoints/datapoint/datapoint');
const PublicApi = require('../../general/public-api');
const StateVar = require('../../general/state-var');
const RowChangeTrackers = require('../../datapoints/row-change-trackers');
const Templates = require('../../datapoints/templates');
const { finders, findGetterSetter } = require('../../datapoints/datapoint/getters-setters/all.js');

class DatapointCache {
  static publicMethods() {
    return [
      'templates',
      'schema',
      'isClient',
      'datapointDbConnection',
      'getExistingDatapoint',
      'getOrCreateDatapoint',
      'forgetDatapoint',
      'unforgetDatapoint',
      'datapoints',
      'uninitedDatapoints',

      'getterSetterInfo',

      'rowChangeTrackers',

      'watch',
      'stopWatching',
    ];
  }

  constructor({ schema, htmlToElement, datapointDbConnection, appDbRowId = 1, isClient = false }) {
    const cache = this;

    Object.assign(cache, {
      _datapointDbConnection: datapointDbConnection,
      _schema: schema,
      _getterSetterInfo: {
        finders,
        findGetterSetter,
      },
      datapointsById: {},
      deletionLists: [undefined],
      deletionListByDatapointId: {},
      deletionDelaySeconds: 300,
      _stateVar: new StateVar({ cache }),
      _rowChangeTrackers: new RowChangeTrackers({ cache, schema }),
      _isClient: isClient,
    });

    if (!isClient) {
      cache._templates = new Templates({ cache, htmlToElement, appDbRowId });
    }
  }

  get rowChangeTrackers() {
    return this._rowChangeTrackers;
  }

  get stateVar() {
    return this._stateVar;
  }

  get isClient() {
    return this._isClient;
  }

  get getterSetterInfo() {
    return this._getterSetterInfo;
  }

  get datapointDbConnection() {
    return this._datapointDbConnection;
  }

  get schema() {
    return this._schema;
  }

  get templates() {
    return this._templates;
  }

  get datapoints() {
    return Object.values(this.datapointsById);
  }

  get uninitedDatapoints() {
    const ret = {};
    for (const [datapointId, datapoint] of Object.entries(this.datapointsById)) {
      if (!datapoint.initialized) {
        ret[datapointId] = datapoint;
      }
    }
    return ret;
  }

  getExistingDatapoint(datapointId) {
    return this.datapointsById[datapointId];
  }

  getOrCreateDatapoint(datapointId) {
    const cache = this,
      { datapointsById } = cache,
      existingDatapoint = datapointsById[datapointId];
    if (existingDatapoint) return existingDatapoint;

    const { schema, datapointDbConnection, templates, stateVar, getterSetterInfo } = cache;
    const datapoint = (datapointsById[datapointId] = new Datapoint({
      cache,
      schema,
      datapointDbConnection,
      templates,
      stateVar,
      findGetterSetter: getterSetterInfo.findGetterSetter,
      datapointId,
    }));
    cache.notifyListeners('oncreate', datapoint);
    return datapoint;
  }

  forgetDatapoint(datapointId) {
    const cache = this,
      { deletionLists, deletionListByDatapointId } = cache;
    if (deletionListByDatapointId[datapointId]) return;
    const currentList = deletionLists[0] || (deletionLists[0] = {});
    currentList[datapointId] = true;
    deletionListByDatapointId[datapointId] = currentList;

    if (cache.deletionTickTimeout) return;
    cache.deletionTickTimeout = setTimeout(() => cache.deletionTick(), 1000);
  }

  unforgetDatapoint(datapointId) {
    const cache = this,
      { deletionListByDatapointId } = cache;
    if (!deletionListByDatapointId[datapointId]) return;
    delete deletionListByDatapointId[datapointId][datapointId];
    delete deletionListByDatapointId[datapointId];
  }

  deletionTick() {
    const cache = this,
      { deletionLists, deletionListByDatapointId, deletionDelaySeconds, datapointsById } = cache;
    deletionLists.unshift(undefined);

    const deletionList = deletionLists.length == deletionDelaySeconds && deletionLists.pop();
    if (deletionList) {
      for (const datapointId of Object.keys(deletionList)) {
        datapointsById[datapointId].ondeletion();
        delete deletionListByDatapointId[datapointId];
        delete datapointsById[datapointId];
      }
    }

    if (deletionLists.find(list => list)) {
      cache.deletionTickTimeout = setTimeout(() => cache.deletionTick(), 1000);
    } else cache.deletionTickTimeout = undefined;
  }
}

makeClassWatchable(DatapointCache);

// API is the public facing class
module.exports = PublicApi({
  fromClass: DatapointCache,
  hasExposedBackDoor: true, // note that the __private backdoor is used by this class, leave this as true
});

},{"../../datapoints/datapoint/datapoint":8,"../../datapoints/datapoint/getters-setters/all.js":10,"../../datapoints/row-change-trackers":16,"../../datapoints/templates":17,"../../general/public-api":34,"../../general/state-var":36,"../../general/watchable":39}],7:[function(require,module,exports){
// convert_ids
// © Will Smart 2018. Licence: MIT

// This module allows string ids to be converted to and from the various data pointer types used by nobo
// The types include:
//
//  rowId : a pointer to a particular row in a db table.
//          Made up of a snake_case table name and the id value for the row joined by double underscores
//          eg. user__1
//
//  datapointId : a pointer to a particular field value in a db table.
//          Made up of a rowId and a snake_case field name, joined by double underscores
//          eg. user__1__name
//          Note that link values are also seen as datapoints.
//          So user__1__posts could well be an array of rowId's for posts
//
// PROXIES
//  proxyRowId : a proxy pointer to a particular row in a db table as understood by a particular client.
//          Made up of a snake_case table name and a snake_case proxy key joined by double underscores
//          eg. user__me
//          In the case of user__me, the proxy key 'me' could be mapped to the current user's id
//          If logged out, user__me could be made to redirect to some other row, like app__default
//
//  proxyDatapointId : a proxy pointer to a particular field value in a db table.
//          Made up of a proxyRowId and a snake_case field name, joined by double underscores
//          eg. user__me__name
//
// GENERAL
//  proxyableRowId : all rowId's and proxyRowId's are proxyableRowId's
//  proxyableDatapointId : all datapointId's and proxyDatapointId's are proxyableDatapointId's
//          This allows code to deal with both cases generally if need be
//

const typeNameRegex = /^([a-z0-9]+(?:_[a-z0-9]+)*)$/,
  dbRowIdRegex = /^([1-9][0-9]*)$/,
  fieldNameRegex = /^(\*|[a-z0-9]+(?:_[a-z0-9]+)*|)$/,
  // at some levels the system uses 'proxy' and 'proxyable' row ids
  // eg, when retrieving a model like 'user__me' the 'me' is a proxy row id
  proxyKeyRegex = /^([a-z][a-z0-9]*(?:_[a-z0-9]+)*)$/,
  // Pointer to a particular expression of a proxy to a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  proxyableRowIdRegex = new RegExp(
    `^(?:${dbRowIdRegex.source.substring(1, dbRowIdRegex.source.length - 1)}|${proxyKeyRegex.source.substring(
      1,
      proxyKeyRegex.source.length - 1
    )})$`
  ),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  //      [4]: field name in snake_case
  proxyDatapointRegex = new RegExp(
    `^${typeNameRegex.source.substring(1, typeNameRegex.source.length - 1)}__${proxyKeyRegex.source.substring(
      1,
      proxyKeyRegex.source.length - 1
    )}__~?${fieldNameRegex.source.substring(1, fieldNameRegex.source.length - 1)}$`
  ),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  //      [4]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  rowRegex = new RegExp(
    `^${typeNameRegex.source.substring(1, typeNameRegex.source.length - 1)}__${proxyableRowIdRegex.source.substring(
      1,
      proxyableRowIdRegex.source.length - 1
    )}$`
  ),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  //      [4]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  //      [5]: field name in snake_case
  basicDatapointRegex = new RegExp(
    `^(${typeNameRegex.source.substring(1, typeNameRegex.source.length - 1)}__${proxyableRowIdRegex.source.substring(
      1,
      proxyableRowIdRegex.source.length - 1
    )})__~?${fieldNameRegex.source.substring(1, fieldNameRegex.source.length - 1)}$`
  ),
  // Pointer to a particular expression of a row in the db
  //   captures:
  //      [1]: the row string
  //      [2]: typename in snake_case
  //      [3]: row id as an integer string
  //      [4]: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  //      [5]: field name in snake_case
  //      [6]: embedded datapoint id
  //      [7]: embedded datapoint: the row string
  //      [8]: embedded datapoint: typename in snake_case
  //      [9]: embedded datapoint: row id as an integer string
  //      [10]: embedded datapoint: or proxy row id as a snake_case word (eg for proxy row strings like "user__me")
  //      [11]: embedded datapoint: field name in snake_case
  datapointRegex = new RegExp(
    `^${basicDatapointRegex.source.substring(
      1,
      basicDatapointRegex.source.length - 1
    )}(?:\\[(${basicDatapointRegex.source.substring(1, basicDatapointRegex.source.length - 1)})\\])?$`
  );

// API
module.exports = {
  // deconstructs a string id into its component parts or throws if not possible
  // arguments object with one key of:
  //   rowId, datapointId
  decomposeId,

  // similar, but will return the supplied argument unchanged if it already has typeName defined
  ensureDecomposed,

  // reconstructs string ids from their component parts or throws if not possible
  recomposeId,

  // export the regexes as part of the public API
  typeNameRegex,
  dbRowIdRegex,
  fieldNameRegex,
  rowRegex,
  datapointRegex,
  proxyKeyRegex,
  proxyableRowIdRegex,
  proxyDatapointRegex,
};

const ChangeCase = require('change-case');

// deconstructs a string id into its component parts or throws if not possible
//  arguments object with one key of:
//    rowId, datapointId
function decomposeId({ rowId, datapointId, relaxed, permissive }) {
  if (datapointId) {
    const ret = stringToDatapoint(datapointId, permissive) || stringToDatapoint(datapointId, permissive);
    if (ret) return ret;
  }
  if (rowId) {
    const ret = stringToRow(rowId, permissive) || stringToRow(rowId, permissive);
    if (ret) return ret;
  }
  if (permissive) return;
  throw new Error('No id to decompose');
}

function ensureDecomposed({ typeName }) {
  return typeName === undefined ? decomposeId(arguments[0]) : arguments[0];
}

// reconstructs string ids from their component parts or throws if not possible
// you can provide more than one argument, in which case they are combined with the last taking precidence
function recomposeId({ typeName, dbRowId, proxyKey, fieldName, rowId, datapointId, embeddedDatapointId, permissive }) {
  if (arguments.length != 1) {
    const combined = {};
    Array.prototype.forEach.call(arguments, argument => processArg(argument, combined));
    return recomposeId(combined);
  } else {
    ({ typeName, dbRowId, proxyKey, fieldName, rowId, datapointId, embeddedDatapointId, permissive } = processArg(
      arguments[0]
    ));
  }

  function processArg(arg, into) {
    into = into || {};
    if (arg.rowId) {
      const args = decomposeId({ rowId: arg.rowId, permissive: true });
      if (args) {
        into.typeName = args.typeName;
        into.dbRowId = args.dbRowId;
        into.proxyKey = args.proxyKey;
      }
    }

    if (arg.datapointId) {
      const args = decomposeId({ datapointId: arg.datapointId, permissive: true });
      if (args) {
        into.typeName = args.typeName;
        into.dbRowId = args.dbRowId;
        into.proxyKey = args.proxyKey;
        into.fieldName = args.fieldName;
        into.embeddedDatapointId = args.embeddedDatapointId;
      }
    }

    Object.assign(into, arg);
    return into;
  }

  if (!typeName) {
    if (permissive) return;
    throw new Error("Can't recompose without typeName");
  }

  const ret = {
    typeName: ChangeCase.snakeCase(typeName),
  };
  if (!typeNameRegex.test(ret.typeName)) throw new Error('Type name has invalid characters or format');

  if (embeddedDatapointId !== undefined && !basicDatapointRegex.test(embeddedDatapointId))
    throw new Error('Embedded datapoint id has invalid format');

  if (dbRowId) {
    if (!dbRowIdRegex.test(dbRowId)) {
      throw new Error('Db row id has invalid characters or format');
    }
    ret.dbRowId = +dbRowId;
    ret.rowId = `${ret.typeName}__${ret.dbRowId}`;

    if (fieldName !== undefined) {
      ret.fieldName = fieldName == '*' ? '*' : ChangeCase.snakeCase(fieldName);
      if (!fieldNameRegex.test(ret.fieldName)) throw new Error('Field name has invalid characters or format');

      ret.datapointId = `${ret.rowId}__${ret.fieldName}`;

      if (embeddedDatapointId) ret.datapointId += `[${embeddedDatapointId}]`;
    }
  } else if (proxyKey) {
    ret.proxyKey = proxyKey;
    if (!proxyKeyRegex.test(ret.proxyKey)) throw new Error('Proxy key has invalid characters or format');
    ret.rowId = `${ret.typeName}__${ret.proxyKey}`;

    if (fieldName !== undefined) {
      ret.fieldName = fieldName == '*' ? '*' : ChangeCase.snakeCase(fieldName);
      if (!fieldNameRegex.test(ret.fieldName)) throw new Error('Field name has invalid characters or format');

      ret.datapointId = `${ret.rowId}__${ret.fieldName}`;

      if (embeddedDatapointId) ret.datapointId += `[${embeddedDatapointId}]`;
    }
  } else {
    if (permissive) return;
    throw new Error('Must have either a dbRowId or a proxyKey');
  }

  ret.typeName = ChangeCase.pascalCase(ret.typeName);
  if (ret.fieldName !== undefined && ret.fieldName != '*') ret.fieldName = ChangeCase.camelCase(ret.fieldName);

  return ret;
}

// Helper methods for applying the regexes

function stringToRow(rowId, permissive) {
  const match = rowRegex.exec(rowId);
  if (!match) {
    if (permissive) return;
    throw new Error(`Bad row id ${rowId}`);
  }

  return Object.assign(
    {
      rowId,
      typeName: ChangeCase.pascalCase(match[1]),
    },
    match[2]
      ? {
          dbRowIdOrProxyKey: match[2],
          dbRowId: +match[2],
        }
      : {
          dbRowIdOrProxyKey: match[3],
          proxyKey: match[3],
        }
  );
}

function stringToDatapoint(datapointId, permissive) {
  const match = datapointRegex.exec(datapointId);
  if (!match) {
    if (permissive) return;
    throw new Error(`Bad datapoint id ${datapointId}`);
  }

  return Object.assign(
    {
      datapointId,
      rowId: match[1],
      typeName: ChangeCase.pascalCase(match[2]),
      fieldName: match[5] == '*' ? '*' : ChangeCase.camelCase(match[5]),
      embeddedDatapointId: match[6],
    },
    match[3]
      ? {
          dbRowIdOrProxyKey: match[3],
          dbRowId: +match[3],
        }
      : {
          dbRowIdOrProxyKey: match[4],
          proxyKey: match[4],
        }
  );
}

},{"change-case":42}],8:[function(require,module,exports){
const { decomposeId } = require('../../datapoints/convert-ids');
const makeClassWatchable = require('../../general/watchable');
const isEqual = require('../../general/is-equal');
const addDependencyMethods = require('./dependency-methods');
const PublicApi = require('../../general/public-api');
const log = require('../../general/log');

class DatapointProxy {}
class Datapoint {
  static publicMethods() {
    return [
      'typeName',
      'type',
      'field',
      'dbRowId',
      'fieldName',
      'proxyKey',
      'rowId',
      'datapointId',
      'embeddedDatapointId',

      'isId',
      'isMultiple',

      'invalidate',
      'validate',
      'validateIfWatched',
      'valueIfAny',
      'value',
      'setValue',

      'initialized',
      'valid',

      'deleteIfUnwatched',
      'undeleteIfWatched',

      'watch',
      'stopWatching',
      'ondeletion',

      'ondeletion',
      'deletionCallbacks',
    ];
  }

  constructor({ cache, schema, datapointDbConnection, templates, stateVar, findGetterSetter, datapointId }) {
    const datapoint = this,
      datapointInfo = decomposeId({ datapointId }),
      isAnyFieldPlaceholder = datapointInfo.fieldName == '*';

    datapointInfo.type = schema.allTypes[datapointInfo.typeName];
    if (datapointInfo.type) {
      datapointInfo.field = datapointInfo.type.fields[datapointInfo.fieldName];
    }

    Object.assign(datapoint, {
      cache,
      datapointInfo,
      _isId: datapointInfo.field ? datapointInfo.field.isId : false,
      _isMultiple: datapointInfo.field ? datapointInfo.field.isMultiple : false,
      state: 'uninitialized',
      cachedValue: isAnyFieldPlaceholder ? true : undefined,
      autovalidates: false,
      autoinvalidates: false,
      autovalidatesForListener: false,
    });

    log('dp', () => `DP>C> Created datapoint ${datapointId}`);

    const { getter, setter } = findGetterSetter({
      datapoint,
      cache,
      schema,
      datapointDbConnection,
      templates,
      stateVar,
    });
    if (getter) {
      datapoint.getter = getter;
    }
    if (setter) {
      datapoint.setter = setter;
    }

    if (datapoint._isId && datapoint._isMultiple) {
      datapoint.cachedValue = [];
    }

    datapoint.deleteIfUnwatched();

    datapoint.validateIfWatched();
  }

  get typeName() {
    return this.datapointInfo.typeName;
  }
  get type() {
    return this.datapointInfo.type;
  }
  get field() {
    return this.datapointInfo.field;
  }
  get dbRowId() {
    return this.datapointInfo.dbRowId;
  }
  get proxyKey() {
    return this.datapointInfo.proxyKey;
  }
  get fieldName() {
    return this.datapointInfo.fieldName;
  }
  get rowId() {
    return this.datapointInfo.rowId;
  }
  get datapointId() {
    return this.datapointInfo.datapointId;
  }
  get embeddedDatapointId() {
    return this.datapointInfo.embeddedDatapointId;
  }

  get isId() {
    return this._isId;
  }
  get isMultiple() {
    return this._isMultiple;
  }

  get valid() {
    return this.state == 'valid';
  }

  get initialized() {
    return this.state != 'uninitialized';
  }

  // marks the datapoint as having a possibly incorrect cachedValue
  // i.e. the value that would be obtained from the getter may be different to the cachedValue
  invalidate() {
    const datapoint = this;
    switch (datapoint.state) {
      case 'valid':
        datapoint._setState('invalid');
        break;
      case 'invalid':
      case 'uninitialized':
        datapoint.rerunGetter = true;
    }
    datapoint.validateIfWatched();
  }

  validateIfWatched() {
    const datapoint = this,
      { getterOneShotResolvers, autovalidates, autovalidatesForListener } = datapoint;
    if ((getterOneShotResolvers && getterOneShotResolvers.length) || autovalidates || autovalidatesForListener) {
      datapoint.validate();
    }
  }

  // refresh the cachedValue using the getter
  validate({ refreshViaGetter, eventContext } = {}) {
    const datapoint = this;
    switch (datapoint.state) {
      case 'invalid':
      case 'uninitialized':
        datapoint._value(eventContext);
        break;
      case 'valid':
        if (refreshViaGetter) {
          datapoint._valueFromGetter(eventContext);
        }
    }
  }

  _setState(state) {
    const datapoint = this,
      { state: stateWas, cache } = datapoint;
    if (stateWas == state) return;
    datapoint.state = state;
    log('dp', () => `DP>S> Datapoint ${datapoint.datapointId} is now ${state} (was ${stateWas})`);
    switch (state) {
      case 'valid':
        datapoint.notifyListeners('onvalid', datapoint);
        cache.notifyListeners('onvalid', datapoint);
        datapoint.notifyDependentsOfMoveToValidState();
        break;
      case 'invalid':
        datapoint.notifyDependentsOfMoveToInvalidState();
        break;
    }
  }
  // sets the cached value to a trusted value, as would be obtained by the getter
  _setCachedValue(value) {
    const datapoint = this,
      { valueIfAny, state, cache } = datapoint;

    if (datapoint.isId) {
      // TODO id regex
      if (datapoint.isMultiple) {
        if (!Array.isArray(value)) value = [];
      }
    }

    datapoint.cachedValue = value;

    log('dp', () => `DP>V> Datapoint ${datapoint.datapointId} -> ${JSON.stringify(value)}`);

    datapoint._setState('valid');

    if (!isEqual(valueIfAny, value, { exact: true })) {
      datapoint.notifyDependentsOfChangeOfValue();
      datapoint.notifyListeners('onchange', datapoint);
      cache.notifyListeners('onchange', datapoint);
    }

    if (state == 'uninitialized') {
      datapoint.notifyListeners('oninit', datapoint);
      cache.notifyListeners('oninit', datapoint);
    }
  }

  // return the cached value
  get valueIfAny() {
    return this.cachedValue;
  }

  // async method that returns the cached value if valid, otherwise get the correct value via the getter
  get value() {
    return this._value();
  }
  _value(eventContext) {
    const datapoint = this;
    switch (datapoint.state) {
      case 'valid':
        return Promise.resolve(datapoint.valueIfAny);
      case 'invalid':
      case 'uninitialized':
        return datapoint._valueFromGetter(eventContext);
    }
  }

  // gets the _actual_ value of the datapoints via the getter method
  _valueFromGetter(eventContext) {
    const datapoint = this,
      { getter, getterOneShotResolvers, cache, rowId } = datapoint,
      { rowChangeTrackers } = cache;

    if (getterOneShotResolvers) {
      return new Promise(resolve => {
        getterOneShotResolvers.push(resolve);
        datapoint.undeleteIfWatched();
      });
    }

    if (!getter || typeof getter != 'object' || !getter.fn) {
      // TODO codesnippet
      // if the datapoint has no getter method, then the cached value is correct by default
      log('err.dp', `DP>!> Datapoint ${datapoint.datapointId} has no associated getter`);
      datapoint._setCachedValue(datapoint.valueIfAny);

      if (datapoint.autoinvalidates) datapoint.invalidate();

      return Promise.resolve(datapoint.valueIfAny);
    }

    return new Promise(resolve => {
      const getterOneShotResolvers = (datapoint.getterOneShotResolvers = [resolve]);
      datapoint.undeleteIfWatched();

      runGetter();

      function runGetter() {
        datapoint.rerunGetter = false;
        rowChangeTrackers
          .executeAfterValidatingDatapoints({ thisArg: rowId, fn: getter.fn, eventContext })
          .then(({ result, usesDatapoints, referencesDatapoints }) => {
            datapoint.setDependenciesOfType('getter', usesDatapoints);
            datapoint.setDependenciesOfType('~getter', referencesDatapoints);
            if (datapoint.rerunGetter) return runGetter();

            if (result && typeof result == 'object' && result.then) {
              Promise.resolve(result).then(dealWithValue);
            } else dealWithValue(result);
            function dealWithValue(value) {
              datapoint._setCachedValue(value);

              datapoint.getterOneShotResolvers = undefined;
              datapoint.deleteIfUnwatched();
              for (const resolve of getterOneShotResolvers) {
                resolve(value);
              }

              if (datapoint.autoinvalidates) datapoint.invalidate();
            }
          });
      }
    });
  }

  // sets the value by invoking the setter method if any
  setValue(newValue) {
    const datapoint = this,
      { setter, valueIfAny, cache, rowId, valid } = datapoint,
      { rowChangeTrackers } = cache,
      changed = !valid || !isEqual(valueIfAny, newValue, { exact: true });

    if (!changed) return;

    if (!setter || typeof setter != 'object' || !setter.fn) {
      // if the datapoint has no setter method, then just set the cached value directly
      datapoint._setCachedValue(newValue);

      if (datapoint.autoinvalidates) datapoint.invalidate();
    } else {
      // to set the value if there is a setter method, the datapoint is marked as invalid,
      // then the setter method is invoked, then as it returns (either sync or async)
      // the datapoint is revalidated using the value returned from the setter
      // This value should be the same as would be obtained from the getter.
      datapoint.invalidate();

      rowChangeTrackers
        .executeAfterValidatingDatapoints({ thisArg: rowId, fn: setter.fn }, newValue)
        .then(({ result, usesDatapoints, referencesDatapoints, commit }) => {
          datapoint.setDependenciesOfType('setter', usesDatapoints);
          datapoint.setDependenciesOfType('~setter', referencesDatapoints);

          if (commit) commit();

          Promise.resolve(result).then(value => {
            datapoint._setCachedValue(value);
          });

          if (datapoint.autoinvalidates) datapoint.invalidate();
        });
    }
  }

  lastListenerRemoved() {
    this.deleteIfUnwatched();
  }

  listenersChanged() {
    const datapoint = this,
      { listeners } = datapoint;
    datapoint.autovalidatesForListener = Boolean(
      listeners && listeners.find(listener => listener.onvalid || listener.onchange)
    );
  }

  firstListenerAdded() {
    this.undeleteIfWatched();
    this.validate();
  }

  undeleteIfWatched() {
    const datapoint = this,
      { cache, listeners, getterOneShotResolvers, dependentCount } = datapoint;
    if (
      !dependentCount &&
      !(listeners && listeners.length) &&
      !(getterOneShotResolvers && getterOneShotResolvers.length)
    )
      return;

    cache.unforgetDatapoint(datapoint.datapointId);
  }

  deleteIfUnwatched() {
    const datapoint = this,
      { cache, listeners, getterOneShotResolvers, dependentCount } = datapoint;
    if (dependentCount || (listeners && listeners.length) || (getterOneShotResolvers && getterOneShotResolvers.length))
      return;

    cache.forgetDatapoint(datapoint.datapointId);
  }

  get deletionCallbacks() {
    return this._deletionCallbacks || (this._deletionCallbacks = []);
  }

  ondeletion() {
    const datapoint = this,
      { _deletionCallbacks } = datapoint;

    log('dp', `DP>F> Forgetting datapoint ${datapoint.datapointId}`);

    if (_deletionCallbacks) {
      for (const callback of _deletionCallbacks) {
        callback(datapoint);
      }
      datapoint._deletionCallbacks = undefined;
    }
    datapoint.clearDependencies();
  }
}

addDependencyMethods(Datapoint);

makeClassWatchable(Datapoint);

// API is the public facing class
module.exports = PublicApi({
  fromClass: Datapoint,
  hasExposedBackDoor: true, // note that the __private backdoor is used by this class, leave this as true
});

},{"../../datapoints/convert-ids":7,"../../general/is-equal":28,"../../general/log":30,"../../general/public-api":34,"../../general/watchable":39,"./dependency-methods":9}],9:[function(require,module,exports){
const log = require('../../general/log');

module.exports = addDependencyMethods;

function addDependencyMethods(theClass) {
  Object.assign(theClass.prototype, {
    clearDependencies() {
      const datapoint = this,
        { dependenciesByType } = datapoint;
      if (!dependenciesByType) return;
      for (const type of Object.keys(dependenciesByType)) {
        this.setDependenciesOfType(type, {});
      }
    },

    dependenciesOfType(type) {
      const datapoint = this;
      const dependenciesByType = datapoint.dependenciesByType || (datapoint.dependenciesByType = {});
      return dependenciesByType[type] || (dependenciesByType[type] = {});
    },

    dependentsOfType(type) {
      const datapoint = this;
      const dependentsByType = datapoint.dependentsByType || (datapoint.dependentsByType = {});
      return dependentsByType[type] || (dependentsByType[type] = {});
    },

    setDependenciesOfType(type, newDependencies) {
      const datapoint = this,
        { cache } = datapoint,
        dependencies = datapoint.dependenciesOfType(type);

      let changed;
      for (const dependencyDatapointId of Object.keys(dependencies)) {
        if (!(newDependencies && newDependencies[dependencyDatapointId])) {
          const dependencyDatapoint = cache.getExistingDatapoint(dependencyDatapointId);
          if (dependencyDatapoint) {
            datapoint._removeDependency(dependencyDatapoint.__private, type);
          }
          changed = true;
        }
      }
      if (newDependencies) {
        for (const dependencyDatapointId of Object.keys(newDependencies)) {
          if (!dependencies[dependencyDatapointId]) {
            const dependencyDatapoint = cache.getOrCreateDatapoint(dependencyDatapointId).__private;
            datapoint._addDependency(dependencyDatapoint, type);
            changed = true;
          }
        }
      }
      if (changed) {
        datapoint.dependenciesByType[type] = newDependencies ? Object.assign({}, newDependencies) : {};
      }
    },

    _addDependency(dependencyDatapoint, type) {
      const dependentDatapoint = this,
        isNotifying = !type.startsWith('~'),
        { datapointId: dependencyDatapointId, valid: dependencyValid } = dependencyDatapoint,
        { datapointId: dependentDatapointId } = dependentDatapoint,
        dependencyDependents = dependencyDatapoint.dependents || (dependencyDatapoint.dependents = {}),
        dependentDependencies = dependentDatapoint.dependencies || (dependentDatapoint.dependencies = {}),
        dependencyDependentInfo =
          dependencyDependents[dependentDatapointId] || (dependencyDependents[dependentDatapointId] = {}),
        dependentDependencyInfo =
          dependentDependencies[dependencyDatapointId] || (dependentDependencies[dependencyDatapointId] = {});

      if (!Object.keys(dependencyDependentInfo).length) {
        dependentDatapoint.dependencyCount = (dependentDatapoint.dependencyCount || 0) + 1;
        if (!dependencyDatapoint.dependentCount) {
          dependencyDatapoint.dependentCount = 1;
          dependencyDatapoint.undeleteIfWatched();
        } else {
          dependencyDatapoint.dependentCount++;
        }

        if (!dependencyValid) {
          if (!dependentDatapoint.invalidDependencyCount) {
            dependentDatapoint.invalidDependencyCount = 1;
            dependentDatapoint.invalidate();
          } else dependentDatapoint.invalidDependencyCount++;
        }
      }

      dependentDependencyInfo[type] = dependencyDependentInfo[type] = type;

      if (isNotifying) {
        dependencyDependentInfo.__notify = true;
      }
    },

    _removeDependency(dependencyDatapoint, type) {
      const dependentDatapoint = this,
        isNotifying = !type.startsWith('~'),
        { datapointId: dependencyDatapointId, valid: dependencyValid } = dependencyDatapoint,
        { datapointId: dependentDatapointId } = dependentDatapoint,
        dependencyDependents = dependencyDatapoint.dependents || (dependencyDatapoint.dependents = {}),
        dependentDependencies = dependentDatapoint.dependencies || (dependentDatapoint.dependencies = {}),
        dependencyDependentInfo = dependencyDependents[dependentDatapointId],
        dependentDependencyInfo = dependentDependencies[dependencyDatapointId];

      if (!(dependencyDependentInfo && dependencyDependentInfo[type])) {
        log(
          'err.dp',
          `Expected to find a that ${dependentDatapointId}[${type}] was dependent on ${dependencyDatapointId}[${type}]. The system will by in an unstable state from here on out`
        );
        return;
      }

      delete dependencyDependentInfo[type];
      delete dependentDependencyInfo[type];

      if (isNotifying && !Object.keys(dependencyDependentInfo).find(type => !type.startsWith('~'))) {
        delete dependencyDependentInfo.__notify;
      }

      if (Object.keys(dependencyDependentInfo).length) return;

      delete dependencyDependents[dependentDatapointId];
      delete dependentDependencies[dependencyDatapointId];

      dependentDatapoint.dependencyCount--;
      if (!--dependencyDatapoint.dependentCount) {
        dependencyDatapoint.deleteIfUnwatched();
      }

      if (!dependencyValid && !--dependentDatapoint.invalidDependencyCount) {
        dependentDatapoint.validate();
      }
    },

    notifyDependentsOfMoveToInvalidState: function() {
      const datapoint = this,
        { dependents, cache } = datapoint;

      if (!dependents) return;
      for (const [dependentDatapointId, { __notify }] of Object.entries(dependents)) {
        if (!__notify) continue;
        const dependentDatapoint = cache.getOrCreateDatapoint(dependentDatapointId).__private;

        if (!dependentDatapoint.invalidDependencyCount) {
          dependentDatapoint.invalidDependencyCount = 1;
          dependentDatapoint.invalidate();
        } else dependentDatapoint.invalidDependencyCount++;
      }
    },
    notifyDependentsOfMoveToValidState: function() {
      const datapoint = this,
        { dependents, cache } = datapoint;

      if (!dependents) return;
      for (const [dependentDatapointId, { __notify }] of Object.entries(dependents)) {
        if (!__notify) continue;
        const dependentDatapoint = cache.getOrCreateDatapoint(dependentDatapointId).__private;

        if (!--dependentDatapoint.invalidDependencyCount && !dependentDatapoint.autoinvalidates) {
          dependentDatapoint.validateIfWatched();
        }
      }
    },
    notifyDependentsOfChangeOfValue: function() {
      const datapoint = this,
        { dependents, cache } = datapoint;

      if (!dependents) return;
      for (const [dependentDatapointId, { __notify }] of Object.entries(dependents)) {
        if (!__notify) continue;
        const dependentDatapoint = cache.getOrCreateDatapoint(dependentDatapointId).__private;

        dependentDatapoint.invalidate();
      }
    },
  });
}

},{"../../general/log":30}],10:[function(require,module,exports){
const finders = [
  require('./page-state'),
  require('./state'),
  require('./schema-code'),
  require('./db'),
  require('./template'),
];

module.exports = {
  finders,
  findGetterSetter: function({ datapoint, cache, schema, datapointDbConnection, stateVar, templates }) {
    const ret = {};
    for (const one of finders) {
      const oneRet = one(arguments[0]);
      if (oneRet) {
        if (!ret.getter) ret.getter = oneRet.getter;
        if (!ret.setter) ret.setter = oneRet.setter;
        if (ret.getter && ret.setter) break;
      }
    }
    return ret;
  },
};

},{"./db":11,"./page-state":12,"./schema-code":13,"./state":14,"./template":15}],11:[function(require,module,exports){
module.exports = function({ datapoint, schema, datapointDbConnection }) {
  if (!datapointDbConnection) return;

  const { typeName, dbRowId, fieldName } = datapoint,
    type = schema.allTypes[typeName];

  if (!type) return;

  const field = type.fields[fieldName];
  if (!field || !dbRowId) return;

  const ret = {};
  if (!field.get) {
    ret.getter = {
      fn: () =>
        new Promise(resolve => {
          datapointDbConnection.queueGet({ field, dbRowId, resolve });
        }),
    };
  }
  if (!field.set) {
    ret.setter = {
      fn: newValue =>
        new Promise(resolve => {
          datapointDbConnection.queueSet({ field, dbRowId, newValue, resolve });
        }),
    };
  }
  return ret;
};

},{}],12:[function(require,module,exports){
const PageState = require('../../../client/page-state');

module.exports = function({ datapoint, cache }) {
  const { fieldName, proxyKey, typeName } = datapoint;

  if (!cache.isClient || typeName !== 'Page' || proxyKey !== 'default') return;

  datapoint._isClient = true;
  if (fieldName == 'items') {
    return {
      getter: {
        fn: () => {
          const state = PageState.currentWindowState;
          return state && state.pageDatapointId ? [state.pageDatapointId] : [];
        },
      },
      setter: {
        fn: items => {
          if (Array.isArray(items)) {
            PageState.global.visit(items.length && typeof items[0] == 'string' ? items[0] : undefined);
          }
          return items;
        },
      },
    };
  }
};

},{"../../../client/page-state":4}],13:[function(require,module,exports){
module.exports = function({ datapoint, schema }) {
  const { typeName, fieldName } = datapoint,
    type = schema.allTypes[typeName];

  if (!type) return;

  const field = type.fields[fieldName];
  if (!field || !(field.get || field.set)) return;

  const ret = {};
  if (field.get) {
    ret.getter = { codeSnippet: field.get };
  }
  if (field.set) {
    ret.setter = { codeSnippet: field.set };
  }
  return ret;
};

},{}],14:[function(require,module,exports){
const g_state = {};

module.exports = function({ datapoint }) {
  const { fieldName, typeName, proxyKey = 'default' } = datapoint;

  if (typeName !== 'State') return;

  datapoint._isClient = true;
  const state = g_state[proxyKey] || (g_state[proxyKey] = {}),
    datapointState = (state[fieldName] = {
      value: undefined,
    });
  datapoint.deletionCallbacks.push(() => {
    delete state[fieldName];
  });
  return {
    getter: {
      fn: () => datapointState.value,
    },
    setter: {
      fn: newValue => (datapointState.value = newValue),
    },
  };
};

},{}],15:[function(require,module,exports){
const ChangeCase = require('change-case');

module.exports = function({ datapoint, templates }) {
  const { fieldName, typeName, datapointId } = datapoint;

  if (!templates) return;

  let match = /^dom((?:[A-Z]\w*)?)$/.exec(fieldName);
  if (match) {
    const variant = ChangeCase.camelCase(match[1]),
      templateRefDatapointId = templates.getTemplateReferencingDatapoint({
        variant,
        classFilter: typeName,
        ownerOnly: false,
      }).datapointId;

    return {
      getter: {
        fn: ({ getDatapointValue }) => {
          const templateRow = getDatapointValue(templateRefDatapointId);
          return templateRow ? templateRow.dom : undefined;
        },
      },
      setter: {
        fn: (newValue, { getDatapointValue }) => {
          const templateRow = getDatapointValue(templateRefDatapointId);
          return templateRow ? (templateRow.dom = newValue) : undefined;
        },
      },
    };
  }

  match = /^template((?:[A-Z]\w*)?)$/.exec(fieldName);
  if (match) {
    const variant = ChangeCase.camelCase(match[1]),
      templateRefDatapointId = templates.getTemplateReferencingDatapoint({
        variant,
        classFilter: typeName,
        ownerOnly: false,
      }).datapointId;

    datapoint._isId = true;

    return {
      getter: {
        fn: ({ getDatapointValue }) => {
          return getDatapointValue(templateRefDatapointId);
        }, // TODO make this an id
      },
      setter: {
        fn: (_newValue, { getDatapointValue }) => getDatapointValue(templateRefDatapointId),
      },
    };
  }

  if (typeName == 'App' && fieldName.startsWith('useTemplate')) {
    datapoint._isId = true;

    return {
      getter: {
        fn: () => {
          const rowId = templates.referencedTemplateRowIdForTemplateDatapointId(datapointId);
          return rowId ? [rowId] : [];
        },
      },
    };
  }
};

},{"change-case":42}],16:[function(require,module,exports){
// row-change-trackers
// © Will Smart 2018. Licence: MIT

const PublicApi = require('../general/public-api');
const ConvertIds = require('./convert-ids');
const changeDetectorObject = require('../general/change-detector-object');
const mapValues = require('../general/map-values');
const log = require('../general/log');

class RowChangeTrackers {
  // public methods
  static publicMethods() {
    return ['rowObject', 'commit', 'execute', 'executeAfterValidatingDatapoints'];
  }

  constructor({ cache, schema, readOnly = true }) {
    const rowChangeTrackers = this;
    Object.assign(rowChangeTrackers, {
      cache,
      schema,
      readOnly,
      _executor: undefined,
      rowProxies: {},
      rowCDOs: {},
    });
  }

  async executeAfterValidatingDatapoints({ thisArg, fn, eventContext }, ...args) {
    const rowChangeTrackers = this;
    while (true) {
      const ret = await rowChangeTrackers.execute({ thisArg, fn, eventContext }, ...args);
      if (!ret.retryAfterPromises.length) return ret;
      await Promise.all(ret.retryAfterPromises);
    }
  }

  async execute({ thisArg, fn, eventContext }, ...args) {
    const rowChangeTrackers = this,
      executor = {
        rowChangeTrackers,
        retryAfterPromises: [],
        usesDatapoints: {},
        referencesDatapoints: {},
      };

    const optionsArg = {
      getRowObject: rowChangeTrackers.rowObject.bind(rowChangeTrackers),
      getDatapointValue: rowChangeTrackers.getDatapointValue.bind(rowChangeTrackers),
      referenceDatapoint: rowChangeTrackers.referenceDatapoint.bind(rowChangeTrackers),
      setDatapointValue: rowChangeTrackers.setDatapointValue.bind(rowChangeTrackers),
      willRetry: () => executor.retryAfterPromises.length > 0,
      eventContext,
    };

    const useThisArg =
      typeof thisArg == 'string' && ConvertIds.rowRegex.test(thisArg) ? rowChangeTrackers.rowObject(thisArg) : thisArg;

    try {
      const executorWas = rowChangeTrackers._executor;
      rowChangeTrackers._executor = executor;
      const result = fn.apply(useThisArg, args.concat([optionsArg]));
      rowChangeTrackers.commit();
      rowChangeTrackers._executor = executorWas;
      executor.result = RowChangeTrackers.sanitizeCDOs(await result);
    } catch (error) {
      if (error.message == 'Cannot mutate in non-mutating CDO') {
        // TODO type check instead
        const { cache, schema } = rowChangeTrackers,
          mutatingRowChangeTrackers = new RowChangeTrackers({ cache, schema, readOnly: false });
        return mutatingRowChangeTrackers.execute({ thisArg, fn, eventContext }, ...args);
      }
      log('err.eval', `While executing code: ${error.message}`);
      executor.error = error;
    }

    executor.modified = rowChangeTrackers.modifiedRowIds.length > 0;
    if (executor.modified) {
      executor.commit = rowChangeTrackers.commit.bind(rowChangeTrackers);
      executor.queueCommitJob = rowChangeTrackers.queueCommitJob.bind(rowChangeTrackers);
    }
    return executor;
  }

  get executor() {
    return this._executor;
  }

  rowObject(rowId) {
    const rowChangeTrackers = this,
      { rowCDOs, readOnly } = rowChangeTrackers;
    if (rowCDOs[rowId]) return rowCDOs[rowId].useObject;
    return (rowCDOs[rowId] = changeDetectorObject(rowChangeTrackers.rowProxy(rowId), readOnly)).useObject;
  }

  rowProxy(rowId) {
    const rowChangeTrackers = this,
      { rowProxies } = rowChangeTrackers;
    return (
      rowProxies[rowId] ||
      (rowProxies[rowId] = new Proxy(
        {},
        {
          getOwnPropertyDescriptor: (_obj, prop) => {
            const o = { v: rowChangeTrackers.getDatapointValue(rowId, prop) };
            return Object.getOwnPropertyDescriptor(o, 'v');
          },
          has: (_obj, key) => {
            return rowChangeTrackers.getDatapointValue(rowId, key) !== undefined;
          },
          get: (_obj, key) => {
            return rowChangeTrackers.getDatapointValue(rowId, key);
          },
          ownKeys: () => {
            return rowChangeTrackers.getRowFieldNames(rowId);
          },
        }
      ))
    );
  }

  queueCommitJob({ delay = 10 } = {}) {
    const rowChangeTrackers = this;

    if (delay <= 0) {
      rowChangeTrackers.commit();
      return;
    }

    if (rowChangeTrackers._commitTimeout) return;
    rowChangeTrackers._commitTimeout = setTimeout(() => {
      delete rowChangeTrackers._commitTimeout;
      rowChangeTrackers.commit();
    }, delay);
  }

  get modifiedRowIds() {
    const rowChangeTrackers = this,
      ret = [];
    for (const [rowId, cdo] of Object.entries(rowChangeTrackers.rowCDOs)) {
      if (cdo.modified[0]) {
        ret.push(rowId);
      }
    }
    return ret;
  }

  commit() {
    const rowChangeTrackers = this;

    if (rowChangeTrackers._commitTimeout) {
      clearTimeout(rowChangeTrackers._commitTimeout);
      delete rowChangeTrackers._commitTimeout;
    }

    while (Object.keys(rowChangeTrackers.rowCDOs).length) {
      const rowCDOs = Object.assign({}, rowChangeTrackers.rowCDOs);

      Object.assign(rowChangeTrackers, { rowCDOs: {}, rowProxies: {} });

      for (const [rowId, cdo] of Object.entries(rowCDOs)) {
        const { deletionsObject, changeObject, modified } = cdo;
        if (!modified[0]) continue;
        if (deletionsObject) {
          for (const fieldName of Object.keys(deletionsObject)) {
            rowChangeTrackers.setDatapointValue(rowId, fieldName, undefined);
          }
        }
        if (changeObject) {
          for (const [fieldName, value] of Object.entries(changeObject)) {
            rowChangeTrackers.setDatapointValue(rowId, fieldName, value);
          }
        }
      }
    }
  }

  static sanitizeCDOs(value) {
    if (changeDetectorObject.isCDO(value)) {
      return value.id;
    }
    if (Array.isArray(value)) {
      return value.map(item => RowChangeTrackers.sanitizeCDOs(item));
    }
    if (value && typeof value == 'object' && value.constructor === Object) {
      return mapValues(value, item => RowChangeTrackers.sanitizeCDOs(item));
    }
    return value;
  }

  setDatapointValue(rowId, fieldName, value) {
    let embeddedDatapointId;
    if (ConvertIds.datapointRegex.test(rowId)) {
      value = fieldName;
      ({ rowId, fieldName, embeddedDatapointId } = ConvertIds.decomposeId({ datapointId: rowId }));
    }

    if (fieldName == 'id') return;

    const rowChangeTrackers = this,
      { cache } = rowChangeTrackers,
      { typeName } = ConvertIds.decomposeId({ rowId }),
      datapointId = ConvertIds.recomposeId({ rowId, fieldName }).datapointId,
      datapoint = cache.getOrCreateDatapoint(datapointId);

    if (datapoint.isId) {
      if (typeof value == 'string' && ConvertIds.rowRegex.test(value)) {
        value = [value];
      } else if (Array.isArray(value)) {
        value = value
          .map(item => {
            if (typeof item == 'string' && ConvertIds.rowRegex.test(item)) {
              return item;
            }
            if (item && typeof item == 'object') item = item.id;
            if (typeof item == 'string' && ConvertIds.rowRegex.test(item)) {
              return item;
            }
          })
          .filter(item => item);
        if (!datapoint.isMultiple && value.length > 1) value = [];
      } else value = undefined;
    }

    if (datapoint) datapoint.setValue(value);
  }

  referenceDatapoint(rowId, fieldName, embeddedDatapointId) {
    if (ConvertIds.datapointRegex.test(rowId)) {
      ({ rowId, fieldName, embeddedDatapointId } = ConvertIds.decomposeId({ datapointId: rowId }));
    }

    if (fieldName == 'id') return;

    const rowChangeTrackers = this,
      { executor } = rowChangeTrackers,
      datapointId = ConvertIds.recomposeId({ rowId, fieldName, embeddedDatapointId }).datapointId;

    if (executor) {
      executor.referencesDatapoints[datapointId] = true;
    }
  }

  getDatapointValue(rowId, fieldName, embeddedDatapointId, options) {
    if (ConvertIds.datapointRegex.test(rowId)) {
      if (fieldName !== undefined) options = fieldName;
      ({ rowId, fieldName, embeddedDatapointId } = ConvertIds.decomposeId({ datapointId: rowId }));
    }

    let convertIdsToCDOs = !(options && !options.convertIdsToCDOs);

    if (fieldName == 'id') return rowId;

    const rowChangeTrackers = this,
      { cache, executor } = rowChangeTrackers,
      datapointId = ConvertIds.recomposeId({ rowId, fieldName, embeddedDatapointId }).datapointId,
      datapoint = cache.getOrCreateDatapoint(datapointId);

    if (executor) {
      executor.usesDatapoints[datapointId] = true;
    }

    let value = datapoint && datapoint.valueIfAny;
    if (!datapoint.valid) {
      const promise = datapoint.value;
      if (executor) executor.retryAfterPromises.push(promise);
    }
    if (datapoint.isId && convertIdsToCDOs) {
      if (typeof value == 'string' && ConvertIds.rowRegex.test(value)) {
        value = [rowChangeTrackers.rowObject(value)];
      } else if (Array.isArray(value) && (datapoint.isMultiple || value.length <= 1)) {
        value = value
          .map(item => {
            if (typeof item == 'string' && ConvertIds.rowRegex.test(item)) {
              return rowChangeTrackers.rowObject(item);
            }
          })
          .filter(item => item);
      } else value = undefined;
    }
    return value;
  }

  getRowFieldNames(rowId) {
    const rowChangeTrackers = this,
      { schema } = rowChangeTrackers,
      typeName = ConvertIds.decomposeId({ rowId }).typeName,
      type = schema.allTypes[typeName],
      fieldNames = Object.keys(type.fields);
    fieldNames.push('id');
    return fieldNames;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: RowChangeTrackers,
  hasExposedBackDoor: true,
});

},{"../general/change-detector-object":25,"../general/log":30,"../general/map-values":31,"../general/public-api":34,"./convert-ids":7}],17:[function(require,module,exports){
const ConvertIds = require('./convert-ids');
const PublicApi = require('../general/public-api');
const mapValues = require('../general/map-values');
const ChangeCase = require('change-case');

// other implied dependencies

//const DatapointCache = require('./cache/datapoint-cache'); // via constructor arg: cache
//    uses getOrCreateDatapoint

//const Datapoint = require('./datapoint'); // via cache.getOrCreateDatapoint
//    uses watch, stopWatching, valueIfAny, invalidate, valid

// API is auto-generated at the bottom from the public interface of this class

class Templates {
  // public methods
  static publicMethods() {
    return ['load', 'getTemplateReferencingDatapoint', 'template', 'referencedTemplateRowIdForTemplateDatapointId'];
  }

  constructor({ cache, htmlToElement, appDbRowId = 1 }) {
    const templates = this;

    templates.cache = cache;
    templates.appDbRowId = appDbRowId;
    templates.templatesByRowId = {};
    templates.templatesByVariantClassOwnership = {};
    templates.bubbledTemplatesByVariantClassOwnership = {};
    templates.htmlToElement = htmlToElement;

    setTimeout(() => {
      this.callbackKey = cache.getOrCreateDatapoint(this.appTemplatesDatapointId).watch({
        onchange: datapoint => {
          if (Array.isArray(datapoint.valueIfAny)) {
            templates.setTemplateRowIds({
              rowIds: datapoint.valueIfAny,
            });
          }
        },
      });
    }, 0);
  }

  template({ rowId }) {
    return this.templatesByRowId[rowId];
  }

  get appTemplatesDatapointId() {
    return ConvertIds.recomposeId({
      typeName: 'App',
      dbRowId: this.appDbRowId,
      fieldName: 'templates',
    }).datapointId;
  }

  appTemplateDatapointId({ variant, classFilter, ownerOnly }) {
    return ConvertIds.recomposeId({
      typeName: 'App',
      dbRowId: this.appDbRowId,
      fieldName: `useTemplate${
        variant && variant != 'default' ? `_v${ChangeCase.snakeCase(variant).replace('_', '_v')}` : ''
      }${classFilter ? `_c${ChangeCase.snakeCase(classFilter).replace('_', '_c')}` : ''}${ownerOnly ? '_private' : ''}`,
    }).datapointId;
  }

  cvoForTemplateDatapointId(datapointId) {
    const { typeName, dbRowId, fieldName } = ConvertIds.decomposeId({ datapointId });
    if (typeName !== 'App' || dbRowId !== this.appDbRowId) return;
    const match = /^use_template((?:_v[A-Za-z0-9]+)*)((?:_c[A-Za-z0-9]+)*)(_private|)$/.exec(
      ChangeCase.snakeCase(fieldName)
    );
    if (!match) return;
    const variant = match[1] ? ChangeCase.camelCase(match[1].substring(2).replace('_v', '_')) : undefined,
      classFilter = match[2] ? ChangeCase.pascalCase(match[2].substring(2).replace('_c', '_')) : undefined;
    return {
      variant,
      classFilter,
      ownerOnly: Boolean(match[3]),
    };
  }

  referencedTemplateRowIdForTemplateDatapointId(datapointId) {
    const cvo = this.cvoForTemplateDatapointId(datapointId);
    if (!cvo) return;
    const node = this.treeNode(cvo);
    return node && node.template ? node.template.rowId : undefined;
  }

  setTemplateRowIds({ rowIds }) {
    const templates = this;

    const missing = mapValues(templates.templatesByRowId, () => true);
    for (const rowId of rowIds) {
      if (templates.templatesByRowId[rowId]) {
        delete missing[rowId];
        continue;
      }
      templates.templatesByRowId[rowId] = new Template({
        templates,
        rowId,
      });
    }

    for (const rowId of Object.keys(missing)) {
      templates.templatesByRowId[rowId].delete();
      delete templates.templatesByRowId[rowId];
    }
  }

  getTemplateReferencingDatapoint({ variant, classFilter, ownerOnly }) {
    if (variant == 'default') variant = undefined;
    return this.treeNode({
      canCreate: true,
      variant,
      classFilter,
      ownerOnly,
    }).datapoint;
  }

  removeFromTemplatesTree({ variant, classFilter, ownerOnly }) {
    this.addToTemplatesTree({
      variant,
      classFilter,
      ownerOnly,
    });
  }

  addToTemplatesTree({ template, variant, classFilter, ownerOnly }) {
    const templates = this,
      node = templates.treeNode({
        canCreate: true,
        variant,
        classFilter,
        ownerOnly,
      }),
      templateWas = node.template;
    if (templateWas === template) return;

    for (const child of node.subtree) {
      if (child.template === templateWas) {
        if (template) {
          child.template = template;
          child.datapoint.invalidate();
        } else {
          const useParent = child.parents.find(parent => parent.template),
            useTemplate = useParent ? useParent.template : undefined;

          if (child.template !== useTemplate) {
            child.template = useTemplate;
            child.datapoint.invalidate();
          }
        }
      }
    }
  }

  treeNode({ canCreate = false, variant, classFilter, ownerOnly }) {
    const templates = this;

    function newTreeNode({ variant, classFilter, ownerOnly, parents }) {
      const node = {
        variant,
        classFilter,
        ownerOnly,
        parents,
      };
      node.subtree = [node];
      for (const parent of parents) parent.subtree.push(node);

      const useParent = parents.find(parent => parent.template);
      node.template = useParent ? useParent.template : undefined;

      node.datapoint = templates.cache.getOrCreateDatapoint(
        templates.appTemplateDatapointId({
          variant,
          classFilter,
          ownerOnly,
        })
      );
      node.callbackKey = node.datapoint.watch({});
      return node;
    }

    let tree = templates.tree;
    if (!tree) {
      if (!canCreate) return;
      tree = templates.tree = newTreeNode({
        parents: [],
      });
    }
    if (ownerOnly) {
      if (!tree.private) {
        if (canCreate) {
          tree.private = newTreeNode({
            ownerOnly,
            parents: [tree],
          });
        } else return;
      }
      tree = tree.private;
    }

    function withClassFilter({ node, classFilter }) {
      if (!classFilter) return node;
      if (node.classFilters && node.classFilters[classFilter]) return node.classFilters[classFilter];
      if (!canCreate) return;

      const parents = node.parents.slice();
      parents.unshift(node);
      for (const parent of node.parents) {
        parents.unshift(
          withClassFilter({
            node: parent,
            classFilter,
          })
        );
      }

      if (!node.classFilters) node.classFilters = {};
      return (node.classFilters[classFilter] = newTreeNode({
        classFilter,
        variant: node.variant,
        ownerOnly: node.ownerOnly,
        parents,
      }));
    }

    function withVariant({ node, variant }) {
      if (!variant) return node;
      if (node.variants && node.variants[variant]) return node.variants[variant];
      if (!canCreate) return;

      const parents = [];
      if (variant != 'missingvariant') {
        for (const parent of node.parents) {
          parents.unshift(
            withVariant({
              node: parent,
              variant: 'missingvariant',
            })
          );
        }
      }
      for (const parent of node.parents) {
        parents.unshift(
          withVariant({
            node: parent,
            variant,
          })
        );
      }

      if (!node.variants) node.variants = {};
      return (node.variants[variant] = newTreeNode({
        classFilter: node.classFilter,
        variant,
        ownerOnly: node.ownerOnly,
        parents,
      }));
    }

    return withVariant({
      variant,
      node: withClassFilter({
        classFilter,
        node: tree,
      }),
    });
  }
}

class Template {
  // TODO publicapi
  constructor({ templates, rowId }) {
    const template = this,
      cache = templates.cache;

    template.templates = templates;
    template.datapoints = {};
    const callbackKey = (template.callbackKey = `${templates.callbackKey}:${rowId}`);

    Object.assign(
      template,
      ConvertIds.decomposeId({
        rowId,
      })
    );

    for (const fieldName of ['classFilter', 'ownerOnly', 'variant']) {
      const datapoint = (template.datapoints[fieldName] = cache.getOrCreateDatapoint(
        ConvertIds.recomposeId(template, {
          fieldName,
        }).datapointId
      ));
      datapoint.watch({
        callbackKey,
        onvalid: () => {
          template.refreshInTemplatesTree();
        },
        oninvalid: () => {
          template.refreshInTemplatesTree();
        },
      });
    }

    const datapoint = cache.getOrCreateDatapoint(
      ConvertIds.recomposeId({
        rowId,
        fieldName: 'dom',
      }).datapointId
    );
    datapoint.watch({
      callbackKey,
      onchange: datapoint => {
        template.updateDom(datapoint.valueIfAny);
      },
    });

    template.updateDom(datapoint.valueIfAny);

    template.refreshInTemplatesTree();
  }

  updateDom(domString) {
    const template = this,
      { templates } = template,
      { htmlToElement } = templates;

    if (!(domString && typeof domString == 'string')) domString = '<div></div>';

    if (template.domString == domString) return;
    template.domString = domString;

    const element = htmlToElement(domString);

    const displayedFields = {},
      children = {},
      embedded = [];

    addElement(element);

    function addElement(element) {
      const childrenDatapointId = element.getAttribute('nobo-children-dpid'),
        valueDatapointIdsString = element.getAttribute('nobo-val-dpids'),
        valueDatapointIds = valueDatapointIdsString ? valueDatapointIdsString.split(' ') : undefined;

      if (childrenDatapointId) {
        const datapointInfo = ConvertIds.decomposeId({ datapointId: childrenDatapointId });
        children[datapointInfo.fieldName] = children[datapointInfo.fieldName] || {};
        children[datapointInfo.fieldName][element.getAttribute('variant') || 'default'] = true;
      }
      if (
        element.classList.contains('model-child') &&
        (element.getAttribute('model') || element.hasAttribute('variant'))
      ) {
        const rowId = element.getAttribute('model'),
          variant = element.getAttribute('variant');
        if (!embedded.find(val => val.rowId === rowId && val.variant === variant)) {
          embedded.push({ rowId, variant });
        }
      }
      if (valueDatapointIds) {
        for (const datapointId of valueDatapointIds) {
          const datapointInfo = ConvertIds.decomposeId({ datapointId: datapointId });
          displayedFields[datapointInfo.fieldName] = true;
        }
      }
      for (const child of element.childNodes) {
        if (child.nodeType == 1) addElement(child);
      }
    }

    template.displayedFields = Object.keys(displayedFields);
    template.embedded = embedded;
    template.children = Object.keys(children).map(fieldName => ({
      fieldName,
      variants: Object.keys(children[fieldName]),
    }));
  }

  refreshInTemplatesTree() {
    const template = this,
      templates = template.templates;

    const vcoWas = template._variantClassFilterOwnership,
      vco = template.variantClassFilterOwnership;
    if (vco) vco.template = template;

    if (vco) {
      if (vcoWas) {
        if (
          vco.variant == vcoWas.variant &&
          vco.classFilter == vcoWas.classFilter &&
          vco.ownerOnly == vcoWas.ownerOnly
        ) {
          return;
        }
        templates.removeFromTemplatesTree(vcoWas);
      }
      templates.addToTemplatesTree(vco);
      template._variantClassFilterOwnership = vco;
    } else {
      if (vcoWas) templates.removeFromTemplatesTree(vcoWas);
      delete template._variantClassFilterOwnership;
    }
  }

  get variantClassFilterOwnership() {
    return this.valuesOfDatapoints({
      fieldNames: ['variant', 'classFilter', 'ownerOnly'],
      allOrNothing: true,
    });
  }

  valuesOfDatapoints({ fieldNames, allOrNothing = false }) {
    const template = this;
    const ret = {};
    let hasInvalid = false;
    for (const fieldName of fieldNames) {
      const datapoint = template.datapoints[fieldName];

      if (!datapoint || !datapoint.valid) hasInvalid = true;
      else ret[fieldName] = datapoint.valueIfAny;
    }
    if (hasInvalid) {
      if (allOrNothing) return;
    }

    return ret;
  }

  delete() {
    const template = this,
      templates = template.templates,
      callbackKey = template.callbackKey;

    for (const datapoint of Object.values(template.datapoints)) {
      datapoint.stopWatching({
        callbackKey,
      });
    }
    template.datapoints = {};
    templates.removeFromTemplatesTree(template._variantClassFilterOwnership);
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: Templates,
  hasExposedBackDoor: true,
});

},{"../general/map-values":31,"../general/public-api":34,"./convert-ids":7,"change-case":42}],18:[function(require,module,exports){
const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const CodeSnippet = require('../../general/code-snippet');
const { decomposeDatapointProxyKey } = require('../dom-functions');

const fieldNamePrefix = 'attribute-',
  templateSuffix = '-template';

module.exports = function({ datapoint }) {
  const { fieldName, typeName, rowId, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey) {
    return;
  }

  const { baseProxyKey } = decomposeDatapointProxyKey(proxyKey);

  const paramCaseFieldName = ChangeCase.paramCase(fieldName);
  if (!paramCaseFieldName.startsWith(fieldNamePrefix)) return;

  const valueAttributeName = paramCaseFieldName.substring(fieldNamePrefix.length),
    templateAttributeName = valueAttributeName + templateSuffix,
    match = /^textnode(\d+)$/.exec(valueAttributeName),
    textNodeIndex = match ? Number(match[1]) : undefined,
    isEvent = /^on[a-z]/.test(valueAttributeName);

  if (isEvent) datapoint.autoinvalidates = true;
  else datapoint.autovalidates = true;

  if (valueAttributeName.endsWith(templateSuffix)) {
    return;
  }

  let datapointState = { template: '', compiledGetter: undefined, eventCount: 0 };

  getValue = (element, valueAttributeName, textNodeIndex) => {
    if (textNodeIndex !== undefined) {
      let value = '';
      for (
        let child = element.firstChild, thisTextNodeIndex = -1, inTextNode = false;
        child;
        child = child.nextSibling
      ) {
        if (child.nodeType != 3) {
          if (inTextNode) {
            if (thisTextNodeIndex == textNodeIndex) break;
            inTextNode = false;
          }
          continue;
        }
        if (!inTextNode) {
          thisTextNodeIndex++;
          inTextNode = true;
        }
        if (thisTextNodeIndex == textNodeIndex) {
          value += child.textContent;
        }
      }
      return value;
    }
    return element.getAttribute(valueAttributeName) || '';
  };

  setValue = (element, valueAttributeName, textNodeIndex, value) => {
    if (textNodeIndex !== undefined) {
      for (
        let child = element.firstChild,
          nextChild = child ? child.nextSibling : undefined,
          thisTextNodeIndex = -1,
          inTextNode = false;
        child;
        child = nextChild, nextChild = child ? child.nextSibling : undefined
      ) {
        if (child.nodeType != 3) {
          if (inTextNode) {
            if (thisTextNodeIndex == textNodeIndex) break;
            inTextNode = false;
          }
          continue;
        }
        if (!inTextNode) {
          thisTextNodeIndex++;
          inTextNode = true;
          child.textContent = value;
        } else if (thisTextNodeIndex == textNodeIndex) {
          child.parentNode.removeChild(child);
        }
      }
    } else if (typeof value == 'function') {
      element.removeAttribute(valueAttributeName);
      element[ChangeCase.camelCase(valueAttributeName)] = value;
    } else {
      element.setAttribute(valueAttributeName, String(value));
    }
  };

  evaluate = ({ getDatapointValue, getRowObject, willRetry, eventContext }) => {
    const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId),
      { rowId: sourceRowId } =
        getDatapointValue(
          ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'context' }).datapointId
        ) || {},
      newState = { template: '', compiledGetter: undefined, eventCount: datapointState.eventCount + 1 };

    if (willRetry()) return;

    let value = '',
      needsSet = true;
    do {
      if (!element) break;

      if (!element.hasAttribute(templateAttributeName)) {
        value = getValue(element, valueAttributeName, textNodeIndex);
        needsSet = false;
        break;
      }

      newState.template = element.getAttribute(templateAttributeName);

      newState.compiledGetter =
        newState.template == datapointState.template
          ? datapointState.compiledGetter
          : new CodeSnippet({
              code: newState.template,
            });

      value = newState.compiledGetter
        ? isEvent
          ? String(
              newState.compiledGetter.evaluate({
                getDatapointValue,
                getRowObject,
                event: eventContext,
                rowId: sourceRowId,
              })
            )
          : String(
              newState.compiledGetter.safeEvaluate({
                getDatapointValue,
                getRowObject,
                rowId: sourceRowId,
              }).result
            )
        : '';
    } while (false);

    if (!willRetry()) {
      if (element && needsSet && !isEvent) setValue(element, valueAttributeName, textNodeIndex, value);
      datapointState = newState;
    }

    return isEvent ? datapointState.eventCount : value;
  };

  return {
    getter: {
      fn: evaluate,
    },
    setter: {
      fn: (_newValue, { getDatapointValue, getRowObject }) => evaluate({ getDatapointValue, getRowObject }),
    },
  };
};

},{"../../datapoints/convert-ids":7,"../../general/code-snippet":26,"../dom-functions":24,"change-case":42}],19:[function(require,module,exports){
const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const diffAny = require('../../general/diff');
const {
  childRangesForElement,
  insertChildRange,
  deleteChildRange,
  decomposeDatapointProxyKey,
} = require('../dom-functions');

let _nextElementId = 2;
function nextElementId() {
  return `seq${_nextElementId++}`;
}

module.exports = function({ datapoint }) {
  const { fieldName: childrenFieldName, typeName, rowId, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey || childrenFieldName != 'children') {
    return;
  }

  const { baseProxyKey } = decomposeDatapointProxyKey(proxyKey);

  let datapointState = { childTrees: [] };
  const childrenWorkingArray = [];

  evaluate = ({ getDatapointValue, setDatapointValue, willRetry }) => {
    const regex = /^([a-z0-9-]+)-model-child$/;
    classNames = (getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'attribute_class' }).datapointId) || '')
      .split(/ /g)
      .filter(v => regex.test(v))
      .sort();
    if (willRetry()) return;
    if (!classNames.length) return [];

    const fieldName = ChangeCase.camelCase(regex.exec(classNames[0])[1]);

    const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId),
      newState = { childTrees: undefined },
      { rowId: sourceRowId } =
        getDatapointValue(
          ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'context' }).datapointId
        ) || {};

    if (willRetry()) return;

    do {
      if (!element) {
        childrenWorkingArray = [];
        break;
      }

      let childIds = sourceRowId
        ? getDatapointValue(ConvertIds.recomposeId({ rowId: sourceRowId, fieldName }).datapointId, {
            convertIdsToCDOs: false,
          })
        : [];

      if (!Array.isArray(childIds)) childIds = [];
      childIds = childIds.filter(
        rowId => typeof rowId == 'string' && (ConvertIds.rowRegex.test(rowId) || ConvertIds.datapointRegex.test(rowId))
      );

      const diff = diffAny(childrenWorkingArray, childIds, (a, b) => a.id == b);

      const childVariantTemplate = element.getAttribute('child-variant-template'),
        childVariant = childVariantTemplate ? undefined : element.getAttribute('child-variant');

      if (willRetry()) return;

      if (diff && diff.arrayDiff) {
        for (let { insertAt, deleteAt, at, value: id } of diff.arrayDiff) {
          if (at !== undefined) {
            insertAt = at;
            deleteAt = at;
          }
          if (deleteAt !== undefined) {
            childrenWorkingArray.splice(deleteAt, 1);
          }
          if (insertAt !== undefined) {
            const childProxyKey = nextElementId(),
              contextDatapointId = ConvertIds.recomposeId({
                typeName: 'Dom',
                proxyKey: childProxyKey,
                fieldName: 'context',
              }).datapointId,
              contextDatapointInfo = ConvertIds.rowRegex.test(id)
                ? { rowId: id }
                : ConvertIds.decomposeId({ datapointId: id });

            setDatapointValue(contextDatapointId, {
              rowId: contextDatapointInfo.rowId,
              variant: contextDatapointInfo.fieldName || childVariant,
              variantTemplate: contextDatapointInfo.fieldName ? undefined : childVariantTemplate,
            });

            childrenWorkingArray.splice(insertAt, 0, {
              id,
              elementId: childProxyKey,
            });
          }
        }
      }
    } while (false);

    for (const child of childrenWorkingArray) {
      child.tree = getDatapointValue(
        ConvertIds.recomposeId({
          typeName: 'Dom',
          proxyKey: child.elementId,
          fieldName: 'tree',
        }).datapointId
      );
    }

    newState.childTrees = childrenWorkingArray.map(child => child.tree);

    if (!willRetry()) {
      datapointState = newState;
      const childRanges = childRangesForElement(element);
      const diff = diffAny(childRanges, datapointState.childTrees, (a, b) => a[0] === b[0]);

      if (diff && diff.arrayDiff) {
        for (let { insertAt, deleteAt, at, value: newChildRange } of diff.arrayDiff) {
          if (at !== undefined) {
            insertAt = at;
            deleteAt = at;
          }
          if (deleteAt !== undefined) {
            deleteChildRange(childRanges.splice(deleteAt, 1)[0]);
          }
          if (insertAt !== undefined) {
            newChildRange[0].setAttribute('nobo-parent-uid', proxyKey);
            insertChildRange({
              parent: element,
              after: insertAt ? childRanges[insertAt - 1][1] : element,
              childRange: newChildRange,
            });
            childRanges.splice(insertAt, 0, newChildRange);
          }
        }
      }
    }

    return datapointState.childTrees;
  };

  datapoint.autovalidates = true;
  return {
    getter: {
      fn: evaluate,
    },
    setter: {
      fn: (_newValue, { getDatapointValue, getRowObject }) => evaluate({ getDatapointValue, getRowObject }),
    },
  };
};

},{"../../datapoints/convert-ids":7,"../../general/diff":27,"../dom-functions":24,"change-case":42}],20:[function(require,module,exports){
const ConvertIds = require('../../datapoints/convert-ids');
const CodeSnippet = require('../../general/code-snippet');

module.exports = function({ datapoint }) {
  const { fieldName, typeName, proxyKey } = datapoint;

  if (typeName != 'Dom' || !proxyKey) {
    return;
  }

  if (fieldName == 'context') {
    let datapointState = {
      compiledGetter: undefined,
      rowId: undefined,
      variantTemplate: undefined,
      variant: undefined,
    };

    let firstTimeResolvers = [];

    function evaluateContext({ getDatapointValue, getRowObject, willRetry, newState }) {
      if (!newState) newState = Object.assign({}, datapointState);
      newState.resolvers = datapointState.resolvers;

      if (newState.variantTemplate == datapointState.variantTemplate) {
        newState.compiledGetter = datapointState.compiledGetter;
      } else if (!newState.variantTemplate) newState.compiledGetter = undefined;
      else {
        newState.compiledGetter = new CodeSnippet({
          code: newState.variantTemplate,
        });
      }

      if (newState.compiledGetter && newState.rowId) {
        newState.variant = String(
          newState.compiledGetter.safeEvaluate({
            getDatapointValue,
            getRowObject,
            rowId: newState.rowId,
          }).result
        );
      }

      if (!willRetry()) {
        datapointState = newState;
      }
      return { rowId: datapointState.rowId, variant: datapointState.variant };
    }

    return {
      getter: {
        fn: ({ getDatapointValue, getRowObject, willRetry }) => {
          if (firstTimeResolvers) {
            return new Promise(resolve => {
              firstTimeResolvers.push(resolve);
            });
          } else return evaluateContext({ getDatapointValue, getRowObject, willRetry });
        },
      },
      setter: {
        fn: (context, { getDatapointValue, getRowObject, willRetry }) => {
          let rowId, variant, variantTemplate;
          if (typeof context == 'string') {
            if (ConvertIds.rowRegex.test(context)) rowId = context;
            else if (ConvertIds.datapointRegex.test(context)) {
              ({ rowId, fieldName: variant } = ConvertIds.decomposeId({ datapointId: context }));
            }
          } else if (typeof context == 'object') {
            ({ rowId, variant, variantTemplate } = context);
            if (rowId && (typeof rowId != 'string' || !ConvertIds.rowRegex.test(rowId))) {
              rowId = undefined;
            }
            if (variant && (typeof variant != 'string' || !ConvertIds.fieldNameRegex.test(variant))) {
              rowId = undefined;
              variant = undefined;
            }
          }
          const ret = evaluateContext({
            getDatapointValue,
            getRowObject,
            willRetry,
            newState: { rowId, variant, variantTemplate },
          });
          if (!willRetry() && firstTimeResolvers) {
            const resolvers = firstTimeResolvers;
            firstTimeResolvers = undefined;
            for (const resolve of resolvers) resolve(ret);
          }
          return ret;
        },
      },
    };
  }
};

},{"../../datapoints/convert-ids":7,"../../general/code-snippet":26}],21:[function(require,module,exports){
const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const { templateDatapointIdForRowAndVariant } = require('../dom-functions');

module.exports = ({ htmlToElement }) =>
  function({ datapoint }) {
    const { fieldName, typeName, rowId, proxyKey } = datapoint;

    if (typeName != 'Dom' || !proxyKey) {
      return;
    }

    if (fieldName == 'element') {
      const match = /^(id_(\w+?))(?:_lid_([0-9]\d*))?$/.exec(proxyKey);
      if (match) {
        const baseProxyKey = match[1],
          elementId = ChangeCase.paramCase(match[2]),
          lid = match[3] ? Number(match[3]) : undefined;

        evaluateElement = ({ getDatapointValue, willRetry }) => {
          if (lid !== undefined) {
            const baseElement = getDatapointValue(
              ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'element' }).datapointId
            );
            if (willRetry() || !baseElement) return;
            const element = lid == 1 ? baseElement : findLid(baseElement, lid);
            if (element) element.setAttribute('nobo-uid', proxyKey);
            return element;
          }

          const element = typeof document == 'undefined' ? undefined : document.getElementById(elementId);
          return element;
        };

        return {
          getter: {
            fn: evaluateElement,
          },
          setter: {
            fn: (_newValue, { getDatapointValue }) => evaluateElement({ getDatapointValue }),
          },
        };
      } else {
        const match = /^(\w+?)(?:_lid_([0-9]\d*))?$/.exec(proxyKey),
          baseProxyKey = match[1],
          lid = match[2] ? Number(match[2]) : undefined;

        const defaultDom = '<div>...</div>';

        let datapointState = { dom: undefined, element: undefined };

        evaluateElement = ({ getDatapointValue, willRetry }) => {
          if (lid !== undefined) {
            const baseElement = getDatapointValue(
              ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'element' }).datapointId
            );
            if (willRetry() || !baseElement) return;
            const element = lid == 1 ? baseElement : findLid(baseElement, lid);
            if (element) element.setAttribute('nobo-uid', proxyKey);
            return element;
          }

          newState = { dom: undefined, element: undefined };

          do {
            const { rowId: sourceRowId, variant } =
              getDatapointValue(
                ConvertIds.recomposeId({ typeName, proxyKey: baseProxyKey, fieldName: 'context' }).datapointId
              ) || {};

            if (sourceRowId) {
              const template = getDatapointValue(templateDatapointIdForRowAndVariant(sourceRowId, variant));

              if (Array.isArray(template) && template.length == 1) {
                newState.dom = getDatapointValue(
                  ConvertIds.recomposeId({ rowId: template[0], fieldName: 'dom' }).datapointId
                );
              }
            }

            if (willRetry()) return;

            if (!newState.dom || typeof newState.dom != 'string') newState.dom = defaultDom;

            if (newState.dom == datapointState.dom) newState.element = datapointState.element;
            else {
              newState.element = htmlToElement(newState.dom);
              if (!newState.element) {
                newState.dom = defaultDom;
                newState.element = htmlToElement(newState.dom);
              }
              newState.element.setAttribute('nobo-rowid', sourceRowId);
              newState.element.setAttribute('nobo-variant', variant || 'default');
            }
          } while (false);

          if (!willRetry()) {
            datapointState = newState;
          }

          return datapointState.element;
        };

        return {
          getter: {
            fn: evaluateElement,
          },
          setter: {
            fn: (_newValue, { getDatapointValue }) => evaluateElement({ getDatapointValue }),
          },
        };
      }
    }
  };

function findLid(element, lid) {
  const elLid = element.getAttribute('nobo-lid');
  if (!elLid) return;
  if (Number(elLid) == lid) return element;

  return findLidChild(element, lid);
}

function findLidChild(element, lid) {
  let prevChild;
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (!child.hasAttribute('nobo-lid')) continue;
    const childLid = Number(child.getAttribute('nobo-lid'));
    if (childLid == 1) continue;

    if (childLid == lid) return child;
    if (prevChild && childLid > lid) {
      return findLidChild(prevChild, lid);
    }
    prevChild = child;
  }
  if (prevChild) {
    return findLidChild(prevChild, lid);
  }
}

},{"../../datapoints/convert-ids":7,"../dom-functions":24,"change-case":42}],22:[function(require,module,exports){
const ChangeCase = require('change-case');
const ConvertIds = require('../../datapoints/convert-ids');
const { rangeForElement } = require('../dom-functions');

module.exports = function({ datapoint, cache }) {
  const { fieldName, typeName, rowId, proxyKey: baseProxyKey } = datapoint;

  if (typeName != 'Dom' || !baseProxyKey) {
    return;
  }

  if (fieldName == 'tree') {
    const match = /^(\w+?)(?:_lid_([0-9]\d*))?$/.exec(baseProxyKey),
      lid = match[2] ? Number(match[2]) : undefined;

    if (lid !== undefined) return;

    evaluateTree = ({ getDatapointValue, referenceDatapoint, willRetry }) => {
      const element = getDatapointValue(ConvertIds.recomposeId({ rowId, fieldName: 'element' }).datapointId);
      if (!element) return;

      forEachLid(element, (element, lid) => {
        const proxyKey = `${baseProxyKey}_lid_${lid}`;

        for (let attributeIndex = element.attributes.length - 1; attributeIndex >= 0; attributeIndex--) {
          const { name } = element.attributes[attributeIndex];
          if (name.endsWith('-template')) {
            if (/^on[a-z]/.test(name)) {
              const eventName = name.substring(0, name.length - '-template'.length);
              element.removeAttribute(eventName);
              element[eventName] = function(event) {
                cache
                  .getOrCreateDatapoint(
                    ConvertIds.recomposeId({ typeName, proxyKey, fieldName: `attribute_${eventName}` }).datapointId
                  )
                  .validate({ eventContext: event });
              };
            } else {
              const fieldName = ChangeCase.camelCase(
                `attribute-${name.substring(0, name.length - '-template'.length)}`
              );
              referenceDatapoint(ConvertIds.recomposeId({ typeName, proxyKey, fieldName }).datapointId);
            }
          }
        }

        for (let classIndex = element.classList.length - 1; classIndex >= 0; classIndex--) {
          const name = element.classList[classIndex];
          if (name.endsWith('-model-child')) {
            referenceDatapoint(ConvertIds.recomposeId({ typeName, proxyKey, fieldName: 'children' }).datapointId);
            break;
          }
        }
      });

      if (willRetry()) return;

      return rangeForElement(element);
    };

    return {
      getter: {
        fn: evaluateTree,
      },
      setter: {
        fn: (_newValue, options) => evaluateTree(options),
      },
    };
  }
};

function forEachLid(element, fn, lid = 1) {
  fn(element, lid);
  for (let child = element.firstElementChild; child; child = child.nextElementSibling) {
    if (!child.hasAttribute('nobo-lid')) continue;
    const childLid = Number(child.getAttribute('nobo-lid'));
    if (childLid == 1) continue;

    forEachLid(child, fn, childLid);
  }
}

},{"../../datapoints/convert-ids":7,"../dom-functions":24,"change-case":42}],23:[function(require,module,exports){
const finders = [
  require('./dom-attribute'),
  require('./dom-children'),
  require('./dom-context'),
  require('./dom-tree'),
];
const finderFactories = [require('./dom-element')];

module.exports = ({ cache, htmlToElement }) => {
  const finderFns = finders.concat(finderFactories.map(factory => factory({ htmlToElement })));

  for (const fn of finderFns) cache.getterSetterInfo.finders.push(fn);
};

},{"./dom-attribute":18,"./dom-children":19,"./dom-context":20,"./dom-element":21,"./dom-tree":22}],24:[function(require,module,exports){
const ChangeCase = require('change-case');
const ConvertIds = require('../datapoints/convert-ids');
const nameForElement = require('../general/name-for-element');
const log = require('../general/log');

// API is just all the functions
module.exports = {
  htmlToElement,
  templateDatapointIdForRowAndVariant,
  variantForTemplateDatapointId,
  describeTree,
  rangeForElement,
  forEachInElementRange,
  mapInElementRange,
  findInElementRange,
  forEachChildRange,
  mapChildRanges,
  findChildRange,
  childRangesForElement,
  insertChildRange,
  deleteChildRange,
  decomposeDatapointProxyKey,
  recomposeDatapointProxyKey,
};

function htmlToElement(html) {
  var template = document.createElement('template');
  template.innerHTML = html.trim();
  let element = template.content.firstChild;
  if (element && element.nodeType == 3) {
    let span = document.createElement('span');
    span.innerText = element.textContent;
    element = span;
  }
  return element;
}

function templateDatapointIdForRowAndVariant(rowId, variant) {
  return ConvertIds.recomposeId({
    rowId,
    fieldName: `template_${variant || 'default'}`,
  }).datapointId;
}

function variantForTemplateDatapointId(datapointId) {
  const { fieldName } = ConvertIds.decomposeId({ datapointId });
  if (fieldName.startsWith('template')) {
    const variant = ChangeCase.camelCase(fieldName.substring('template'.length));
    return variant == 'default' ? undefined : variant;
  }
}

function forEachInElementRange(element, fn) {
  let [_start, end] = rangeForElement(element);
  while (true) {
    const next = element.nextElementSibling;
    fn(element);
    if (element == end) break;
    element = next;
  }
}

function mapInElementRange(element, fn) {
  let [_start, end] = rangeForElement(element);
  const ret = [];
  while (true) {
    const next = element.nextElementSibling;
    ret.push(fn(element));
    if (element == end) break;
    element = next;
  }
  return ret;
}

function findInElementRange(element, fn) {
  let [_start, end] = rangeForElement(element);
  while (true) {
    const next = element.nextElementSibling;
    if (fn(element)) return element;
    if (element == end) return;
    element = next;
  }
}

function describeTree(element, indent = '') {
  let ret = '';
  const templateDatapointId = element.getAttribute('nobo-template-dpid'),
    variant = templateDatapointId ? variantForTemplateDatapointId(templateDatapointId) : undefined,
    rowId = templateDatapointId ? ConvertIds.decomposeId({ datapointId: templateDatapointId }).rowId : undefined,
    name = nameForElement(element),
    clas = element.className.replace(' ', '+'),
    desc = `${name}${clas ? `.${clas}` : ''}${templateDatapointId ? `:${rowId}${variant ? `[${variant}]` : ''}` : ''}`;
  ret += `${indent}${desc}\n`;
  indent += '. ';
  forEachChildRange(element, ([child]) => {
    ret += describeTree(child, indent);
  });
  return ret;
}

function rangeForElement(parent) {
  const parentId = parent.getAttribute('nobo-uid');
  let lastChildEnd = parent;
  if (parentId) {
    for (let child = parent.nextElementSibling; child; child = lastChildEnd.nextElementSibling) {
      if (child.getAttribute('nobo-parent-uid') != parentId) break;
      lastChildEnd = rangeForElement(child)[1];
    }
  }
  return [parent, lastChildEnd];
}

function forEachChildRange(parent, fn) {
  const parentId = parent.getAttribute('nobo-uid');
  for (let child = parent.nextElementSibling, lastChildRange; child; child = lastChildRange[1].nextElementSibling) {
    if (child.getAttribute('nobo-parent-uid') != parentId) break;
    fn((lastChildRange = rangeForElement(child)));
  }
}

function mapChildRanges(parent, fn) {
  const ret = [];
  forEachChildRange(parent, range => ret.push(fn(range)));
  return ret;
}

function findChildRange(parent, fn) {
  const parentId = parent.getAttribute('nobo-uid');
  for (let child = parent.nextElementSibling, lastChildRange; child; child = lastChildRange[1].nextElementSibling) {
    if (child.getAttribute('nobo-parent-uid') != parentId) break;
    if (fn((lastChildRange = rangeForElement(child)))) {
      return lastChildRange;
    }
  }
}

function childRangesForElement(parent) {
  const ranges = [];
  forEachChildRange(parent, range => ranges.push(range));
  return ranges;
}

function insertChildRange({ parent, after, childRange }) {
  for (
    let [child, end] = childRange, nextSibling = child === end ? undefined : child.nextSibling;
    child;
    child = nextSibling, nextSibling = !child || child === end ? undefined : child.nextSibling
  ) {
    parent.parentNode.insertBefore(child, (after || parent).nextSibling);
  }
}

function deleteChildRange([child, end]) {
  for (
    let nextSibling = child === end ? undefined : child.nextSibling;
    child;
    child = nextSibling, nextSibling = !child || child === end ? undefined : child.nextSibling
  ) {
    if (child.parentNode) child.parentNode.removeChild(child);
  }
}

function decomposeDatapointProxyKey(proxyKey) {
  const match = /^(\w*?)(?:_lid_([0-9]\d*))?$/.exec(proxyKey);
  return {
    proxyKey,
    baseProxyKey: match[1],
    lid: match[2] ? Number(match[2]) : undefined,
  };
}

function recomposeDatapointProxyKey({ baseProxyKey, lid }) {
  if (lid === undefined) return baseProxyKey;
  return `${baseProxyKey}_lid_${lid}`;
}

},{"../datapoints/convert-ids":7,"../general/log":30,"../general/name-for-element":32,"change-case":42}],25:[function(require,module,exports){
// change-detector-object
// © Will Smart 2018. Licence: MIT

module.exports = changeDetectorObject;

changeDetectorObject.isCDO = object => {
  return object && typeof object == 'object' && '__cdo__' in object;
};

function changeDetectorObject(baseObject, readOnly, setParentModified) {
  if (!baseObject || typeof baseObject != 'object') return baseObject;
  const changeObject = {},
    deletionsObject = {},
    modified = [false];
  function setModified() {
    if (readOnly) throw new Error('Cannot mutate in non-mutating CDO');
    if (setParentModified) setParentModified();
    modified[0] = true;
  }
  return {
    changeObject,
    deletionsObject,
    modified,
    get modifiedObject() {
      if (!modified[0]) return baseObject;
      const newObject = Object.assign({}, baseObject);
      if (deletionsObject) for (const key of Object.keys(deletionsObject)) delete newObject[key];
      if (changeObject) {
        for (const [key, newValue] of Object.entries(changeObject)) {
          if (newValue && typeof newValue == 'object') {
            newObject[key] = newValue.modifiedObject;
          } else newObject[key] = newValue;
        }
      }
      return newObject;
    },
    clearChanges: () => {
      for (key of Object.keys(changeObject)) delete changeObject[key];
      for (key of Object.keys(deletionsObject)) delete deletionsObject[key];
      modified[0] = false;
    },
    useObject: new Proxy(
      {},
      {
        getPrototypeOf: () => Object.getPrototypeOf(baseObject),
        isExtensible: () => Object.isExtensible(baseObject),
        getOwnPropertyDescriptor: (_obj, prop) =>
          deletionsObject[prop]
            ? undefined
            : Object.getOwnPropertyDescriptor(changeObject, prop) || Object.getOwnPropertyDescriptor(baseObject, prop),
        defineProperty: (_obj, key, descriptor) => {
          setModified();
          delete deletionsObject[key];
          return Object.defineProperty(changeObject, key, descriptor);
        },
        has: (_obj, key) => key == '__cdo__' || (!deletionsObject[key] && (key in changeObject || key in baseObject)),
        get: (_obj, key) => {
          if (deletionsObject[key]) return;
          if (key in changeObject) {
            const ret = changeObject[key];
            return ret && typeof ret == 'object' ? ret.useObject : ret;
          }
          const ret = baseObject[key];
          if (ret && typeof ret == 'object') {
            return (changeObject[key] = changeDetectorObject(ret, readOnly, setModified)).useObject;
          }
          return ret;
        },
        set: (_obj, key, value) => {
          setModified();
          delete deletionsObject[key];
          if (value && typeof value == 'object') {
            return (changeObject[key] = changeDetectorObject(ret, readOnly, setModified)).useObject;
          }
          changeObject[key] = value;
          return true;
        },
        deleteProperty: (_obj, key) => {
          setModified();
          delete changeObject[key];
          deletionsObject[key] = true;
          return true;
        },
        ownKeys: () => {
          if (!modified[0]) return Reflect.ownKeys(baseObject);
          const keys = new Set([...Reflect.ownKeys(baseObject), ...Reflect.ownKeys(changeObject)]);
          for (const key of Object.keys(deletionsObject)) keys.delete(key);
          return [...keys];
        },
      }
    ),
  };
}

},{}],26:[function(require,module,exports){
// code-snippet
// © Will Smart 2018. Licence: MIT

// A wrapper for vm allowing both server and client to run amophous code
// The key win here is a mechanism to safely ensure the variables and objects referenced in the code are set

// API is auto-generated at the bottom from the public interface of the CodeSnippet class

const PublicApi = require('./public-api');
const changeDetectorObject = require('./change-detector-object');
const wrapFunctionLocals = require('./wrap-function-locals');
const log = require('../general/log');
const ConvertIds = require('../datapoints/convert-ids');

let nextLocalId = 1;

class Code {
  static withString(codeString) {
    const codes = Code.codes || (Code.codes = {});
    return codes[codeString] || (codes[codeString] = new Code(codeString));
  }

  constructor(codeString) {
    const code = this;
    Object.assign(code, wrapFunctionLocals(codeString));
  }

  evalOnContext(context, state, event, allocateRowObject, getDatapointValue) {
    const code = this,
      { wrappedFunction } = code,
      changeDetectingContext = changeDetectorObject(context);
    let result = wrappedFunction
      ? event
        ? wrappedFunction.call(
            event.target,
            changeDetectingContext.useObject,
            state,
            {},
            event,
            allocateRowObject,
            getDatapointValue
          )
        : wrappedFunction(changeDetectingContext.useObject, state, {}, event, allocateRowObject, getDatapointValue)
      : undefined;
    return {
      context,
      changeDetectingContext,
      result,
    };
  }

  evalOnModelCDO(modelCDO, state, event, allocateRowObject, getDatapointValue) {
    const code = this,
      { wrappedFunction } = code;
    let result = wrappedFunction
      ? event
        ? wrappedFunction.call(event.target, modelCDO, state, modelCDO, event, allocateRowObject, getDatapointValue)
        : wrappedFunction(modelCDO, state, modelCDO, event, allocateRowObject, getDatapointValue)
      : undefined;
    return {
      modelCDO,
      result,
    };
  }
}

class CodeSnippet {
  // public methods
  static publicMethods() {
    return ['evaluate', 'safeEvaluate', 'names', 'func', 'parse', 'setAsFunction'];
  }

  constructor({ code, func, names, ignoreNames = {} }) {
    const codeSnippet = this;

    codeSnippet.defaultValue = '...';
    codeSnippet.defaultTimeout = 1000;
    codeSnippet.ignoreNames = ignoreNames;
    codeSnippet.codeString = code;

    if (typeof func == 'function') {
      codeSnippet.setAsFunction({ func, names });
    } else {
      codeSnippet.code = Code.withString(code);
    }
  }

  get names() {
    return this._names || this.code.names;
  }

  setAsFunction({ func, names }) {
    const codeSnippet = this;

    if (typeof func != 'function') return;

    delete codeSnippet._func;
    if (!names || typeof names != 'object') names = {};
    codeSnippet._names = names && typeof names == 'object' ? names : {};
    codeSnippet._func = func;
  }

  forEachName(callback, names, stack) {
    const codeSnippet = this;

    stack = stack || [];
    names = names || codeSnippet.names;

    let hasName = false;
    for (const [name, value] of Object.entries(names)) {
      if (codeSnippet.ignoreNames[name]) continue;
      hasName = true;
      stack.push(name);
      if (!value || typeof value != 'object' || !codeSnippet.forEachName(callback, value, stack)) {
        callback(...stack);
      }
      stack.pop();
    }
    return hasName;
  }

  safeEvaluate({
    cache,
    getDatapointValue,
    rowId,
    getRowObject,
    valueForNameCallback,
    valuesByName,
    defaultValue,
    timeout,
    event,
  }) {
    try {
      return { error: undefined, result: this.evaluate(arguments[0]) };
    } catch (error) {
      return { error, result: defaultValue || this.defaultValue };
    }
  }

  evaluate({
    cache,
    getDatapointValue,
    rowId,
    getRowObject,
    valueForNameCallback,
    valuesByName,
    defaultValue,
    timeout,
    event,
  }) {
    const codeSnippet = this,
      sandbox = {};

    if (!defaultValue) defaultValue = codeSnippet.defaultValue;
    if (!timeout) timeout = codeSnippet.defaultTimeout;

    const //stateVar = cache ? cache.stateVar : undefined,
      state = getRowObject('state__page'),
      rowObject = rowId ? getRowObject(rowId) : undefined,
      allocateRowObject = typeName => {
        return getRowObject(ConvertIds.recomposeId({ typeName, proxyKey: `l${nextLocalId++}` }).rowId);
      };

    if (typeof valueForNameCallback != 'function') {
      valueForNameCallback = (...names) => {
        let values = valuesByName;
        let index = 0;
        for (const name of names) {
          if (!values || typeof values != 'object') return;
          if (index < names.length - 1) values = values[name];
          else return values[name];
          index++;
        }
      };
    }

    codeSnippet.forEachName((...names) => {
      let localSandbox = sandbox,
        index = 0;
      for (const name of names) {
        const value = valueForNameCallback(...names.slice(0, index + 1));
        if (index == names.length - 1 || changeDetectorObject.isCDO(value)) {
          localSandbox[name] = value;
          break;
        } else {
          localSandbox = localSandbox[name] ? localSandbox[name] : (localSandbox[name] = {});
        }
        index++;
      }
    });

    let result = codeSnippet.defaultValue;
    try {
      if (codeSnippet._func) {
        if (event) {
          result = codeSnippet._func.call(event, sandbox, state, allocateRowObject);
        } else result = codeSnippet._func(sandbox, state, allocateRowObject);
      } else if (rowObject) {
        ({ result } = codeSnippet.code.evalOnModelCDO(rowObject, state, event, allocateRowObject, getDatapointValue));
      } else {
        ({ result } = codeSnippet.code.evalOnContext(sandbox, state, event, allocateRowObject, getDatapointValue));
      }
    } catch (error) {
      log('err.code', `Error while evaluating code: ${error.message}`);
      throw error;
      //} finally {
      //if (stateVar) stateVar.commitStateVar();
    }

    return result;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: CodeSnippet,
  hasExposedBackDoor: true,
});

},{"../datapoints/convert-ids":7,"../general/log":30,"./change-detector-object":25,"./public-api":34,"./wrap-function-locals":40}],27:[function(require,module,exports){
// diff
// © Will Smart 2018. Licence: MIT

// This is a simple diff generator
// output is a fairly custom format
//  for example
// diffAny({a:1,b:[2,1]},{b:[1],c:2})
// ==
// {
//   objectDiff: {
//     a: undefined,
//     b: {arrayDiff:[
//       { at: 0, value: 1 }
//       { deleteAt: 1 }
//     ]},
//     c: {value: 2}
//   }
// }

// API is the function. Use via
//   const diffAny = require(pathToDiff)

const log = require('./log'),
  isEqual = require('./is-equal');

module.exports = diffAny;

function diffAny(was, is, memberIsEqualFn) {
  if (was === is) return;
  if (Array.isArray(is)) {
    return Array.isArray(was)
      ? diffArray(was, is, memberIsEqualFn)
      : {
          value: is,
        };
  }
  if (is && typeof is == 'object' && is.constructor == Object)
    return diffObject(
      was && typeof was == 'object' && was.constructor == Object ? was : undefined,
      is,
      memberIsEqualFn
    );
  if (typeof was == typeof is && was == is) return;
  return {
    value: is,
  };
}

function diffObject(was, is, memberIsEqualFn) {
  let diff;
  if (was) {
    for (const key in was) {
      if (was.hasOwnProperty(key)) {
        if (!is.hasOwnProperty(key)) {
          if (!diff) diff = {};
          diff[key] = undefined;
          continue;
        }
        const wasChild = was[key],
          isChild = is[key],
          diffChild = diffAny(wasChild, isChild, memberIsEqualFn);

        if (diffChild) {
          if (!diff) diff = {};
          diff[key] = diffChild;
        }
      }
    }
  }

  for (const key in is) {
    if (is.hasOwnProperty(key) && !(was && was.hasOwnProperty(key))) {
      const isChild = is[key];

      if (!diff) diff = {};
      diff[key] = {
        value: isChild,
      };
    }
  }
  return diff
    ? {
        objectDiff: diff,
      }
    : undefined;
}

function diffArray_o(was, is) {
  let diff;
  // TODO better diff algorithm
  let index;
  was = was || [];

  const edits = 0;

  for (index = is.length - 1; index >= was.length; index--) {
    const isChild = is[index];

    if (!diff)
      diff = {
        arrayDiff: [],
      };
    diff.arrayDiff.push(
      Object.assign({
        insertAt: was.length,
        value: isChild,
      })
    );
  }

  for (index = was.length - 1; index >= is.length; index--) {
    const wasChild = was[index],
      diffChild = diffAny(wasChild);

    if (diffChild) {
      if (!diff)
        diff = {
          arrayDiff: [],
        };
      diff.arrayDiff.unshift({
        deleteAt: index,
      });
    }
  }

  for (index = 0; index < was.length && index < is.length; index++) {
    const wasChild = was[index],
      isChild = is[index],
      diffChild = diffAny(wasChild, isChild);

    if (diffChild) {
      if (!diff)
        diff = {
          arrayDiff: [],
        };
      diff.arrayDiff.push(
        Object.assign(diffChild, {
          at: index,
        })
      );
    }
  }

  return diff;
}

// Thank you Nickolas Butler http://www.codeproject.com/Articles/42279/Investigating-Myers-diff-algorithm-Part-of
// Based on Myers alg. See http://www.xmailserver.org/diff2.pdf

function arrayDiffEdits(from, to, elementsEqual) {
  if (!elementsEqual) elementsEqual = (a, b) => a == b;
  const fromLength = from.length,
    toLength = to.length,
    halfBlockLength = fromLength + toLength + 2,
    blockLength = 2 * halfBlockLength,
    blockCount = fromLength + toLength + 2,
    blocks = [{}];
  let d,
    solved = false;

  log('diff', `Diff: ${JSON.stringify({ fromLength, toLength, blockLength, blockCount })}`);
  for (d = 0; d <= fromLength + toLength && !solved; d++) {
    log('diff', `${JSON.stringify({ d })}`);
    const block = blocks[d];
    for (let k = -d; k <= d; k += 2) {
      log('diff', `${JSON.stringify({ k })}`);
      /* down or right? */
      const down = k == -d || (k != d && (block[k - 1] || 0) < (block[k + 1] || 0)),
        kPrev = down ? k + 1 : k - 1,
        /* start point */
        xStart = block[kPrev] || 0,
        yStart = xStart - kPrev,
        /* mid point */
        xMid = down ? xStart : xStart + 1,
        yMid = xMid - k;

      /* end point */
      let xEnd = xMid,
        yEnd = yMid;

      /* follow diagonal */
      while (xEnd < fromLength && yEnd < toLength && elementsEqual(from[xEnd], to[yEnd])) {
        xEnd++;
        yEnd++;
      }
      log('diff', `${JSON.stringify({ down, kPrev, xStart, yStart, xMid, yMid, xEnd, yEnd })}`);

      /* save end point */
      block[k] = xEnd;

      /* check for solution */
      if (xEnd >= fromLength && yEnd >= toLength) {
        log('diff', `SOLVED`);
        solved = true;
        break;
      }
    }
    log('diff', `Block at d:${d} -> ${JSON.stringify(block)}`);
    blocks.push(Object.assign({}, block));
  }

  log('diff', `Blocks: ${JSON.stringify(blocks)}`);

  let atX = fromLength,
    atY = toLength,
    dels = 0,
    copies = 0;

  const edits = [];

  for (d--; atX > 0 || atY > 0; d--) {
    const block = blocks[d];

    log('diff', `${JSON.stringify({ d, block, edits: edits.join(''), atX, atY })}`);

    const k = atX - atY,
      /* end point is in block[0] */
      xEnd = block[k] || 0,
      yEnd = xEnd - k,
      /* down or right? */
      down = k == -d || (k != d && (block[k - 1] || 0) < (block[k + 1] || 0)),
      kPrev = down ? k + 1 : k - 1,
      /* start point */
      xStart = block[kPrev] || 0,
      yStart = xStart - kPrev,
      /* mid point */
      xMid = down ? xStart : xStart + 1,
      yMid = xMid - k;

    log('diff', `${JSON.stringify({ k, xEnd, down, kPrev, xStart, yStart, xMid, yMid, xEnd, yEnd })}`);

    const localCopies = Math.min(fromLength, xEnd) - Math.max(0, xMid),
      localDels = Math.min(fromLength, xMid) - Math.max(0, xStart),
      localInserts = Math.min(toLength, yMid) - Math.max(0, yStart);

    copies += localCopies;

    if (dels && (copies || localInserts)) {
      edits.push(['d', dels]);
      dels = 0;
    }

    if (copies && (localDels || localInserts)) {
      edits.push(['c', copies]);
      copies = 0;
    }

    if (localInserts) {
      for (let i = Math.max(0, yStart); i < Math.min(toLength, yMid); i++) {
        edits.push(['i', to[i]]);
      }
    }

    dels += localDels;

    atX = xStart;
    atY = yStart;
  }

  if (copies) {
    edits.push(['c', copies]);
  }
  if (dels) {
    edits.push(['d', dels]);
  }
  edits.reverse();
  log('diff', `Path : ${edits.join('')}`);

  return processEdits_delIns(edits);
}

function processEdits_delIns(edits) {
  let dels = 0;
  const ret = [],
    inss = [];
  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
        dels += value;
        break;
      case 'c':
        flushDelIns();
        ret.push(['c', value]);
        break;
      case 'f':
        inss.push(value);
        dels++;
        break;
      case 'i':
        inss.push(value);
        break;
    }
  }

  flushDelIns();
  return ret;

  function flushDelIns() {
    while (dels && inss.length) {
      ret.push(['f', inss.shift()]);
      dels--;
    }
    while (inss.length) {
      ret.push(['i', inss.shift()]);
    }
    if (dels) {
      ret.push(['d', dels]);
      dels = 0;
    }
  }
}

function diffArray(from, to, memberIsEqualFn) {
  if (!Array.isArray(to)) to = [];
  const edits = arrayDiffEdits(from, to, memberIsEqualFn ? memberIsEqualFn : (a, b) => isEqual(a, b)),
    ret = { arrayDiff: [] },
    diff = ret.arrayDiff;

  // inserts first
  let fromIndex = 0,
    pushIndex = 0;
  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
      case 'c':
        fromIndex += value;
        pushIndex = diff.length;
        break;
      case 'f':
        fromIndex++;
        pushIndex = diff.length;
        break;
      case 'i':
        diff.splice(pushIndex, 0, { insertAt: fromIndex, value });
        break;
    }
  }

  // then dels
  fromIndex = 0;
  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
        for (let d = value; d--; ) {
          const fromChild = from[fromIndex],
            diffChild = diffAny(fromChild);
          if (diffChild) diff.push({ deleteAt: fromIndex });
          fromIndex++;
        }
        break;
      case 'c':
        fromIndex += value;
        break;
      case 'f':
        fromIndex++;
        break;
    }
  }

  // then diffs
  fromIndex = 0;
  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
      case 'c':
        fromIndex += value;
        break;
      case 'f':
        const diffChild = diffAny(from[fromIndex], value);
        diff.push(Object.assign(diffChild, { at: fromIndex++, value }));
        break;
    }
  }
  return diff.length ? ret : undefined;
}
function applyDiff(from, edits) {
  const to = [];
  let fromIndex = 0;

  for (const [type, value] of edits) {
    switch (type) {
      case 'd':
        fromIndex += value;
        break;
      case 'c':
        to.push(...from.slice(fromIndex, fromIndex + value));
        fromIndex += value;
        break;
      case 'f':
        to.push(value);
        fromIndex++;
        break;
      case 'i':
        to.push(value);
        break;
    }
  }
  return to;
}

if (typeof window !== 'undefined') {
  const Rand = require('random-seed');

  function randInt(rand, max, power) {
    return Math.floor(Math.pow(rand.random(), power) * max);
  }

  function randArray(rand) {
    return Array.from(Array(randInt(rand, 10, 2))).map(() => randInt(rand, 10, 2));
  }

  window.mockDiff = function(count = 1, seed = 1234) {
    const rand = Rand.create(seed);
    disableNoboLog('diff');
    for (let i = 0; i < count; i++) {
      const from = randArray(rand),
        to = randArray(rand),
        edits = arrayDiffEdits(from, to);
      to2 = applyDiff(from, edits);

      if (!isEqual(to, to2)) {
        log(
          'err',
          `Diff ${i} failed\n  from : ${JSON.stringify(from)}\n  to   : ${JSON.stringify(
            to
          )}\n  to2  : ${JSON.stringify(to2)}\n  edits: ${JSON.stringify(edits)}`
        );
        enableNoboLog('diff');
        debugger;
        arrayDiffEdits(from, to);
        applyDiff(from, edits);
        break;
      }
    }
  };
}

},{"./is-equal":28,"./log":30,"random-seed":59}],28:[function(require,module,exports){
// compare
// © Will Smart 2018. Licence: MIT

const log = require('./log');

// API is the multi-function isEqual function
module.exports = isEqual;

function description(value) {
  try {
    return JSON.stringify(value);
  } catch (err) {
    return `${value}`;
  }
}

// isEqual(v1,v2,options) -- return as a boolean whether v1 and v2 are the same
//    v1: any value
//    v2: any value
//    options: optional object with options
//        options.verboseFail: if the call fails, give a detailed reason as a string
//        options.unordered: when comparing arrays, disregard their order
//        options.allowSuperset: if v1 is not equal to v2, but v1 includes v2, return '>'
//        options.exact: disallow type coersion
//    returns a boolean, or '>', or a longer string if it would return false and options.verboseFail is set
//
function isEqual(v1, v2, options = {}, depth = 0) {
  const { verboseFail, allowSuperset, exact } = options;

  if (depth > 100) {
    log('err', 'isEqual is getting very deep');
    return verboseFail ? 'Too deep' : false;
  }

  if (typeof v1 != typeof v2 || Array.isArray(v1) != Array.isArray(v2)) {
    if (exact) {
      return verboseFail ? `Types differ: \n${description(v1)}\n ... vs ...\n${description(v2)}` : false;
    }
    if (v1 === true ? v2 : v1 === false ? !v2 : v2 === true ? v1 : v2 === false ? !v1 : v1 == v2) {
      return true;
    }
    return verboseFail ? `Values are not equal: \n${description(v1)}\n ... vs ...\n${description(v2)}` : false;
  }

  if (typeof v1 == 'number' || typeof v1 == 'boolean' || typeof v1 == 'string') {
    return v1 == v2
      ? true
      : verboseFail
        ? `${typeof v1}s differ: \n${description(v1)}\n ... vs ...\n${description(v2)}`
        : false;
  }

  if (Array.isArray(v1)) {
    return allowSuperset ? arrayIsEqualOrSuperset(v1, v2, options, depth) : arrayIsEqual(v1, v2, options, depth);
  }

  if (v1 && typeof v1 == 'object') {
    if (v1.constructor !== Object || v2.constructor !== Object) {
      return v1 === v2
        ? true
        : verboseFail
          ? `Non-plain object instances differ: \n${description(v1)}\n ... vs ...\n${description(v2)}`
          : false;
    }
    return allowSuperset ? objectIsEqualOrSuperset(v1, v2, options, depth) : objectIsEqual(v1, v2, options, depth);
  }

  return v1 === v2
    ? true
    : verboseFail
      ? `${typeof v1}s differ: \n${description(v1)}\n ... vs ...\n${description(v2)}`
      : false;
}

function arrayIsEqual(v1, v2, options, depth = 0) {
  const { verboseFail, unordered, exact } = options;

  if (v1.length != v2.length) {
    return verboseFail ? `Array lengths differ: \n${description(v1)}\n ... vs ...\n${description(v2)}` : false;
  }
  if (!v1.length) return true;

  if (!unordered) {
    let index = 0;
    for (const c1 of v1) {
      const res = isEqual(c1, v2[index], options, depth + 1);
      if (res !== true) {
        return verboseFail
          ? `${res}\n > Array values at index ${index} differ: \n${description(v1)}\n ... vs ...\n${description(v2)}`
          : false;
      }
      index++;
    }
  } else {
    const unusedC1Indexes = Object.assign({}, v1.map(() => true));
    for (const c2 of v2) {
      let found = false;
      for (const c1Index in unusedC1Indexes)
        if (unusedC1Indexes.hasOwnProperty(c1Index)) {
          const c1 = v1[c1Index];
          if (
            isEqual(
              c1,
              c2,
              {
                unordered,
                exact,
              },
              depth + 1
            )
          ) {
            delete unusedC1Indexes[c1Index];
            found = true;
            break;
          }
        }
      if (!found) {
        return verboseFail
          ? `Value ${description(c2)} from the second array was not found in the first: \n${description(
              v1
            )}\n ... vs ...\n${description(v2)}`
          : false;
      }
    }
  }
  return true;
}

function objectIsEqual(v1, v2, options, depth = 0) {
  const { verboseFail } = options;

  const v1Keys = keysIncludingFromPrototype(v1),
    v2Keys = keysIncludingFromPrototype(v2);
  if (v1Keys.length != v2Keys.length) {
    return verboseFail ? `Object sizes differ: \n${description(v1)}\n ... vs ...\n${description(v2)}` : false;
  }
  for (const v1Key of v1Keys) {
    const res = isEqual(v1[v1Key], v2[v1Key], options, depth + 1);
    if (res !== true) {
      return verboseFail
        ? `${res}\n > Values for key ${v1Key} differ: \n${description(v1)}\n ... vs ...\n${description(v2)}`
        : false;
    }
  }
  return true;
}

function arrayIsEqualOrSuperset(v1, v2, options, depth = 0) {
  const { unordered, exact, verboseFail } = options;

  if (v1.length < v2.length)
    return verboseFail
      ? `First array is smaller than second: \n${description(v1)}\n ... vs ...\n${description(v2)}`
      : false;
  if (!v1.length) return true;

  let supersetMatch = v1.length > v2.length;

  if (!unordered) {
    let index = 0;
    for (const c2 of v2) {
      const res = isEqual(v1[index], c2, options, depth + 1);
      if (res == '>') supersetMatch = true;
      else if (res !== true)
        return verboseFail
          ? `${res}\n > Array values at index ${index} differ: \n${description(v1)}\n ... vs ...\n${description(v2)}`
          : false;
      index++;
    }
    return supersetMatch ? '>' : true;
  } else {
    const unusedC1Indexes = Object.assign({}, v1.map(() => true));
    const unusedC2Indexes = {};
    let c2Index = 0;
    for (const c2 of v2) {
      let found = false;
      for (const c1Index in unusedC1Indexes) {
        if (unusedC1Indexes.hasOwnProperty(c1Index)) {
          const c1 = v1[c1Index];
          if (
            isEqual(
              c1,
              c2,
              {
                unordered,
                exact,
              },
              depth + 1
            )
          ) {
            delete unusedC1Indexes[c1Index];
            found = true;
            break;
          }
        }
      }
      if (!found) unusedC2Indexes[c2Index] = [];
      c2Index++;
    }
    if (!Object.keys(unusedC1Indexes).length) return true;

    for (const [c2Index, supersetsC1Indexes] of Object.entries(unusedC2Indexes)) {
      for (const c1Index of Object.keys(unusedC1Indexes)) {
        if (
          isEqual(
            v1[c1Index],
            v2[c2Index],
            {
              unordered,
              exact,
              allowSuperset: true,
            },
            depth + 1
          )
        ) {
          supersetsC1Indexes.push(c1Index);
        }
      }
      if (!supersetsC1Indexes.length)
        return verboseFail
          ? `Member ${description(
              v2[c2Index]
            )} of second array has no equivalent superset in the first, or all such supersets are already matched with an exact match in the second array: \n${description(
              v1
            )}\n ... vs ...\n${description(v2)}`
          : false;
    }
    const c2IndexesInOrder = Object.keys(unusedC2Indexes).sort(
      (a, b) => Object.keys(unusedC2Indexes[a]).length - Object.keys(unusedC2Indexes[b]).length
    );

    function findMapping(c2IndexIndex) {
      if (c2IndexIndex == c2IndexesInOrder.length) return true;
      const c2Index = c2IndexesInOrder[c2IndexIndex];
      const supersetsC1Indexes = unusedC2Indexes[c2Index];
      for (const c1Index of supersetsC1Indexes) {
        if (unusedC1Indexes[c1Index]) {
          delete unusedC1Indexes[c1Index];
          if (findMapping(c2IndexIndex + 1)) return true;
          unusedC1Indexes[c1Index] = true;
        }
      }
    }

    return findMapping(0)
      ? '>'
      : verboseFail
        ? `No mapping could be found between the arrays:
${description(v1)}
     ... vs ...
${description(v2)}`
        : false;
  }
}

function keyObjectIncludingFromPrototype(object) {
  const proto = Object.getPrototypeOf(object),
    keys = Object.keys(object);
  const keyo = {};
  for (const key of keys) keyo[key] = true;

  if (proto !== Object.prototype) {
    Object.assign(keyo, keyObjectIncludingFromPrototype(proto));
  }

  return keyo;
}

function keysIncludingFromPrototype(object) {
  const proto = Object.getPrototypeOf(object),
    keys = Object.keys(object);
  if (proto === Object.prototype) return keys;

  const keyo = {};
  for (const key of keys) keyo[key] = true;
  Object.assign(keyo, keyObjectIncludingFromPrototype(proto));

  return Object.keys(keyo);
}

function objectIsEqualOrSuperset(v1, v2, options, depth = 0) {
  const { verboseFail } = options;

  const v1Keys = keysIncludingFromPrototype(v1),
    v2Keys = keysIncludingFromPrototype(v2);
  if (v1Keys.length < v2Keys.length)
    return verboseFail
      ? `First object has fewer keys than second: \n${description(v1)}\n ... vs ...\n${description(v2)}`
      : false;
  let supersetMatch = v1Keys.length > v2Keys.length;
  for (const v2Key of v2Keys) {
    const res = isEqual(v1[v2Key], v2[v2Key], options, depth + 1);
    if (res == '>') supersetMatch = true;
    else if (res !== true)
      return verboseFail
        ? `${res}\n > Values for key ${v2Key} are not equal or superset/subset: \n${description(
            v1
          )}\n ... vs ...\n${description(v2)}`
        : false;
  }
  return supersetMatch ? '>' : true;
}

},{"./log":30}],29:[function(require,module,exports){
// locate-end
// © Will Smart 2018. Licence: MIT

// This locates the end of a string literal or code block from some point in a string

// API is the function. Use via
//   const locateEnd = require(pathToFile)

/* eg:

locateEnd('` ${1+"\\"two\\""+three(four[5])}`+six')
= 
{
  range: [0, 32],
  type: "``",
  children: [
    {
      range: [2, 31],
      type: "${}",
      children: [
        { range: [6, 15], type: '""' },
        { range: [21, 30], type: "()", children: [{ range: [26, 29], type: "[]" }] }
      ]
    }
  ]
}

locateEnd('eeepies','p') == {"range":[0,4],"type":"p"}
*/

module.exports = locateEnd;
locateEnd.locateEndOfString = locateEndOfString;

function locateEndOfString(string, closeChar, openIndex) {
  const openIndexWas = openIndex;
  if (closeChar !== false && (typeof closeChar != 'string' || closeChar.length != 1)) {
    closeChar = string.charAt(openIndex);
    switch (closeChar) {
      case '"':
      case "'":
      case '`':
        break;
      default:
        return locateEnd(string, undefined, openIndex);
    }
    openIndex++;
  }

  let regex;
  switch (closeChar) {
    case false:
      regex = /(?:\\$|(?!\$\{)[\s\S])*/g;
      break;
    case '`':
      regex = /(?:\\`|\\$|(?!\$\{)[^`])*/g;
      break;
    case "'":
      regex = /(?=((?:\\'|[^'])*))\1'/g;
      break;
    case '"':
      regex = /(?=((?:\\"|[^"])*))\1"/g;
      break;
    default:
      return locateEnd(string, closeChar, openIndex);
  }
  const ret = {
    range: [openIndexWas, undefined],
    type: closeChar === false ? '...`' : `${closeChar}${closeChar}`,
  };
  if (closeChar !== false && closeChar != '`') {
    regex.lastIndex = openIndex;
    const match = regex.exec(string);
    if (match) ret.range[1] = regex.lastIndex;
    return ret;
  }

  regex.lastIndex = openIndex;
  while (true) {
    regex.exec(string);
    if (regex.lastIndex == string.length) return ret;
    const endChar = string.charAt(regex.lastIndex);
    if (endChar === closeChar) {
      ret.range[1] = regex.lastIndex + 1;
      return ret;
    }

    // must be a ${
    const child = locateEnd(string, undefined, regex.lastIndex + 1);
    if (!child) return;
    if (child.type == '{}') {
      child.type = '${}';
      child.range[0]--;
    }
    ret.children = ret.children || [];
    ret.children.push(child);
    if (child.range[1] === undefined) return ret;
    regex.lastIndex = child.range[1];
  }
}

const bracketTypes = {
  '(': ')',
  '[': ']',
  '{': '}',
};

function locateEnd(string, closeChar, openIndex = 0) {
  const ret = {
    range: [openIndex, undefined],
  };
  let closeCharClass = '';
  if (closeChar !== false && (typeof closeChar != 'string' || closeChar.length != 1)) {
    const openChar = string.charAt(openIndex);
    closeChar = bracketTypes[openChar];
    switch (openChar) {
      case '"':
      case "'":
      case '`':
        return locateEndOfString(string, undefined, openIndex);
    }
    if (!closeChar) return;
    openIndex++;
  }
  switch (closeChar) {
    case false:
      ret.type = '...';
      break;
    case '"':
    case "'":
    case '`':
      return locateEndOfString(string, closeChar, openIndex);
    case '}':
      ret.type = '{}';
      break;
    case ')':
      ret.type = '()';
      break;
    case ']':
      ret.type = '[]';
      break;
    default:
      ret.type = closeChar;
      closeCharClass = `\\${closeChar}`;
      break;
  }

  const regex = new RegExp(`[^'"\\\`{}()[\\]${closeCharClass}]*`, 'g');

  regex.lastIndex = openIndex;
  while (true) {
    const match = regex.exec(string);
    if (regex.lastIndex == string.length) return ret;
    const endChar = string.charAt(regex.lastIndex);
    if (endChar === closeChar) {
      ret.range[1] = regex.lastIndex + 1;
      return ret;
    }
    let child;
    switch (endChar) {
      case '`':
      case "'":
      case '"':
        child = locateEndOfString(string, undefined, regex.lastIndex);
        break;
      case '[':
      case '{':
      case '(':
        child = locateEnd(string, undefined, regex.lastIndex);
        break;
      default:
        return;
    }
    if (!child) return;
    ret.children = ret.children || [];
    ret.children.push(child);
    if (child.range[1] === undefined) return ret;
    regex.lastIndex = child.range[1];
  }
}

},{}],30:[function(require,module,exports){
module.exports = log;

const enabledLogs = { err: true, diff: false, verbose: false, db: false, other: { verbose: false, other: true } };

function logIsEnabled(module) {
  let parent = enabledLogs;
  for (const part of module.split('.')) {
    let val = parent[part];
    if (!val) {
      if (val === false) return false;
      val = parent.other;
      if (!val) return false;
    }
    if (val === true) return true;
    if (typeof val !== 'object') return false;
    parent = val;
  }
  return true;
}

function log(module, ...args) {
  if (!logIsEnabled(module)) return false;
  if (args.length == 1 && typeof args[0] == 'function') args = [args[0]()];
  if (module === 'err' || module.startsWith('err.')) {
    console.error.apply(console, args);
  } else console.log.apply(console, args);
  return true;
}

log.enableLog = function(module) {
  enabledLogs[module] = true;
};

log.disableLog = function(module) {
  delete enabledLogs[module];
};

if (typeof window !== 'undefined') {
  window.enableNoboLog = log.enableLog;
  window.disableNoboLog = log.disableLog;
}

},{}],31:[function(require,module,exports){
// map_values
// © Will Smart 2018. Licence: MIT

// Simply applies a map over the values in a plain object
// eg mapValues({a:1,b:2}, v=>v+1) == {a:2,b:3}

// API if the function
// include as:
//  const mapValues = require(pathToFile)
module.exports = mapValues;

function mapValues(object, fn) {
  const ret = {};
  Object.keys(object).forEach(key => {
    const val = fn(object[key], key);
    if (val != undefined) ret[key] = val;
  });
  return ret;
}

},{}],32:[function(require,module,exports){
// clone
// © Will Smart 2018. Licence: MIT

// This is a simple util to attach names to elements
// API is the function. Use via
//   const nameForElement = require(pathToFile)
// or
//   const {nameForElement, cloneShowingElementNames} = require(pathToFile)

module.exports = nameForElement;
Object.assign(nameForElement, {
  nameForElement,
  cloneShowingElementNames,
});

let nextElementIndex = 1;

function nameForElement(element) {
  let name = element.getAttribute('nobo-name');
  if (!name) {
    name = `#${nextElementIndex++}`;
    element.setAttribute('nobo-name', name);
  }
  return name;
}

function cloneShowingElementNames(value) {
  return _cloneShowingElementNames(value).clone;
}

function _cloneShowingElementNames(value) {
  if (Array.isArray(value)) {
    let names = value.map(el => (el.getAttribute ? nameForElement(el) : undefined));
    if (!names.find(name => name)) names = undefined;
    return {
      clone: value.map(el => (el.getAttribute ? el : _cloneShowingElementNames(el).clone)),
      name: names ? names.join(', ') : undefined,
    };
  } else if (value && typeof value == 'object') {
    if (value.getAttribute) return { clone: value, name: nameForElement(value) };
    const clone = {};
    for (const [key, child] of Object.entries(value)) {
      const { name: childName, clone: childClone } = _cloneShowingElementNames(child);
      clone[key] = childClone;
      if (childName) clone[`${key}--${Array.isArray(childName) ? 'names' : 'name'}`] = childName;
    }
    return { clone };
  }
  return { clone: value };
}

},{}],33:[function(require,module,exports){
// names-from-code
// © Will Smart 2018. Licence: MIT

const locateEnd = require('./locate-end');
const unicodeCategories = require('./unicode-categories');

const permissableGlobals = {
  Function: true,
  Math: true,
  Object: true,
  console: true,
  model: true,
  event: true,
  newrow: true,
};
const jsKeywords = {
  break: true,
  case: true,
  catch: true,
  continue: true,
  debugger: true,
  default: true,
  delete: true,
  do: true,
  else: true,
  finally: true,
  for: true,
  function: true,
  if: true,
  in: true,
  instanceof: true,
  new: true,
  return: true,
  switch: true,
  this: true,
  throw: true,
  try: true,
  typeof: true,
  var: true,
  void: true,
  while: true,
  with: true,
  class: true,
  const: true,
  enum: true,
  export: true,
  extends: true,
  import: true,
  super: true,
  implements: true,
  interface: true,
  let: true,
  package: true,
  private: true,
  protected: true,
  public: true,
  static: true,
  yield: true,
  null: true,
  true: true,
  false: true,
  undefined: true,
  NaN: true,
  Infinity: true,
  eval: true,
  arguments: true,
};

// API is the public facing class
module.exports = namesFromCodeString;

function namesFromCodeString(codeString) {
  const root = locateEnd(codeString, false),
    names = {};
  addNamesFromCode(codeString, root, names);
  return names;
}

function addNamesFromCode(codeString, part, names) {
  let { range, type } = part,
    [partStart, partEnd] = range;
  if (partEnd === undefined) partEnd = codeString.length;

  switch (type) {
    case '...':
    case '${}':
    case '()':
    case '[]':
    case '{}':
      if (!part.children) addNamesFromCodeString(codeString.substring(partStart, partEnd), names);
      else {
        let start = partStart;
        for (const child of part.children) {
          const [childStart, childEnd] = child.range;
          if (childStart > start) {
            addNamesFromCodeString(codeString.substring(start, childStart), names);
          }
          start = childEnd;

          addNamesFromCode(codeString, child, names);
        }
      }
      break;
    default:
      if (part.children) {
        for (const child of part.children) {
          addNamesFromCode(codeString, child, names);
        }
      }
  }
}

function addNamesFromCodeString(codeString, names) {
  const validVariable = `(?:${unicodeCategories.varStart})(?:${unicodeCategories.varInnard})*`,
    re = new RegExp(`(.*?)((?:state\.)?${validVariable})`, 'g'),
    allowableGapRe = /(?<!\.\s*)$/;
  let match;
  while ((match = re.exec(codeString))) {
    const gap = match[1],
      name = match[2];
    if (!allowableGapRe.test(gap)) continue;
    if (!(permissableGlobals[name] || jsKeywords[name])) names[name] = true;
  }
}

},{"./locate-end":29,"./unicode-categories":38}],34:[function(require,module,exports){
// convert_ids
// © Will Smart 2018. Licence: MIT

// PublicApi wraps a given class in a function that mimics the class's public methods
// essentially it allows js to support private methods/properties on a class
// I am sure this is available in other modules, this is just my version.

// To use, create a class, and provide a static method called publicMethods that returns an array of strings
// eg.

// class MyPrivateClass {
//   static publicMethods() {
//     return [
//       'publicMethod',
//       'publicGetter',
//       'publicStaticMethod'
//     ]
//   }
//   publicMethod() {this.privateMethod()}
//   privateMethod() {}
//   get publicGetter() {return `It's ${this.privateGetter}`}
//   get privateGetter() {return '42'}
//   static publicStaticMethod() {this.privateStaticMethod()}
//   static privateStaticMethod() {}
// }
//
// Essentially returns a class exposing only the public methods from MyPrivateClass
// const PublicInterface = PublicApi({fromClass:MyPrivateClass})
//
// or allowing instances of PublicInterface to have a '__private' property
//  which points to the underlying MyPrivateClass thus potentially easing debugging
//  and making instance construction a little quicker and instance size a little smaller
// const PublicInterface = PublicApi({fromClass:MyPrivateClass, hasExposedBackDoor:true})
//
// Use PublicInterface like a class
// const blic = new PublicInterface()
// blic.publicGetter == "It's 42"
// blic.privateGetter == undefined

// note that setters aren't supported as yet

// API is the class wrapping function. include as
// const PublicApi = require(pathToFile)
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
        this.__defineGetter__(
          methodName,
          function() {
            return method.apply(private, arguments);
          }
        );
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
      PublicClass.__defineGetter__(
        methodName,
        function() {
          return method.apply(fromClass, arguments);
        }
      );
    } else if (fromClass[methodName]) {
      let method = fromClass[methodName];
      PublicClass[methodName] = function() {
        return method.apply(fromClass, arguments);
      };
    }

    publicInstanceGetterMethods.forEach(({ methodName, method }) => {
      PublicClass.prototype.__defineGetter__(
        methodName,
        function() {
          return method.apply(this.__private, arguments);
        }
      );
    });
    publicInstanceMethods.forEach(({ methodName, method }) => {
      PublicClass.prototype[methodName] = function() {
        return method.apply(this.__private, arguments);
      };
    });
  });

  return PublicClass;
}

},{}],35:[function(require,module,exports){
const strippedValues = require('./stripped-values');
const ConvertIds = require('../datapoints/convert-ids');
const PublicApi = require('./public-api');
const CodeSnippet = require('./code-snippet');

// API is auto-generated at the bottom from the public interface of this class
class SchemaDefn {
  // public methods
  static publicMethods() {
    return ['allTypes', 'source', 'addLayout', 'loadSource', 'clear', 'fieldForDatapoint'];
  }

  constructor() {
    this.clear();
  }

  get allTypes() {
    return this._allTypes;
  }

  get source() {
    return this._source;
  }

  addLayout(object) {
    if (!Array.isArray(object)) object = [object];
    object.forEach(child => {
      this._addLayout(child);
    });
  }

  clear() {
    this._allTypes = {};
    this._source = [];
  }

  loadSource(source) {
    if (!Array.isArray(source)) return;
    source.forEach(layout => {
      this._addLayout(layout);
    });
  }

  fieldForDatapoint({ typeName, fieldName }) {
    return this.allTypes[typeName].fields[fieldName];
  }

  getType(name) {
    let schema = this;
    if (name && typeof name == 'object') return name.getEnclosingType();
    return (
      this._allTypes[name] ||
      (this._allTypes[name] = {
        _: 'Type',
        stripped: function() {
          let ret = {};
          if (Object.keys(this.fields).length) ret.fields = strippedValues(this.fields);
          return ret;
        },
        name: name,
        protected: false,
        ownerField: undefined,
        fields: {},
        getEnclosingType: function() {
          return this;
        },
        getField: function(name, dataType, isVirtual, isMultiple) {
          if (name == undefined) {
            return;
          }
          const type = this;
          dataType = schema.getType(dataType);
          return (
            type.fields[name] ||
            (type.fields[name] = {
              _: 'Field',
              stripped: function() {
                let ret = {
                  dataType: this.dataType.name,
                };
                if (this.default !== undefined) ret.default = this.default;
                if (this.get !== undefined) ret.get = this.get;
                if (this.sort !== undefined) ret.sort = this.sort;
                if (this.isVirtual) ret.isVirtual = true;
                if (this.isMultiple) ret.isMultiple = true;
                if (Object.keys(this.links).length) ret.links = strippedValues(this.links);
                return ret;
              },
              name: name,
              dataType: dataType,
              isVirtual: isVirtual || false,
              isMultiple: isMultiple || false,
              isId: /^[A-Z]/.test(dataType.name),
              enclosingType: type,
              links: {},
              fullName: type.name + '::' + name,
              getEnclosingType: function() {
                return type;
              },
              getField: function(name, dataType, isVirtual, isMultiple) {
                if (name == undefined) return this;
                return this.dataType.getField(name, dataType, isVirtual, isMultiple);
              },
              getDatapointId: function({ dbRowId, proxyKey }) {
                return ConvertIds.recomposeId({
                  typeName: this.enclosingType.name,
                  dbRowId,
                  proxyKey,
                  fieldName: this.name,
                }).datapointId;
              },
              getLinkedToField: function() {
                const linkKeys = Object.keys(this.links);
                if (!linkKeys.length) return;
                const link = this.links[linkKeys[0]];
                return link.left === this ? link.right : link.left;
              },
              getLink: function(toField, linkType) {
                const field = this;
                return (
                  field.links[toField.fullName] ||
                  (field.links[toField.fullName] = toField.links[field.fullName] = {
                    _: 'Link',
                    stripped: function() {
                      return {
                        left: this.left.fullName,
                        right: this.right.fullName,
                        linkType: this.type,
                      };
                    },
                    left: field,
                    right: toField,
                    type: linkType,
                  })
                );
              },
            })
          );
        },
      })
    );
  }

  _addLayout(object, me, myFieldName, as, depth) {
    const schema = this;

    depth = depth || 0;
    if (depth == 0) {
      schema._source.push(object);
    }

    const myField = me ? me.getField() : undefined;

    if (Array.isArray(object)) {
      let array = object;
      object = {};
      array.forEach(val => {
        if (typeof val == 'string') object[val] = null;
      });
    }

    if (typeof object == 'string' || typeof object == 'number' || typeof object == 'boolean') {
      if (myField) {
        myField.default = object;
      }
    } else if (object && typeof object == 'object') {
      Object.keys(object).forEach(key => {
        let val = object[key];
        switch (key) {
          case 'as':
            if (typeof val == 'string') as = val;
            break;
          case 'get':
            if (!myField) break;
            myField.isVirtual = true;
            myField.get = new CodeSnippet({ code: val });
            break;
          case 'sort':
            if (!myField) break;
            myField.sort = new CodeSnippet({ code: val });
            break;
          case 'protectedTable':
            if (me && val) me.getEnclosingType().protected = true;
            break;
          case 'ownerField':
            if (me && val && typeof val == 'string') me.getEnclosingType().ownerField = val;
            break;
          case 'default':
          case 'unique':
            if (myField) myField[key] = val;
            break;
          default:
            const match = /^(?:(?:([\w_]+)\s*)?(--|~-|-~|~<|>~)\s*)?([\w_]+)(?:\(([\w_]+)\))?$/.exec(key);
            const linkTypes = {
              '--': {},
              '~-': {
                rightIsVirtual: true,
              },
              '-~': {
                leftIsVirtual: true,
              },
              '~<': {
                rightIsVirtual: true,
                rightIsMultiple: true,
              },
              '>~': {
                leftIsVirtual: true,
                leftIsMultiple: true,
              },
            };
            if (match) {
              const asName = match[1],
                linkType = match[2],
                childFieldName = match[4] ? match[3] : undefined,
                childTypeName = match[4] ? match[4] : match[3];
              const linkTypeInfo = linkType ? linkTypes[linkType] : undefined;
              const childField =
                me && childFieldName
                  ? me.getField(
                      childFieldName,
                      childTypeName,
                      linkTypeInfo ? linkTypeInfo.rightIsVirtual : false,
                      linkTypeInfo ? linkTypeInfo.rightIsMultiple : false
                    )
                  : schema.getType(childTypeName);

              const myLocalFieldName = schema._addLayout(
                val,
                childField,
                childFieldName,
                asName || myFieldName,
                depth + 1
              );

              if (linkType && me && myLocalFieldName) {
                const myLocalField = schema
                  .getType(childTypeName)
                  .getField(
                    myLocalFieldName,
                    me.dataType || me,
                    linkTypeInfo ? linkTypeInfo.leftIsVirtual : false,
                    linkTypeInfo ? linkTypeInfo.leftIsMultiple : false
                  );
                myLocalField.getLink(childField, linkType);
              }
            }
        }
      });
    }
    return as;
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: SchemaDefn,
  hasExposedBackDoor: true,
});

},{"../datapoints/convert-ids":7,"./code-snippet":26,"./public-api":34,"./stripped-values":37}],36:[function(require,module,exports){
// state-var
// © Will Smart 2018. Licence: MIT

const PublicApi = require('./public-api');
const ConvertIds = require('../datapoints/convert-ids');
const changeDetectorObject = require('./change-detector-object');

class StateVar {
  // public methods
  static publicMethods() {
    return ['stateVar', 'commitStateVar', 'datapointId'];
  }

  constructor({ cache }) {
    const stateVar = this;
    Object.assign(stateVar, {
      cache,
      state: {},
    });
  }

  get stateVar() {
    const stateVar = this;
    if (!stateVar.cdo) {
      stateVar.cdo = changeDetectorObject(stateVar.state);
    }
    return stateVar.cdo.useObject;
  }

  commitStateVar() {
    const stateVar = this,
      { cdo } = stateVar;
    if (!cdo) return;
    stateVar.commitStateChange('state', cdo);
    stateVar.state = cdo.modifiedObject;
    stateVar.cdo = undefined;
  }

  static datapointId(path) {
    return ConvertIds.recomposeId({ rowId: 'state__default', fieldName: path.replace('.', '_') }).datapointId;
  }

  commitStateChange(path, cdo) {
    const stateVar = this,
      { cache } = stateVar,
      { changeObject, deletionsObject, modified } = cdo;
    if (!modified[0]) return;
    if (deletionsObject) {
      for (const key of Object.keys(deletionsObject)) {
        const datapointId = StateVar.datapointId(`${path}.${key}`),
          datapoint = cache.getExistingDatapoint(datapointId);
        if (datapoint) {
          datapoint.setValue(undefined);
        }
      }
    }
    if (changeObject) {
      for (const [key, value] of Object.entries(changeObject)) {
        if (value && typeof value == 'object') {
          stateVar.commitStateChange(`${path}_${key}`, value);
          value = value.modifiedObject;
        }
        const datapointId = StateVar.datapointId(`${path}.${key}`),
          datapoint = cache.getOrCreateDatapoint(datapointId);
        datapoint.setValue(value);
      }
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: StateVar,
  hasExposedBackDoor: true,
});

},{"../datapoints/convert-ids":7,"./change-detector-object":25,"./public-api":34}],37:[function(require,module,exports){
const mapValues = require('../general/map-values');

// API
module.exports = strippedValues;

function strippedValues(object) {
  return mapValues(
    object,
    val => (typeof val == 'object' && typeof val.stripped == 'function' ? val.stripped() : undefined)
  );
}

},{"../general/map-values":31}],38:[function(require,module,exports){
// unicode-regex-categories
// © Will Smart 2018. Licence: MIT
// with thanks to http://inimino.org/~inimino/blog/javascript_cset also under MIT licence

const Ll =
    '[a-zªµºß-öø-ÿāăąćĉċčďđēĕėęěĝğġģĥħĩīĭįıĳĵķ-ĸĺļľŀłńņň-ŉŋōŏőœŕŗřśŝşšţťŧũūŭůűųŵŷźżž-ƀƃƅƈƌ-ƍƒƕƙ-ƛƞơƣƥƨƪ-ƫƭưƴƶƹ-ƺƽ-ƿǆǉǌǎǐǒǔǖǘǚǜ-ǝǟǡǣǥǧǩǫǭǯ-ǰǳǵǹǻǽǿȁȃȅȇȉȋȍȏȑȓȕȗșțȝȟȡȣȥȧȩȫȭȯȱȳ-ȹȼȿ-ɀɂɇɉɋɍɏ-ʓʕ-ʯͱͳͷͻ-ͽΐά-ώϐ-ϑϕ-ϗϙϛϝϟϡϣϥϧϩϫϭϯ-ϳϵϸϻ-ϼа-џѡѣѥѧѩѫѭѯѱѳѵѷѹѻѽѿҁҋҍҏґғҕҗҙқҝҟҡңҥҧҩҫҭүұҳҵҷҹһҽҿӂӄӆӈӊӌӎ-ӏӑӓӕӗәӛӝӟӡӣӥӧөӫӭӯӱӳӵӷӹӻӽӿԁԃԅԇԉԋԍԏԑԓԕԗԙԛԝԟԡԣա-ևᴀ-ᴫᵢ-ᵷᵹ-ᶚḁḃḅḇḉḋḍḏḑḓḕḗḙḛḝḟḡḣḥḧḩḫḭḯḱḳḵḷḹḻḽḿṁṃṅṇṉṋṍṏṑṓṕṗṙṛṝṟṡṣṥṧṩṫṭṯṱṳṵṷṹṻṽṿẁẃẅẇẉẋẍẏẑẓẕ-ẝẟạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹỻỽỿ-ἇἐ-ἕἠ-ἧἰ-ἷὀ-ὅὐ-ὗὠ-ὧὰ-ώᾀ-ᾇᾐ-ᾗᾠ-ᾧᾰ-ᾴᾶ-ᾷιῂ-ῄῆ-ῇῐ-ΐῖ-ῗῠ-ῧῲ-ῴῶ-ῷⁱⁿℊℎ-ℏℓℯℴℹℼ-ℽⅆ-ⅉⅎↄⰰ-ⱞⱡⱥ-ⱦⱨⱪⱬⱱⱳ-ⱴⱶ-ⱼⲁⲃⲅⲇⲉⲋⲍⲏⲑⲓⲕⲗⲙⲛⲝⲟⲡⲣⲥⲧⲩⲫⲭⲯⲱⲳⲵⲷⲹⲻⲽⲿⳁⳃⳅⳇⳉⳋⳍⳏⳑⳓⳕⳗⳙⳛⳝⳟⳡⳣ-ⳤⴀ-ⴥꙁꙃꙅꙇꙉꙋꙍꙏꙑꙓꙕꙗꙙꙛꙝꙟꙣꙥꙧꙩꙫꙭꚁꚃꚅꚇꚉꚋꚍꚏꚑꚓꚕꚗꜣꜥꜧꜩꜫꜭꜯ-ꜱꜳꜵꜷꜹꜻꜽꜿꝁꝃꝅꝇꝉꝋꝍꝏꝑꝓꝕꝗꝙꝛꝝꝟꝡꝣꝥꝧꝩꝫꝭꝯꝱ-ꝸꝺꝼꝿꞁꞃꞅꞇꞌﬀ-ﬆﬓ-ﬗａ-ｚ]|\\ud801[\\udc28-\\udc4f]|\\ud835[\\udc1a-\\udc33\\udc4e-\\udc54\\udc56-\\udc67\\udc82-\\udc9b\\udcb6-\\udcb9\\udcbb\\udcbd-\\udcc3\\udcc5-\\udccf\\udcea-\\udd03\\udd1e-\\udd37\\udd52-\\udd6b\\udd86-\\udd9f\\uddba-\\uddd3\\uddee-\\ude07\\ude22-\\ude3b\\ude56-\\ude6f\\ude8a-\\udea5\\udec2-\\udeda\\udedc-\\udee1\\udefc-\\udf14\\udf16-\\udf1b\\udf36-\\udf4e\\udf50-\\udf55\\udf70-\\udf88\\udf8a-\\udf8f\\udfaa-\\udfc2\\udfc4-\\udfc9\\udfcb]',
  Lu =
    '[A-ZÀ-ÖØ-ÞĀĂĄĆĈĊČĎĐĒĔĖĘĚĜĞĠĢĤĦĨĪĬĮİĲĴĶĹĻĽĿŁŃŅŇŊŌŎŐŒŔŖŘŚŜŞŠŢŤŦŨŪŬŮŰŲŴŶŸ-ŹŻŽƁ-ƂƄƆ-ƇƉ-ƋƎ-ƑƓ-ƔƖ-ƘƜ-ƝƟ-ƠƢƤƦ-ƧƩƬƮ-ƯƱ-ƳƵƷ-ƸƼǄǇǊǍǏǑǓǕǗǙǛǞǠǢǤǦǨǪǬǮǱǴǶ-ǸǺǼǾȀȂȄȆȈȊȌȎȐȒȔȖȘȚȜȞȠȢȤȦȨȪȬȮȰȲȺ-ȻȽ-ȾɁɃ-ɆɈɊɌɎͰͲͶΆΈ-ΊΌΎ-ΏΑ-ΡΣ-ΫϏϒ-ϔϘϚϜϞϠϢϤϦϨϪϬϮϴϷϹ-ϺϽ-ЯѠѢѤѦѨѪѬѮѰѲѴѶѸѺѼѾҀҊҌҎҐҒҔҖҘҚҜҞҠҢҤҦҨҪҬҮҰҲҴҶҸҺҼҾӀ-ӁӃӅӇӉӋӍӐӒӔӖӘӚӜӞӠӢӤӦӨӪӬӮӰӲӴӶӸӺӼӾԀԂԄԆԈԊԌԎԐԒԔԖԘԚԜԞԠԢԱ-ՖႠ-ჅḀḂḄḆḈḊḌḎḐḒḔḖḘḚḜḞḠḢḤḦḨḪḬḮḰḲḴḶḸḺḼḾṀṂṄṆṈṊṌṎṐṒṔṖṘṚṜṞṠṢṤṦṨṪṬṮṰṲṴṶṸṺṼṾẀẂẄẆẈẊẌẎẐẒẔẞẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼẾỀỂỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪỬỮỰỲỴỶỸỺỼỾἈ-ἏἘ-ἝἨ-ἯἸ-ἿὈ-ὍὙὛὝὟὨ-ὯᾸ-ΆῈ-ΉῘ-ΊῨ-ῬῸ-Ώℂℇℋ-ℍℐ-ℒℕℙ-ℝℤΩℨK-ℭℰ-ℳℾ-ℿⅅↃⰀ-ⰮⱠⱢ-ⱤⱧⱩⱫⱭ-ⱯⱲⱵⲀⲂⲄⲆⲈⲊⲌⲎⲐⲒⲔⲖⲘⲚⲜⲞⲠⲢⲤⲦⲨⲪⲬⲮⲰⲲⲴⲶⲸⲺⲼⲾⳀⳂⳄⳆⳈⳊⳌⳎⳐⳒⳔⳖⳘⳚⳜⳞⳠⳢꙀꙂꙄꙆꙈꙊꙌꙎꙐꙒꙔꙖꙘꙚꙜꙞꙢꙤꙦꙨꙪꙬꚀꚂꚄꚆꚈꚊꚌꚎꚐꚒꚔꚖꜢꜤꜦꜨꜪꜬꜮꜲꜴꜶꜸꜺꜼꜾꝀꝂꝄꝆꝈꝊꝌꝎꝐꝒꝔꝖꝘꝚꝜꝞꝠꝢꝤꝦꝨꝪꝬꝮꝹꝻꝽ-ꝾꞀꞂꞄꞆꞋＡ-Ｚ]|\\ud801[\\udc00-\\udc27]|\\ud835[\\udc00-\\udc19\\udc34-\\udc4d\\udc68-\\udc81\\udc9c\\udc9e-\\udc9f\\udca2\\udca5-\\udca6\\udca9-\\udcac\\udcae-\\udcb5\\udcd0-\\udce9\\udd04-\\udd05\\udd07-\\udd0a\\udd0d-\\udd14\\udd16-\\udd1c\\udd38-\\udd39\\udd3b-\\udd3e\\udd40-\\udd44\\udd46\\udd4a-\\udd50\\udd6c-\\udd85\\udda0-\\uddb9\\uddd4-\\udded\\ude08-\\ude21\\ude3c-\\ude55\\ude70-\\ude89\\udea8-\\udec0\\udee2-\\udefa\\udf1c-\\udf34\\udf56-\\udf6e\\udf90-\\udfa8\\udfca]',
  Lt = '[ǅǈǋǲᾈ-ᾏᾘ-ᾟᾨ-ᾯᾼῌῼ]',
  Lm = '[ʰ-ˁˆ-ˑˠ-ˤˬˮʹͺՙـۥ-ۦߴ-ߵߺॱๆໆჼៗᡃᱸ-ᱽᴬ-ᵡᵸᶛ-ᶿₐ-ₔⱽⵯⸯ々〱-〵〻ゝ-ゞー-ヾꀕꘌꙿꜗ-ꜟꝰꞈｰﾞ-ﾟ]',
  Lo =
    '[ƻǀ-ǃʔא-תװ-ײء-ؿف-يٮ-ٯٱ-ۓەۮ-ۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪऄ-हऽॐक़-ॡॲॻ-ॿঅ-ঌএ-ঐও-নপ-রলশ-হঽৎড়-ঢ়য়-ৡৰ-ৱਅ-ਊਏ-ਐਓ-ਨਪ-ਰਲ-ਲ਼ਵ-ਸ਼ਸ-ਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલ-ળવ-હઽૐૠ-ૡଅ-ଌଏ-ଐଓ-ନପ-ରଲ-ଳଵ-ହଽଡ଼-ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கங-சஜஞ-டண-தந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-ళవ-హఽౘ-ౙౠ-ౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠ-ೡഅ-ഌഎ-ഐഒ-നപ-ഹഽൠ-ൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะา-ำเ-ๅກ-ຂຄງ-ຈຊຍດ-ທນ-ຟມ-ຣລວສ-ຫອ-ະາ-ຳຽເ-ໄໜ-ໝༀཀ-ཇཉ-ཬྈ-ྋက-ဪဿၐ-ၕၚ-ၝၡၥ-ၦၮ-ၰၵ-ႁႎა-ჺᄀ-ᅙᅟ-ᆢᆨ-ᇹሀ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙶᚁ-ᚚᚠ-ᛪᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៜᠠ-ᡂᡄ-ᡷᢀ-ᢨᢪᤀ-ᤜᥐ-ᥭᥰ-ᥴᦀ-ᦩᧁ-ᧇᨀ-ᨖᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮ-ᮯᰀ-ᰣᱍ-ᱏᱚ-ᱷℵ-ℸⴰ-ⵥⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ〆〼ぁ-ゖゟァ-ヺヿㄅ-ㄭㄱ-ㆎㆠ-ㆷㇰ-ㇿ㐀-䶵一-鿃ꀀ-ꀔꀖ-ꒌꔀ-ꘋꘐ-ꘟꘪ-ꘫꙮꟻ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꤊ-ꤥꤰ-ꥆꨀ-ꨨꩀ-ꩂꩄ-ꩋ가-힣豈-鶴侮-頻並-龎יִײַ-ﬨשׁ-זּטּ-לּמּנּ-סּףּ-פּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼｦ-ｯｱ-ﾝﾠ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]|[\\ud840-\\ud868][\\udc00-\\udfff]|\\ud800[\\udc00-\\udc0b\\udc0d-\\udc26\\udc28-\\udc3a\\udc3c-\\udc3d\\udc3f-\\udc4d\\udc50-\\udc5d\\udc80-\\udcfa\\ude80-\\ude9c\\udea0-\\uded0\\udf00-\\udf1e\\udf30-\\udf40\\udf42-\\udf49\\udf80-\\udf9d\\udfa0-\\udfc3\\udfc8-\\udfcf]|\\ud801[\\udc50-\\udc9d]|\\ud802[\\udc00-\\udc05\\udc08\\udc0a-\\udc35\\udc37-\\udc38\\udc3c\\udc3f\\udd00-\\udd15\\udd20-\\udd39\\ude00\\ude10-\\ude13\\ude15-\\ude17\\ude19-\\ude33]|\\ud808[\\udc00-\\udf6e]|\\ud869[\\udc00-\\uded6]|\\ud87e[\\udc00-\\ude1d]',
  L = `${Ll}|${Lu}|${Lt}|${Lm}|${Lo}`,
  Mn =
    '[\\u0300-\\u036f\\u0483-\\u0487\\u0591-\\u05bd\\u05bf\\u05c1-\\u05c2\\u05c4-\\u05c5\\u05c7\\u0610-\\u061a\\u064b-\\u065e\\u0670\\u06d6-\\u06dc\\u06df-\\u06e4\\u06e7-\\u06e8\\u06ea-\\u06ed\\u0711\\u0730-\\u074a\\u07a6-\\u07b0\\u07eb-\\u07f3\\u0901-\\u0902\\u093c\\u0941-\\u0948\\u094d\\u0951-\\u0954\\u0962-\\u0963\\u0981\\u09bc\\u09c1-\\u09c4\\u09cd\\u09e2-\\u09e3\\u0a01-\\u0a02\\u0a3c\\u0a41-\\u0a42\\u0a47-\\u0a48\\u0a4b-\\u0a4d\\u0a51\\u0a70-\\u0a71\\u0a75\\u0a81-\\u0a82\\u0abc\\u0ac1-\\u0ac5\\u0ac7-\\u0ac8\\u0acd\\u0ae2-\\u0ae3\\u0b01\\u0b3c\\u0b3f\\u0b41-\\u0b44\\u0b4d\\u0b56\\u0b62-\\u0b63\\u0b82\\u0bc0\\u0bcd\\u0c3e-\\u0c40\\u0c46-\\u0c48\\u0c4a-\\u0c4d\\u0c55-\\u0c56\\u0c62-\\u0c63\\u0cbc\\u0cbf\\u0cc6\\u0ccc-\\u0ccd\\u0ce2-\\u0ce3\\u0d41-\\u0d44\\u0d4d\\u0d62-\\u0d63\\u0dca\\u0dd2-\\u0dd4\\u0dd6\\u0e31\\u0e34-\\u0e3a\\u0e47-\\u0e4e\\u0eb1\\u0eb4-\\u0eb9\\u0ebb-\\u0ebc\\u0ec8-\\u0ecd\\u0f18-\\u0f19\\u0f35\\u0f37\\u0f39\\u0f71-\\u0f7e\\u0f80-\\u0f84\\u0f86-\\u0f87\\u0f90-\\u0f97\\u0f99-\\u0fbc\\u0fc6\\u102d-\\u1030\\u1032-\\u1037\\u1039-\\u103a\\u103d-\\u103e\\u1058-\\u1059\\u105e-\\u1060\\u1071-\\u1074\\u1082\\u1085-\\u1086\\u108d\\u135f\\u1712-\\u1714\\u1732-\\u1734\\u1752-\\u1753\\u1772-\\u1773\\u17b7-\\u17bd\\u17c6\\u17c9-\\u17d3\\u17dd\\u180b-\\u180d\\u18a9\\u1920-\\u1922\\u1927-\\u1928\\u1932\\u1939-\\u193b\\u1a17-\\u1a18\\u1b00-\\u1b03\\u1b34\\u1b36-\\u1b3a\\u1b3c\\u1b42\\u1b6b-\\u1b73\\u1b80-\\u1b81\\u1ba2-\\u1ba5\\u1ba8-\\u1ba9\\u1c2c-\\u1c33\\u1c36-\\u1c37\\u1dc0-\\u1de6\\u1dfe-\\u1dff\\u20d0-\\u20dc\\u20e1\\u20e5-\\u20f0\\u2de0-\\u2dff\\u302a-\\u302f\\u3099-\\u309a\\ua66f\\ua67c-\\ua67d\\ua802\\ua806\\ua80b\\ua825-\\ua826\\ua8c4\\ua926-\\ua92d\\ua947-\\ua951\\uaa29-\\uaa2e\\uaa31-\\uaa32\\uaa35-\\uaa36\\uaa43\\uaa4c\\ufb1e\\ufe00-\\ufe0f\\ufe20-\\ufe26]|\\ud800\\uddfd|\\ud802[\\ude01-\\ude03\\ude05-\\ude06\\ude0c-\\ude0f\\ude38-\\ude3a\\ude3f]|\\ud834[\\udd67-\\udd69\\udd7b-\\udd82\\udd85-\\udd8b\\uddaa-\\uddad\\ude42-\\ude44]|\\udb40[\\udd00-\\uddef]',
  Mc =
    '[\\u0903\\u093e-\\u0940\\u0949-\\u094c\\u0982-\\u0983\\u09be-\\u09c0\\u09c7-\\u09c8\\u09cb-\\u09cc\\u09d7\\u0a03\\u0a3e-\\u0a40\\u0a83\\u0abe-\\u0ac0\\u0ac9\\u0acb-\\u0acc\\u0b02-\\u0b03\\u0b3e\\u0b40\\u0b47-\\u0b48\\u0b4b-\\u0b4c\\u0b57\\u0bbe-\\u0bbf\\u0bc1-\\u0bc2\\u0bc6-\\u0bc8\\u0bca-\\u0bcc\\u0bd7\\u0c01-\\u0c03\\u0c41-\\u0c44\\u0c82-\\u0c83\\u0cbe\\u0cc0-\\u0cc4\\u0cc7-\\u0cc8\\u0cca-\\u0ccb\\u0cd5-\\u0cd6\\u0d02-\\u0d03\\u0d3e-\\u0d40\\u0d46-\\u0d48\\u0d4a-\\u0d4c\\u0d57\\u0d82-\\u0d83\\u0dcf-\\u0dd1\\u0dd8-\\u0ddf\\u0df2-\\u0df3\\u0f3e-\\u0f3f\\u0f7f\\u102b-\\u102c\\u1031\\u1038\\u103b-\\u103c\\u1056-\\u1057\\u1062-\\u1064\\u1067-\\u106d\\u1083-\\u1084\\u1087-\\u108c\\u108f\\u17b6\\u17be-\\u17c5\\u17c7-\\u17c8\\u1923-\\u1926\\u1929-\\u192b\\u1930-\\u1931\\u1933-\\u1938\\u19b0-\\u19c0\\u19c8-\\u19c9\\u1a19-\\u1a1b\\u1b04\\u1b35\\u1b3b\\u1b3d-\\u1b41\\u1b43-\\u1b44\\u1b82\\u1ba1\\u1ba6-\\u1ba7\\u1baa\\u1c24-\\u1c2b\\u1c34-\\u1c35\\ua823-\\ua824\\ua827\\ua880-\\ua881\\ua8b4-\\ua8c3\\ua952-\\ua953\\uaa2f-\\uaa30\\uaa33-\\uaa34\\uaa4d]|\\ud834[\\udd65-\\udd66\\udd6d-\\udd72]',
  Nd =
    '[0-9٠-٩۰-۹߀-߉०-९০-৯੦-੯૦-૯୦-୯௦-௯౦-౯೦-೯൦-൯๐-๙໐-໙༠-༩၀-၉႐-႙០-៩᠐-᠙᥆-᥏᧐-᧙᭐-᭙᮰-᮹᱀-᱉᱐-᱙꘠-꘩꣐-꣙꤀-꤉꩐-꩙０-９]|\\ud801[\\udca0-\\udca9]|\\ud835[\\udfce-\\udfff]',
  Pc = '[_‿-⁀⁔︳-︴﹍-﹏＿]',
  varStart = `${L}|[$_]`,
  varInnard = `${varStart}|${Mn}|${Mc}|${Nd}|${Pc}|[\\u200C\\u200D]`;

module.exports = {
  Ll,
  Lu,
  Lt,
  Lm,
  Lo,
  L,
  Mn,
  Mc,
  Nd,
  Pc,
  varStart,
  varInnard,
};

},{}],39:[function(require,module,exports){
// watchable
// © Will Smart 2018. Licence: MIT

// This is a stupidly simple observer pattern util

// API is the function. Require via
//   const makeClassWatchable = require(pathToFile)
// then after creating your class use as:
//   makeClassWatchable(TheClass)

module.exports = makeClassWatchable;

let g_nextUniqueCallbackIndex = 1;

function uniqueCallbackKey() {
  return `callback__${g_nextUniqueCallbackIndex++}`;
}

function makeClassWatchable(watchableClass) {
  Object.assign(watchableClass.prototype, {
    watch: function(listener) {
      const me = this;
      if (!listener.callbackKey) listener.callbackKey = uniqueCallbackKey();
      if (me.listeners === undefined) {
        me.listeners = [listener];
        if (typeof me.firstListenerAdded == 'function') {
          me.firstListenerAdded.call(me);
        }
      } else {
        const listeners = me.listeners.slice();
        let index = listeners.findIndex(listener2 => listener.callbackKey == listener2.callbackKey);
        if (index == -1) listeners.push(listener);
        else listeners[index] = listener;
        me.listeners = listeners;
      }
      if (typeof me.listenersChanged == 'function') {
        me.listenersChanged.call(me);
      }
      return listener.callbackKey;
    },

    stopWatching: function({ callbackKey }) {
      const me = this;

      if (!me.listeners) return;
      let index = me.listeners.findIndex(listener => listener.callbackKey == callbackKey);
      if (index == -1) return;
      const listeners = me.listeners.slice(),
        listener = listeners.splice(index, 1)[0];
      if (!listeners.length) {
        delete me.listeners;
        if (typeof me.lastListenerRemoved == 'function') {
          me.lastListenerRemoved.call(me);
        }
      } else {
        me.listeners = listeners;
      }
      if (typeof me.listenersChanged == 'function') {
        me.listenersChanged.call(me);
      }
      return listener;
    },

    forEachListener: function(type, callback) {
      const me = this,
        { listeners } = me;

      if (!listeners) return;

      for (const listener of listeners) {
        if (typeof listener[type] == 'function') callback.call(me, listener);
      }
    },

    notifyListeners: function(type, ...args) {
      const me = this;
      me.forEachListener(type, listener => listener[type].apply(me, args));
    },
  });
}

},{}],40:[function(require,module,exports){
// wrap-function-locals
// © Will Smart 2018. Licence: MIT

// A wrapper for vm allowing both server and client to run amophous code
// The key win here is a mechanism to safely ensure the variables and objects referenced in the code are set

// API is auto-generated at the bottom from the public interface of the CodeSnippet class

const namesFromCodeString = require('./names-from-code-string');
const log = require('../general/log');

const unicodeEscapeRegex = /^(?:(?!\\u)(?:\\.|.|\n))*$/;
function hasUnicodeEscape(string) {
  return !unicodeEscapeRegex.test(string);
}

module.exports = wrapFunctionLocals;

function wrapFunctionLocals(codeString) {
  if (hasUnicodeEscape(codeString)) {
    log('err.code', 'Disallowing code that includes a unicode escape');
    return {};
  }

  const names = namesFromCodeString(codeString),
    nameKeys = Object.keys(names),
    vars = nameKeys.filter(name => !name.includes('.'));

  let wrappedFunction;
  try {
    wrappedFunction = Function(
      '__context',
      'state',
      'model',
      'event',
      'newrow',
      'getDatapoint',
      '"use strict";' + wrappedCodeString({ vars, codeString, isExpression: true })
    );
  } catch (err) {
    try {
      wrappedFunction = Function(
        '__context',
        'state',
        'model',
        'event',
        'newrow',
        'getDatapoint',
        '"use strict";' + wrappedCodeString({ vars, codeString, isExpression: false })
      );
    } catch (err) {
      log('err.code', `Failed to compile code: ${codeString}`);
    }
  }

  return {
    names,
    wrappedFunction,
  };
}

function wrappedCodeString({ vars, codeString, isExpression }) {
  if (!vars.length) {
    if (isExpression) return `return (${codeString});`;
    else return codeString;
  } else {
    const unpackContext = `let ${vars.map(name => `${name} = __context.${name}`).join(',\n    ')};\n`,
      repackContext = vars
        .map(name => `    if (__context.${name} !== ${name}) __context.${name} = ${name};`)
        .join('\n');

    if (isExpression) return `${unpackContext}\nconst __ret = (${codeString});\n\n${repackContext}\nreturn __ret;`;
    else return `${unpackContext}\n${codeString};\n\n${repackContext}`;
  }
}

},{"../general/log":30,"./names-from-code-string":33}],41:[function(require,module,exports){
var upperCase = require('upper-case')
var noCase = require('no-case')

/**
 * Camel case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale, mergeNumbers) {
  var result = noCase(value, locale)

  // Replace periods between numeric entities with an underscore.
  if (!mergeNumbers) {
    result = result.replace(/ (?=\d)/g, '_')
  }

  // Replace spaces between words with an upper cased character.
  return result.replace(/ (.)/g, function (m, $1) {
    return upperCase($1, locale)
  })
}

},{"no-case":52,"upper-case":65}],42:[function(require,module,exports){
exports.no = exports.noCase = require('no-case')
exports.dot = exports.dotCase = require('dot-case')
exports.swap = exports.swapCase = require('swap-case')
exports.path = exports.pathCase = require('path-case')
exports.upper = exports.upperCase = require('upper-case')
exports.lower = exports.lowerCase = require('lower-case')
exports.camel = exports.camelCase = require('camel-case')
exports.snake = exports.snakeCase = require('snake-case')
exports.title = exports.titleCase = require('title-case')
exports.param = exports.paramCase = require('param-case')
exports.header = exports.headerCase = require('header-case')
exports.pascal = exports.pascalCase = require('pascal-case')
exports.constant = exports.constantCase = require('constant-case')
exports.sentence = exports.sentenceCase = require('sentence-case')
exports.isUpper = exports.isUpperCase = require('is-upper-case')
exports.isLower = exports.isLowerCase = require('is-lower-case')
exports.ucFirst = exports.upperCaseFirst = require('upper-case-first')
exports.lcFirst = exports.lowerCaseFirst = require('lower-case-first')

},{"camel-case":41,"constant-case":43,"dot-case":44,"header-case":45,"is-lower-case":46,"is-upper-case":47,"lower-case":51,"lower-case-first":50,"no-case":52,"param-case":56,"pascal-case":57,"path-case":58,"sentence-case":60,"snake-case":61,"swap-case":62,"title-case":63,"upper-case":65,"upper-case-first":64}],43:[function(require,module,exports){
var upperCase = require('upper-case')
var snakeCase = require('snake-case')

/**
 * Constant case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return upperCase(snakeCase(value, locale), locale)
}

},{"snake-case":61,"upper-case":65}],44:[function(require,module,exports){
var noCase = require('no-case')

/**
 * Dot case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '.')
}

},{"no-case":52}],45:[function(require,module,exports){
var noCase = require('no-case')
var upperCase = require('upper-case')

/**
 * Header case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '-').replace(/^.|-./g, function (m) {
    return upperCase(m, locale)
  })
}

},{"no-case":52,"upper-case":65}],46:[function(require,module,exports){
var lowerCase = require('lower-case')

/**
 * Check if a string is lower case.
 *
 * @param  {String}  string
 * @param  {String}  [locale]
 * @return {Boolean}
 */
module.exports = function (string, locale) {
  return lowerCase(string, locale) === string
}

},{"lower-case":51}],47:[function(require,module,exports){
var upperCase = require('upper-case')

/**
 * Check if a string is upper case.
 *
 * @param  {String}  string
 * @param  {String}  [locale]
 * @return {Boolean}
 */
module.exports = function (string, locale) {
  return upperCase(string, locale) === string
}

},{"upper-case":65}],48:[function(require,module,exports){
(function (global){
// https://github.com/maxogden/websocket-stream/blob/48dc3ddf943e5ada668c31ccd94e9186f02fafbd/ws-fallback.js

var ws = null

if (typeof WebSocket !== 'undefined') {
  ws = WebSocket
} else if (typeof MozWebSocket !== 'undefined') {
  ws = MozWebSocket
} else if (typeof global !== 'undefined') {
  ws = global.WebSocket || global.MozWebSocket
} else if (typeof window !== 'undefined') {
  ws = window.WebSocket || window.MozWebSocket
} else if (typeof self !== 'undefined') {
  ws = self.WebSocket || self.MozWebSocket
}

module.exports = ws

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],49:[function(require,module,exports){
exports = module.exports = stringify
exports.getSerialize = serializer

function stringify(obj, replacer, spaces, cycleReplacer) {
  return JSON.stringify(obj, serializer(replacer, cycleReplacer), spaces)
}

function serializer(replacer, cycleReplacer) {
  var stack = [], keys = []

  if (cycleReplacer == null) cycleReplacer = function(key, value) {
    if (stack[0] === value) return "[Circular ~]"
    return "[Circular ~." + keys.slice(0, stack.indexOf(value)).join(".") + "]"
  }

  return function(key, value) {
    if (stack.length > 0) {
      var thisPos = stack.indexOf(this)
      ~thisPos ? stack.splice(thisPos + 1) : stack.push(this)
      ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key)
      if (~stack.indexOf(value)) value = cycleReplacer.call(this, key, value)
    }
    else stack.push(value)

    return replacer == null ? value : replacer.call(this, key, value)
  }
}

},{}],50:[function(require,module,exports){
var lowerCase = require('lower-case')

/**
 * Lower case the first character of a string.
 *
 * @param  {String} str
 * @return {String}
 */
module.exports = function (str, locale) {
  if (str == null) {
    return ''
  }

  str = String(str)

  return lowerCase(str.charAt(0), locale) + str.substr(1)
}

},{"lower-case":51}],51:[function(require,module,exports){
/**
 * Special language-specific overrides.
 *
 * Source: ftp://ftp.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
 *
 * @type {Object}
 */
var LANGUAGES = {
  tr: {
    regexp: /\u0130|\u0049|\u0049\u0307/g,
    map: {
      '\u0130': '\u0069',
      '\u0049': '\u0131',
      '\u0049\u0307': '\u0069'
    }
  },
  az: {
    regexp: /[\u0130]/g,
    map: {
      '\u0130': '\u0069',
      '\u0049': '\u0131',
      '\u0049\u0307': '\u0069'
    }
  },
  lt: {
    regexp: /[\u0049\u004A\u012E\u00CC\u00CD\u0128]/g,
    map: {
      '\u0049': '\u0069\u0307',
      '\u004A': '\u006A\u0307',
      '\u012E': '\u012F\u0307',
      '\u00CC': '\u0069\u0307\u0300',
      '\u00CD': '\u0069\u0307\u0301',
      '\u0128': '\u0069\u0307\u0303'
    }
  }
}

/**
 * Lowercase a string.
 *
 * @param  {String} str
 * @return {String}
 */
module.exports = function (str, locale) {
  var lang = LANGUAGES[locale]

  str = str == null ? '' : String(str)

  if (lang) {
    str = str.replace(lang.regexp, function (m) { return lang.map[m] })
  }

  return str.toLowerCase()
}

},{}],52:[function(require,module,exports){
var lowerCase = require('lower-case')

var NON_WORD_REGEXP = require('./vendor/non-word-regexp')
var CAMEL_CASE_REGEXP = require('./vendor/camel-case-regexp')
var CAMEL_CASE_UPPER_REGEXP = require('./vendor/camel-case-upper-regexp')

/**
 * Sentence case a string.
 *
 * @param  {string} str
 * @param  {string} locale
 * @param  {string} replacement
 * @return {string}
 */
module.exports = function (str, locale, replacement) {
  if (str == null) {
    return ''
  }

  replacement = typeof replacement !== 'string' ? ' ' : replacement

  function replace (match, index, value) {
    if (index === 0 || index === (value.length - match.length)) {
      return ''
    }

    return replacement
  }

  str = String(str)
    // Support camel case ("camelCase" -> "camel Case").
    .replace(CAMEL_CASE_REGEXP, '$1 $2')
    // Support odd camel case ("CAMELCase" -> "CAMEL Case").
    .replace(CAMEL_CASE_UPPER_REGEXP, '$1 $2')
    // Remove all non-word characters and replace with a single space.
    .replace(NON_WORD_REGEXP, replace)

  // Lower case the entire string.
  return lowerCase(str, locale)
}

},{"./vendor/camel-case-regexp":53,"./vendor/camel-case-upper-regexp":54,"./vendor/non-word-regexp":55,"lower-case":51}],53:[function(require,module,exports){
module.exports = /([a-z\xB5\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0529\u052B\u052D\u052F\u0561-\u0587\u13F8-\u13FD\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD0-\u1FD3\u1FD6\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u210A\u210E\u210F\u2113\u212F\u2134\u2139\u213C\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA699\uA69B\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793-\uA795\uA797\uA799\uA79B\uA79D\uA79F\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7B5\uA7B7\uA7FA\uAB30-\uAB5A\uAB60-\uAB65\uAB70-\uABBF\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A0-9\xB2\xB3\xB9\xBC-\xBE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19])([A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AD\uA7B0-\uA7B4\uA7B6\uFF21-\uFF3A])/g

},{}],54:[function(require,module,exports){
module.exports = /([A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AD\uA7B0-\uA7B4\uA7B6\uFF21-\uFF3A])([A-Z\xC0-\xD6\xD8-\xDE\u0100\u0102\u0104\u0106\u0108\u010A\u010C\u010E\u0110\u0112\u0114\u0116\u0118\u011A\u011C\u011E\u0120\u0122\u0124\u0126\u0128\u012A\u012C\u012E\u0130\u0132\u0134\u0136\u0139\u013B\u013D\u013F\u0141\u0143\u0145\u0147\u014A\u014C\u014E\u0150\u0152\u0154\u0156\u0158\u015A\u015C\u015E\u0160\u0162\u0164\u0166\u0168\u016A\u016C\u016E\u0170\u0172\u0174\u0176\u0178\u0179\u017B\u017D\u0181\u0182\u0184\u0186\u0187\u0189-\u018B\u018E-\u0191\u0193\u0194\u0196-\u0198\u019C\u019D\u019F\u01A0\u01A2\u01A4\u01A6\u01A7\u01A9\u01AC\u01AE\u01AF\u01B1-\u01B3\u01B5\u01B7\u01B8\u01BC\u01C4\u01C7\u01CA\u01CD\u01CF\u01D1\u01D3\u01D5\u01D7\u01D9\u01DB\u01DE\u01E0\u01E2\u01E4\u01E6\u01E8\u01EA\u01EC\u01EE\u01F1\u01F4\u01F6-\u01F8\u01FA\u01FC\u01FE\u0200\u0202\u0204\u0206\u0208\u020A\u020C\u020E\u0210\u0212\u0214\u0216\u0218\u021A\u021C\u021E\u0220\u0222\u0224\u0226\u0228\u022A\u022C\u022E\u0230\u0232\u023A\u023B\u023D\u023E\u0241\u0243-\u0246\u0248\u024A\u024C\u024E\u0370\u0372\u0376\u037F\u0386\u0388-\u038A\u038C\u038E\u038F\u0391-\u03A1\u03A3-\u03AB\u03CF\u03D2-\u03D4\u03D8\u03DA\u03DC\u03DE\u03E0\u03E2\u03E4\u03E6\u03E8\u03EA\u03EC\u03EE\u03F4\u03F7\u03F9\u03FA\u03FD-\u042F\u0460\u0462\u0464\u0466\u0468\u046A\u046C\u046E\u0470\u0472\u0474\u0476\u0478\u047A\u047C\u047E\u0480\u048A\u048C\u048E\u0490\u0492\u0494\u0496\u0498\u049A\u049C\u049E\u04A0\u04A2\u04A4\u04A6\u04A8\u04AA\u04AC\u04AE\u04B0\u04B2\u04B4\u04B6\u04B8\u04BA\u04BC\u04BE\u04C0\u04C1\u04C3\u04C5\u04C7\u04C9\u04CB\u04CD\u04D0\u04D2\u04D4\u04D6\u04D8\u04DA\u04DC\u04DE\u04E0\u04E2\u04E4\u04E6\u04E8\u04EA\u04EC\u04EE\u04F0\u04F2\u04F4\u04F6\u04F8\u04FA\u04FC\u04FE\u0500\u0502\u0504\u0506\u0508\u050A\u050C\u050E\u0510\u0512\u0514\u0516\u0518\u051A\u051C\u051E\u0520\u0522\u0524\u0526\u0528\u052A\u052C\u052E\u0531-\u0556\u10A0-\u10C5\u10C7\u10CD\u13A0-\u13F5\u1E00\u1E02\u1E04\u1E06\u1E08\u1E0A\u1E0C\u1E0E\u1E10\u1E12\u1E14\u1E16\u1E18\u1E1A\u1E1C\u1E1E\u1E20\u1E22\u1E24\u1E26\u1E28\u1E2A\u1E2C\u1E2E\u1E30\u1E32\u1E34\u1E36\u1E38\u1E3A\u1E3C\u1E3E\u1E40\u1E42\u1E44\u1E46\u1E48\u1E4A\u1E4C\u1E4E\u1E50\u1E52\u1E54\u1E56\u1E58\u1E5A\u1E5C\u1E5E\u1E60\u1E62\u1E64\u1E66\u1E68\u1E6A\u1E6C\u1E6E\u1E70\u1E72\u1E74\u1E76\u1E78\u1E7A\u1E7C\u1E7E\u1E80\u1E82\u1E84\u1E86\u1E88\u1E8A\u1E8C\u1E8E\u1E90\u1E92\u1E94\u1E9E\u1EA0\u1EA2\u1EA4\u1EA6\u1EA8\u1EAA\u1EAC\u1EAE\u1EB0\u1EB2\u1EB4\u1EB6\u1EB8\u1EBA\u1EBC\u1EBE\u1EC0\u1EC2\u1EC4\u1EC6\u1EC8\u1ECA\u1ECC\u1ECE\u1ED0\u1ED2\u1ED4\u1ED6\u1ED8\u1EDA\u1EDC\u1EDE\u1EE0\u1EE2\u1EE4\u1EE6\u1EE8\u1EEA\u1EEC\u1EEE\u1EF0\u1EF2\u1EF4\u1EF6\u1EF8\u1EFA\u1EFC\u1EFE\u1F08-\u1F0F\u1F18-\u1F1D\u1F28-\u1F2F\u1F38-\u1F3F\u1F48-\u1F4D\u1F59\u1F5B\u1F5D\u1F5F\u1F68-\u1F6F\u1FB8-\u1FBB\u1FC8-\u1FCB\u1FD8-\u1FDB\u1FE8-\u1FEC\u1FF8-\u1FFB\u2102\u2107\u210B-\u210D\u2110-\u2112\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u2130-\u2133\u213E\u213F\u2145\u2183\u2C00-\u2C2E\u2C60\u2C62-\u2C64\u2C67\u2C69\u2C6B\u2C6D-\u2C70\u2C72\u2C75\u2C7E-\u2C80\u2C82\u2C84\u2C86\u2C88\u2C8A\u2C8C\u2C8E\u2C90\u2C92\u2C94\u2C96\u2C98\u2C9A\u2C9C\u2C9E\u2CA0\u2CA2\u2CA4\u2CA6\u2CA8\u2CAA\u2CAC\u2CAE\u2CB0\u2CB2\u2CB4\u2CB6\u2CB8\u2CBA\u2CBC\u2CBE\u2CC0\u2CC2\u2CC4\u2CC6\u2CC8\u2CCA\u2CCC\u2CCE\u2CD0\u2CD2\u2CD4\u2CD6\u2CD8\u2CDA\u2CDC\u2CDE\u2CE0\u2CE2\u2CEB\u2CED\u2CF2\uA640\uA642\uA644\uA646\uA648\uA64A\uA64C\uA64E\uA650\uA652\uA654\uA656\uA658\uA65A\uA65C\uA65E\uA660\uA662\uA664\uA666\uA668\uA66A\uA66C\uA680\uA682\uA684\uA686\uA688\uA68A\uA68C\uA68E\uA690\uA692\uA694\uA696\uA698\uA69A\uA722\uA724\uA726\uA728\uA72A\uA72C\uA72E\uA732\uA734\uA736\uA738\uA73A\uA73C\uA73E\uA740\uA742\uA744\uA746\uA748\uA74A\uA74C\uA74E\uA750\uA752\uA754\uA756\uA758\uA75A\uA75C\uA75E\uA760\uA762\uA764\uA766\uA768\uA76A\uA76C\uA76E\uA779\uA77B\uA77D\uA77E\uA780\uA782\uA784\uA786\uA78B\uA78D\uA790\uA792\uA796\uA798\uA79A\uA79C\uA79E\uA7A0\uA7A2\uA7A4\uA7A6\uA7A8\uA7AA-\uA7AD\uA7B0-\uA7B4\uA7B6\uFF21-\uFF3A][a-z\xB5\xDF-\xF6\xF8-\xFF\u0101\u0103\u0105\u0107\u0109\u010B\u010D\u010F\u0111\u0113\u0115\u0117\u0119\u011B\u011D\u011F\u0121\u0123\u0125\u0127\u0129\u012B\u012D\u012F\u0131\u0133\u0135\u0137\u0138\u013A\u013C\u013E\u0140\u0142\u0144\u0146\u0148\u0149\u014B\u014D\u014F\u0151\u0153\u0155\u0157\u0159\u015B\u015D\u015F\u0161\u0163\u0165\u0167\u0169\u016B\u016D\u016F\u0171\u0173\u0175\u0177\u017A\u017C\u017E-\u0180\u0183\u0185\u0188\u018C\u018D\u0192\u0195\u0199-\u019B\u019E\u01A1\u01A3\u01A5\u01A8\u01AA\u01AB\u01AD\u01B0\u01B4\u01B6\u01B9\u01BA\u01BD-\u01BF\u01C6\u01C9\u01CC\u01CE\u01D0\u01D2\u01D4\u01D6\u01D8\u01DA\u01DC\u01DD\u01DF\u01E1\u01E3\u01E5\u01E7\u01E9\u01EB\u01ED\u01EF\u01F0\u01F3\u01F5\u01F9\u01FB\u01FD\u01FF\u0201\u0203\u0205\u0207\u0209\u020B\u020D\u020F\u0211\u0213\u0215\u0217\u0219\u021B\u021D\u021F\u0221\u0223\u0225\u0227\u0229\u022B\u022D\u022F\u0231\u0233-\u0239\u023C\u023F\u0240\u0242\u0247\u0249\u024B\u024D\u024F-\u0293\u0295-\u02AF\u0371\u0373\u0377\u037B-\u037D\u0390\u03AC-\u03CE\u03D0\u03D1\u03D5-\u03D7\u03D9\u03DB\u03DD\u03DF\u03E1\u03E3\u03E5\u03E7\u03E9\u03EB\u03ED\u03EF-\u03F3\u03F5\u03F8\u03FB\u03FC\u0430-\u045F\u0461\u0463\u0465\u0467\u0469\u046B\u046D\u046F\u0471\u0473\u0475\u0477\u0479\u047B\u047D\u047F\u0481\u048B\u048D\u048F\u0491\u0493\u0495\u0497\u0499\u049B\u049D\u049F\u04A1\u04A3\u04A5\u04A7\u04A9\u04AB\u04AD\u04AF\u04B1\u04B3\u04B5\u04B7\u04B9\u04BB\u04BD\u04BF\u04C2\u04C4\u04C6\u04C8\u04CA\u04CC\u04CE\u04CF\u04D1\u04D3\u04D5\u04D7\u04D9\u04DB\u04DD\u04DF\u04E1\u04E3\u04E5\u04E7\u04E9\u04EB\u04ED\u04EF\u04F1\u04F3\u04F5\u04F7\u04F9\u04FB\u04FD\u04FF\u0501\u0503\u0505\u0507\u0509\u050B\u050D\u050F\u0511\u0513\u0515\u0517\u0519\u051B\u051D\u051F\u0521\u0523\u0525\u0527\u0529\u052B\u052D\u052F\u0561-\u0587\u13F8-\u13FD\u1D00-\u1D2B\u1D6B-\u1D77\u1D79-\u1D9A\u1E01\u1E03\u1E05\u1E07\u1E09\u1E0B\u1E0D\u1E0F\u1E11\u1E13\u1E15\u1E17\u1E19\u1E1B\u1E1D\u1E1F\u1E21\u1E23\u1E25\u1E27\u1E29\u1E2B\u1E2D\u1E2F\u1E31\u1E33\u1E35\u1E37\u1E39\u1E3B\u1E3D\u1E3F\u1E41\u1E43\u1E45\u1E47\u1E49\u1E4B\u1E4D\u1E4F\u1E51\u1E53\u1E55\u1E57\u1E59\u1E5B\u1E5D\u1E5F\u1E61\u1E63\u1E65\u1E67\u1E69\u1E6B\u1E6D\u1E6F\u1E71\u1E73\u1E75\u1E77\u1E79\u1E7B\u1E7D\u1E7F\u1E81\u1E83\u1E85\u1E87\u1E89\u1E8B\u1E8D\u1E8F\u1E91\u1E93\u1E95-\u1E9D\u1E9F\u1EA1\u1EA3\u1EA5\u1EA7\u1EA9\u1EAB\u1EAD\u1EAF\u1EB1\u1EB3\u1EB5\u1EB7\u1EB9\u1EBB\u1EBD\u1EBF\u1EC1\u1EC3\u1EC5\u1EC7\u1EC9\u1ECB\u1ECD\u1ECF\u1ED1\u1ED3\u1ED5\u1ED7\u1ED9\u1EDB\u1EDD\u1EDF\u1EE1\u1EE3\u1EE5\u1EE7\u1EE9\u1EEB\u1EED\u1EEF\u1EF1\u1EF3\u1EF5\u1EF7\u1EF9\u1EFB\u1EFD\u1EFF-\u1F07\u1F10-\u1F15\u1F20-\u1F27\u1F30-\u1F37\u1F40-\u1F45\u1F50-\u1F57\u1F60-\u1F67\u1F70-\u1F7D\u1F80-\u1F87\u1F90-\u1F97\u1FA0-\u1FA7\u1FB0-\u1FB4\u1FB6\u1FB7\u1FBE\u1FC2-\u1FC4\u1FC6\u1FC7\u1FD0-\u1FD3\u1FD6\u1FD7\u1FE0-\u1FE7\u1FF2-\u1FF4\u1FF6\u1FF7\u210A\u210E\u210F\u2113\u212F\u2134\u2139\u213C\u213D\u2146-\u2149\u214E\u2184\u2C30-\u2C5E\u2C61\u2C65\u2C66\u2C68\u2C6A\u2C6C\u2C71\u2C73\u2C74\u2C76-\u2C7B\u2C81\u2C83\u2C85\u2C87\u2C89\u2C8B\u2C8D\u2C8F\u2C91\u2C93\u2C95\u2C97\u2C99\u2C9B\u2C9D\u2C9F\u2CA1\u2CA3\u2CA5\u2CA7\u2CA9\u2CAB\u2CAD\u2CAF\u2CB1\u2CB3\u2CB5\u2CB7\u2CB9\u2CBB\u2CBD\u2CBF\u2CC1\u2CC3\u2CC5\u2CC7\u2CC9\u2CCB\u2CCD\u2CCF\u2CD1\u2CD3\u2CD5\u2CD7\u2CD9\u2CDB\u2CDD\u2CDF\u2CE1\u2CE3\u2CE4\u2CEC\u2CEE\u2CF3\u2D00-\u2D25\u2D27\u2D2D\uA641\uA643\uA645\uA647\uA649\uA64B\uA64D\uA64F\uA651\uA653\uA655\uA657\uA659\uA65B\uA65D\uA65F\uA661\uA663\uA665\uA667\uA669\uA66B\uA66D\uA681\uA683\uA685\uA687\uA689\uA68B\uA68D\uA68F\uA691\uA693\uA695\uA697\uA699\uA69B\uA723\uA725\uA727\uA729\uA72B\uA72D\uA72F-\uA731\uA733\uA735\uA737\uA739\uA73B\uA73D\uA73F\uA741\uA743\uA745\uA747\uA749\uA74B\uA74D\uA74F\uA751\uA753\uA755\uA757\uA759\uA75B\uA75D\uA75F\uA761\uA763\uA765\uA767\uA769\uA76B\uA76D\uA76F\uA771-\uA778\uA77A\uA77C\uA77F\uA781\uA783\uA785\uA787\uA78C\uA78E\uA791\uA793-\uA795\uA797\uA799\uA79B\uA79D\uA79F\uA7A1\uA7A3\uA7A5\uA7A7\uA7A9\uA7B5\uA7B7\uA7FA\uAB30-\uAB5A\uAB60-\uAB65\uAB70-\uABBF\uFB00-\uFB06\uFB13-\uFB17\uFF41-\uFF5A])/g

},{}],55:[function(require,module,exports){
module.exports = /[^A-Za-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B4\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0AF9\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58-\u0C5A\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D5F-\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F5\u13F8-\u13FD\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16F1-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2183\u2184\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005\u3006\u3031-\u3035\u303B\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FD5\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6E5\uA717-\uA71F\uA722-\uA788\uA78B-\uA7AD\uA7B0-\uA7B7\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA8FD\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB65\uAB70-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC0-9\xB2\xB3\xB9\xBC-\xBE\u0660-\u0669\u06F0-\u06F9\u07C0-\u07C9\u0966-\u096F\u09E6-\u09EF\u09F4-\u09F9\u0A66-\u0A6F\u0AE6-\u0AEF\u0B66-\u0B6F\u0B72-\u0B77\u0BE6-\u0BF2\u0C66-\u0C6F\u0C78-\u0C7E\u0CE6-\u0CEF\u0D66-\u0D75\u0DE6-\u0DEF\u0E50-\u0E59\u0ED0-\u0ED9\u0F20-\u0F33\u1040-\u1049\u1090-\u1099\u1369-\u137C\u16EE-\u16F0\u17E0-\u17E9\u17F0-\u17F9\u1810-\u1819\u1946-\u194F\u19D0-\u19DA\u1A80-\u1A89\u1A90-\u1A99\u1B50-\u1B59\u1BB0-\u1BB9\u1C40-\u1C49\u1C50-\u1C59\u2070\u2074-\u2079\u2080-\u2089\u2150-\u2182\u2185-\u2189\u2460-\u249B\u24EA-\u24FF\u2776-\u2793\u2CFD\u3007\u3021-\u3029\u3038-\u303A\u3192-\u3195\u3220-\u3229\u3248-\u324F\u3251-\u325F\u3280-\u3289\u32B1-\u32BF\uA620-\uA629\uA6E6-\uA6EF\uA830-\uA835\uA8D0-\uA8D9\uA900-\uA909\uA9D0-\uA9D9\uA9F0-\uA9F9\uAA50-\uAA59\uABF0-\uABF9\uFF10-\uFF19]+/g

},{}],56:[function(require,module,exports){
var noCase = require('no-case')

/**
 * Param case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '-')
}

},{"no-case":52}],57:[function(require,module,exports){
var camelCase = require('camel-case')
var upperCaseFirst = require('upper-case-first')

/**
 * Pascal case a string.
 *
 * @param  {string}  value
 * @param  {string}  [locale]
 * @param  {boolean} [mergeNumbers]
 * @return {string}
 */
module.exports = function (value, locale, mergeNumbers) {
  return upperCaseFirst(camelCase(value, locale, mergeNumbers), locale)
}

},{"camel-case":41,"upper-case-first":64}],58:[function(require,module,exports){
var noCase = require('no-case')

/**
 * Path case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '/')
}

},{"no-case":52}],59:[function(require,module,exports){
/*
 * random-seed
 * https://github.com/skratchdot/random-seed
 *
 * This code was originally written by Steve Gibson and can be found here:
 *
 * https://www.grc.com/otg/uheprng.htm
 *
 * It was slightly modified for use in node, to pass jshint, and a few additional
 * helper functions were added.
 *
 * Copyright (c) 2013 skratchdot
 * Dual Licensed under the MIT license and the original GRC copyright/license
 * included below.
 */
/*	============================================================================
									Gibson Research Corporation
				UHEPRNG - Ultra High Entropy Pseudo-Random Number Generator
	============================================================================
	LICENSE AND COPYRIGHT:  THIS CODE IS HEREBY RELEASED INTO THE PUBLIC DOMAIN
	Gibson Research Corporation releases and disclaims ALL RIGHTS AND TITLE IN
	THIS CODE OR ANY DERIVATIVES. Anyone may be freely use it for any purpose.
	============================================================================
	This is GRC's cryptographically strong PRNG (pseudo-random number generator)
	for JavaScript. It is driven by 1536 bits of entropy, stored in an array of
	48, 32-bit JavaScript variables.  Since many applications of this generator,
	including ours with the "Off The Grid" Latin Square generator, may require
	the deteriministic re-generation of a sequence of PRNs, this PRNG's initial
	entropic state can be read and written as a static whole, and incrementally
	evolved by pouring new source entropy into the generator's internal state.
	----------------------------------------------------------------------------
	ENDLESS THANKS are due Johannes Baagoe for his careful development of highly
	robust JavaScript implementations of JS PRNGs.  This work was based upon his
	JavaScript "Alea" PRNG which is based upon the extremely robust Multiply-
	With-Carry (MWC) PRNG invented by George Marsaglia. MWC Algorithm References:
	http://www.GRC.com/otg/Marsaglia_PRNGs.pdf
	http://www.GRC.com/otg/Marsaglia_MWC_Generators.pdf
	----------------------------------------------------------------------------
	The quality of this algorithm's pseudo-random numbers have been verified by
	multiple independent researchers. It handily passes the fermilab.ch tests as
	well as the "diehard" and "dieharder" test suites.  For individuals wishing
	to further verify the quality of this algorithm's pseudo-random numbers, a
	256-megabyte file of this algorithm's output may be downloaded from GRC.com,
	and a Microsoft Windows scripting host (WSH) version of this algorithm may be
	downloaded and run from the Windows command prompt to generate unique files
	of any size:
	The Fermilab "ENT" tests: http://fourmilab.ch/random/
	The 256-megabyte sample PRN file at GRC: https://www.GRC.com/otg/uheprng.bin
	The Windows scripting host version: https://www.GRC.com/otg/wsh-uheprng.js
	----------------------------------------------------------------------------
	Qualifying MWC multipliers are: 187884, 686118, 898134, 1104375, 1250205,
	1460910 and 1768863. (We use the largest one that's < 2^21)
	============================================================================ */
'use strict';
var stringify = require('json-stringify-safe');

/*	============================================================================
This is based upon Johannes Baagoe's carefully designed and efficient hash
function for use with JavaScript.  It has a proven "avalanche" effect such
that every bit of the input affects every bit of the output 50% of the time,
which is good.	See: http://baagoe.com/en/RandomMusings/hash/avalanche.xhtml
============================================================================
*/
var Mash = function () {
	var n = 0xefc8249d;
	var mash = function (data) {
		if (data) {
			data = data.toString();
			for (var i = 0; i < data.length; i++) {
				n += data.charCodeAt(i);
				var h = 0.02519603282416938 * n;
				n = h >>> 0;
				h -= n;
				h *= n;
				n = h >>> 0;
				h -= n;
				n += h * 0x100000000; // 2^32
			}
			return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
		} else {
			n = 0xefc8249d;
		}
	};
	return mash;
};

var uheprng = function (seed) {
	return (function () {
		var o = 48; // set the 'order' number of ENTROPY-holding 32-bit values
		var c = 1; // init the 'carry' used by the multiply-with-carry (MWC) algorithm
		var p = o; // init the 'phase' (max-1) of the intermediate variable pointer
		var s = new Array(o); // declare our intermediate variables array
		var i; // general purpose local
		var j; // general purpose local
		var k = 0; // general purpose local

		// when our "uheprng" is initially invoked our PRNG state is initialized from the
		// browser's own local PRNG. This is okay since although its generator might not
		// be wonderful, it's useful for establishing large startup entropy for our usage.
		var mash = new Mash(); // get a pointer to our high-performance "Mash" hash

		// fill the array with initial mash hash values
		for (i = 0; i < o; i++) {
			s[i] = mash(Math.random());
		}

		// this PRIVATE (internal access only) function is the heart of the multiply-with-carry
		// (MWC) PRNG algorithm. When called it returns a pseudo-random number in the form of a
		// 32-bit JavaScript fraction (0.0 to <1.0) it is a PRIVATE function used by the default
		// [0-1] return function, and by the random 'string(n)' function which returns 'n'
		// characters from 33 to 126.
		var rawprng = function () {
			if (++p >= o) {
				p = 0;
			}
			var t = 1768863 * s[p] + c * 2.3283064365386963e-10; // 2^-32
			return s[p] = t - (c = t | 0);
		};

		// this EXPORTED function is the default function returned by this library.
		// The values returned are integers in the range from 0 to range-1. We first
		// obtain two 32-bit fractions (from rawprng) to synthesize a single high
		// resolution 53-bit prng (0 to <1), then we multiply this by the caller's
		// "range" param and take the "floor" to return a equally probable integer.
		var random = function (range) {
			return Math.floor(range * (rawprng() + (rawprng() * 0x200000 | 0) * 1.1102230246251565e-16)); // 2^-53
		};

		// this EXPORTED function 'string(n)' returns a pseudo-random string of
		// 'n' printable characters ranging from chr(33) to chr(126) inclusive.
		random.string = function (count) {
			var i;
			var s = '';
			for (i = 0; i < count; i++) {
				s += String.fromCharCode(33 + random(94));
			}
			return s;
		};

		// this PRIVATE "hash" function is used to evolve the generator's internal
		// entropy state. It is also called by the EXPORTED addEntropy() function
		// which is used to pour entropy into the PRNG.
		var hash = function () {
			var args = Array.prototype.slice.call(arguments);
			for (i = 0; i < args.length; i++) {
				for (j = 0; j < o; j++) {
					s[j] -= mash(args[i]);
					if (s[j] < 0) {
						s[j] += 1;
					}
				}
			}
		};

		// this EXPORTED "clean string" function removes leading and trailing spaces and non-printing
		// control characters, including any embedded carriage-return (CR) and line-feed (LF) characters,
		// from any string it is handed. this is also used by the 'hashstring' function (below) to help
		// users always obtain the same EFFECTIVE uheprng seeding key.
		random.cleanString = function (inStr) {
			inStr = inStr.replace(/(^\s*)|(\s*$)/gi, ''); // remove any/all leading spaces
			inStr = inStr.replace(/[\x00-\x1F]/gi, ''); // remove any/all control characters
			inStr = inStr.replace(/\n /, '\n'); // remove any/all trailing spaces
			return inStr; // return the cleaned up result
		};

		// this EXPORTED "hash string" function hashes the provided character string after first removing
		// any leading or trailing spaces and ignoring any embedded carriage returns (CR) or Line Feeds (LF)
		random.hashString = function (inStr) {
			inStr = random.cleanString(inStr);
			mash(inStr); // use the string to evolve the 'mash' state
			for (i = 0; i < inStr.length; i++) { // scan through the characters in our string
				k = inStr.charCodeAt(i); // get the character code at the location
				for (j = 0; j < o; j++) { //	"mash" it into the UHEPRNG state
					s[j] -= mash(k);
					if (s[j] < 0) {
						s[j] += 1;
					}
				}
			}
		};

		// this EXPORTED function allows you to seed the random generator.
		random.seed = function (seed) {
			if (typeof seed === 'undefined' || seed === null) {
				seed = Math.random();
			}
			if (typeof seed !== 'string') {
				seed = stringify(seed, function (key, value) {
					if (typeof value === 'function') {
						return (value).toString();
					}
					return value;
				});
			}
			random.initState();
			random.hashString(seed);
		};

		// this handy exported function is used to add entropy to our uheprng at any time
		random.addEntropy = function ( /* accept zero or more arguments */ ) {
			var args = [];
			for (i = 0; i < arguments.length; i++) {
				args.push(arguments[i]);
			}
			hash((k++) + (new Date().getTime()) + args.join('') + Math.random());
		};

		// if we want to provide a deterministic startup context for our PRNG,
		// but without directly setting the internal state variables, this allows
		// us to initialize the mash hash and PRNG's internal state before providing
		// some hashing input
		random.initState = function () {
			mash(); // pass a null arg to force mash hash to init
			for (i = 0; i < o; i++) {
				s[i] = mash(' '); // fill the array with initial mash hash values
			}
			c = 1; // init our multiply-with-carry carry
			p = o; // init our phase
		};

		// we use this (optional) exported function to signal the JavaScript interpreter
		// that we're finished using the "Mash" hash function so that it can free up the
		// local "instance variables" is will have been maintaining.  It's not strictly
		// necessary, of course, but it's good JavaScript citizenship.
		random.done = function () {
			mash = null;
		};

		// if we called "uheprng" with a seed value, then execute random.seed() before returning
		if (typeof seed !== 'undefined') {
			random.seed(seed);
		}

		// Returns a random integer between 0 (inclusive) and range (exclusive)
		random.range = function (range) {
			return random(range);
		};

		// Returns a random float between 0 (inclusive) and 1 (exclusive)
		random.random = function () {
			return random(Number.MAX_VALUE - 1) / Number.MAX_VALUE;
		};

		// Returns a random float between min (inclusive) and max (exclusive)
		random.floatBetween = function (min, max) {
			return random.random() * (max - min) + min;
		};

		// Returns a random integer between min (inclusive) and max (inclusive)
		random.intBetween = function (min, max) {
			return Math.floor(random.random() * (max - min + 1)) + min;
		};

		// when our main outer "uheprng" function is called, after setting up our
		// initial variables and entropic state, we return an "instance pointer"
		// to the internal anonymous function which can then be used to access
		// the uheprng's various exported functions.  As with the ".done" function
		// above, we should set the returned value to 'null' once we're finished
		// using any of these functions.
		return random;
	}());
};

// Modification for use in node:
uheprng.create = function (seed) {
	return new uheprng(seed);
};
module.exports = uheprng;

},{"json-stringify-safe":49}],60:[function(require,module,exports){
var noCase = require('no-case')
var upperCaseFirst = require('upper-case-first')

/**
 * Sentence case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return upperCaseFirst(noCase(value, locale), locale)
}

},{"no-case":52,"upper-case-first":64}],61:[function(require,module,exports){
var noCase = require('no-case')

/**
 * Snake case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale, '_')
}

},{"no-case":52}],62:[function(require,module,exports){
var upperCase = require('upper-case')
var lowerCase = require('lower-case')

/**
 * Swap the case of a string. Manually iterate over every character and check
 * instead of replacing certain characters for better unicode support.
 *
 * @param  {String} str
 * @param  {String} [locale]
 * @return {String}
 */
module.exports = function (str, locale) {
  if (str == null) {
    return ''
  }

  var result = ''

  for (var i = 0; i < str.length; i++) {
    var c = str[i]
    var u = upperCase(c, locale)

    result += u === c ? lowerCase(c, locale) : u
  }

  return result
}

},{"lower-case":51,"upper-case":65}],63:[function(require,module,exports){
var noCase = require('no-case')
var upperCase = require('upper-case')

/**
 * Title case a string.
 *
 * @param  {string} value
 * @param  {string} [locale]
 * @return {string}
 */
module.exports = function (value, locale) {
  return noCase(value, locale).replace(/^.| ./g, function (m) {
    return upperCase(m, locale)
  })
}

},{"no-case":52,"upper-case":65}],64:[function(require,module,exports){
var upperCase = require('upper-case')

/**
 * Upper case the first character of a string.
 *
 * @param  {String} str
 * @return {String}
 */
module.exports = function (str, locale) {
  if (str == null) {
    return ''
  }

  str = String(str)

  return upperCase(str.charAt(0), locale) + str.substr(1)
}

},{"upper-case":65}],65:[function(require,module,exports){
/**
 * Special language-specific overrides.
 *
 * Source: ftp://ftp.unicode.org/Public/UCD/latest/ucd/SpecialCasing.txt
 *
 * @type {Object}
 */
var LANGUAGES = {
  tr: {
    regexp: /[\u0069]/g,
    map: {
      '\u0069': '\u0130'
    }
  },
  az: {
    regexp: /[\u0069]/g,
    map: {
      '\u0069': '\u0130'
    }
  },
  lt: {
    regexp: /[\u0069\u006A\u012F]\u0307|\u0069\u0307[\u0300\u0301\u0303]/g,
    map: {
      '\u0069\u0307': '\u0049',
      '\u006A\u0307': '\u004A',
      '\u012F\u0307': '\u012E',
      '\u0069\u0307\u0300': '\u00CC',
      '\u0069\u0307\u0301': '\u00CD',
      '\u0069\u0307\u0303': '\u0128'
    }
  }
}

/**
 * Upper case a string.
 *
 * @param  {String} str
 * @return {String}
 */
module.exports = function (str, locale) {
  var lang = LANGUAGES[locale]

  str = str == null ? '' : String(str)

  if (lang) {
    str = str.replace(lang.regexp, function (m) { return lang.map[m] })
  }

  return str.toUpperCase()
}

},{}],66:[function(require,module,exports){
const WebSocket = require('isomorphic-ws');
const PublicApi = require('../general/public-api');
const makeClassWatchable = require('../general/watchable');
const PageState = require('../client/page-state');
const log = require('../general/log');

// API is auto-generated at the bottom from the public interface of this class

class WebSocketClient {
  // public methods
  static publicMethods() {
    return ['sendMessage', 'sendPayload', 'isOpen', 'watch', 'stopWatching', 'signOut'];
  }

  constructor({ port = 3000 } = {}) {
    const client = this;

    client._isOpen = false;
    client.nextMessageIndex = 1;
    client.clientParams = {
      port: port,
    };

    function open() {
      const host =
        window.location.protocol == 'https:'
          ? `wss://sock.${window.location.host}`
          : `ws://${window.location.hostname}:${port}`;
      const ws = (client.ws = new WebSocket(
        `${host}/sock${client.phoenix ? `?phoenix=${encodeURIComponent(client.phoenix)}` : ''}`
      ));
      delete client.phoenix;
      ws.onopen = function open() {
        client._isOpen = true;
        client.notifyListeners('onopen');

        (client.pongHistory = [0, 0, 0, 1]), (client.pongCount = 1);
      };

      ws.onclose = function close() {
        clearInterval(ws.pingInterval);
        client._isOpen = false;
        client.notifyListeners('onclose');
        delete client.intentionalClose;
        setTimeout(() => open(), client.intentionalClose ? 100 : 2000);
      };

      if (ws.on) {
        ws.on('pong', () => {
          ws.pongHistory[ws.pongHistory.length - 1]++;
          ws.pongCount++;
        });
      }

      ws.onmessage = function incoming(message) {
        const match = /^Phoenix:(.*)$/.exec(message.data);
        if (match) {
          client.phoenix = JSON.parse(match[1]);
          client.intentionalClose = true;
          ws.close();
          return;
        }

        performance.mark('receive');
        log('ws', 'WS>I> Got message from server:   ' + message.data);

        client.notifyListeners(
          'onpayload',
          WebSocketClient.decodeMessage({
            message: message.data,
          })
        );
      };

      ws.onerror = err => {
        log('err', `WS>!> Error: ${err.message}`);
      };

      if (ws.ping) {
        ws.pingInterval = setInterval(function ping() {
          if (!ws.pongCount) {
            client.intentionalClose = true;
            return ws.close();
          }

          ws.pongHistory.push(0);
          clwsient.pongCount -= ws.pongHistory.shift();

          ws.ping('', false, true);
        }, 10000);
      }
    }
    open();

    log('ws', `WS>L> Web socket client listening to server on port ${port}`);
  }

  get isOpen() {
    return this._isOpen;
  }

  static decodeMessage({ message }) {
    const matches = /^(?:(\d+)|(\w+)):/.exec(message),
      messageIndex = matches && matches[1] !== undefined ? +matches[1] : -1,
      messageType = matches && matches[2] !== undefined ? matches[2] : undefined;
    if (matches) message = message.substring(matches[0].length);

    let payloadObject;
    try {
      payloadObject = JSON.parse(message);
    } catch (err) {
      payloadObject = message;
    }
    if (Array.isArray(payloadObject)) {
      payloadObject = {
        array: payloadObject,
      };
    } else if (!payloadObject || typeof payloadObject != 'object') {
      payloadObject = {
        message: `${payloadObject}`,
      };
    }

    return {
      messageIndex,
      messageType,
      payloadObject,
    };
  }
  get cache() {
    return this._cache;
  }

  sendMessage({ message }) {
    this.sendPayload(
      WebSocketClient.decodeMessage({
        message,
      })
    );
  }

  sendPayload({ messageIndex = -1, messageType, payloadObject = {} }) {
    const client = this;

    if (!client.isOpen) return;

    if (messageIndex == -1 && !messageType) messageIndex = client.nextMessageIndex++;
    const message = `${
      messageIndex == -1 ? (messageType ? `${messageType}:` : '') : `${messageIndex}:`
    }${JSON.stringify(payloadObject)}`;
    performance.mark('send');
    log('ws', 'WS>O> Sending message to server:   ' + message);

    client.ws.send(message);
  }

  signOut() {
    const client = this;

    //TODO    SharedState.global.withTemporaryState(tempState => {
    //      tempState.atPath().datapointsById = {};
    //    });
    client.phoenix = 'out';
    client.intentionalClose = true;
    client.ws.close();

    PageState.global.visit('app__default');
  }
}

makeClassWatchable(WebSocketClient);

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketClient,
  hasExposedBackDoor: true,
});

},{"../client/page-state":4,"../general/log":30,"../general/public-api":34,"../general/watchable":39,"isomorphic-ws":48}],67:[function(require,module,exports){
const PublicApi = require('../general/public-api');
const log = require('../general/log');
const isEqual = require('../general/is-equal');

// API is auto-generated at the bottom from the public interface of the WebSocketProtocol class

class WebSocketDatapoint {
  constructor({ datapointId, wsp }) {
    const wsd = this,
      { cache } = wsp;

    const datapoint = cache.getOrCreateDatapoint(datapointId);

    Object.assign(wsd, {
      datapointId,
      datapoint,
      wsp,
      myVersion: 1,
      theirVersion: 1,
      myValue: undefined,
      resolvers: [],
    });

    datapoint.deletionCallbacks.push(() => wsp.deleteDatapoint(datapointId));

    wsp.queueSendDatapoint(datapointId);
  }

  get valueIfAny() {
    return this.myValue;
  }

  get value() {
    const wsd = this,
      { myVersion, theirVersion } = wsd;
    if (theirVersion > 1 && myVersion >= theirVersion) return wsd.myValue;
    return new Promise(resolve => {
      wsd.resolvers.push(resolve);
    });
  }

  setValue(newValue) {
    const wsd = this,
      { myVersion, theirVersion, datapointId, resolvers, wsp } = wsd;
    wsd.myVersion = Math.floor((Math.max(myVersion, theirVersion) + 1) / 2) * 2 + 1;
    wsd.myValue = newValue;

    if (resolvers.length) {
      wsd.resolvers = [];
      for (const resolver of resolvers) {
        resolver(newValue);
      }
    }
    wsp.queueSendDatapoint(datapointId);
  }
}

class WebSocketProtocol {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({ cache, ws }) {
    const wsp = this;

    Object.assign(wsp, {
      cache,
      ws,
      datapoints: {},
      sendDelay: 10,
      queueTimeout: undefined,
      queuedDatapoints: {},
      client: undefined,
    });

    cache.getterSetterInfo.finders.push(function({ datapoint, cache, schema }) {
      const { typeName, datapointId } = datapoint,
        type = schema.allTypes[typeName];

      if (!type || datapoint.isClient) return;

      return {
        getter: {
          fn: () => wsp.getOrCreateDatapoint(datapointId).value,
        },
        setter: {
          fn: newValue => {
            wsp.getOrCreateDatapoint(datapointId).setValue(newValue);
            return newValue;
          },
        },
      };
    });

    ws.watch({
      callbackKey: 'wsp',
      onclose: () => {
        wsp.client = undefined;

        for (const wsd of Object.values(wsp.datapoints)) {
          wsd.myVersion = wsd.myVersion > wsd.theirVersion ? 3 : 1;
          wsd.theirVersion = 2;
        }
      },
      onopen: client => {
        wsp.client = ws;
        wsp.queueSendDatapoint();
      },
      onpayload: ({ messageType, payloadObject }) => {
        if (messageType == 'datapoints' || !payloadObject || typeof payloadObject != 'object') {
          for (const [datapointId, payloadValue] of Object.entries(payloadObject)) {
            const wsd = wsp.getOrCreateDatapoint(datapointId);
            if (typeof payloadValue == 'number') {
              const version = payloadValue;
              if (wsd.theirVersion == version) continue;
              wsd.theirVersion = version;
              if (wsd.myVersion != version) {
                wsp.queueSendDatapoint(datapointId);
              }
            } else if (payloadValue && typeof payloadValue == 'object' && payloadValue.version) {
              const { version, value } = payloadValue;
              if (wsd.theirVersion == version) continue;
              wsd.theirVersion = version;
              if (wsd.myVersion != version) {
                if (wsd.myVersion > version) {
                  wsp.queueSendDatapoint(datapointId);
                }
                if (wsd.myVersion < version) {
                  wsd.myVersion = version;
                  if (!isEqual(value, wsd.myValue, { exact: true })) {
                    wsd.myValue = value;
                    wsd.datapoint.invalidate();
                  }
                  const { resolvers } = wsd;
                  if (resolvers.length) {
                    wsd.resolvers = [];
                    for (const resolver of resolvers) {
                      resolver(value);
                    }
                  }
                }
              }
            }
          }
        }
      },
    });
  }

  getExistingDatapoint(datapointId) {
    const wsp = this,
      { datapoints } = wsp;
    return datapoints[datapointId];
  }

  getOrCreateDatapoint(datapointId) {
    const wsp = this,
      { datapoints } = wsp,
      existingDatapoint = datapoints[datapointId];
    if (existingDatapoint) return existingDatapoint;
    return (datapoints[datapointId] = new WebSocketDatapoint({ datapointId, wsp }));
  }

  deleteDatapoint(datapointId) {
    const wsp = this,
      { datapoints } = wsp;
    delete datapoints[datapointId];
    wsp.queueSendDatapoint(datapointId);
  }

  queueSendDatapoint(datapointId) {
    const wsp = this,
      { queuedDatapoints, sendDelay } = wsp;

    if (datapointId) queuedDatapoints[datapointId] = true;

    if (!wsp.queueTimeout)
      wsp.queueTimeout = setTimeout(() => {
        wsp.queueTimeout = undefined;
        wsp.goSendDatapoints();
      }, sendDelay);
  }

  goSendDatapoints() {
    const wsp = this,
      { queuedDatapoints, datapoints, client } = wsp,
      datapointIds = Object.keys(queuedDatapoints);

    if (!client) return;

    wsp.queuedDatapoints = {};

    const payloadObject = {};

    for (const datapointId of datapointIds) {
      const wsd = datapoints[datapointId];

      if (!wsd) {
        payloadObject[datapointId] = false;
      } else if (wsd.myVersion == wsd.theirVersion) {
        payloadObject[datapointId] = wsd.myVersion;
      } else if (wsd.myVersion > wsd.theirVersion) {
        payloadObject[datapointId] = {
          version: wsd.myVersion,
          value: wsd.myValue,
        };
      }
    }

    if (!Object.keys(payloadObject).length) return;

    client.sendPayload({ messageType: 'datapoints', payloadObject });
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: WebSocketProtocol,
  hasExposedBackDoor: true,
});

},{"../general/is-equal":28,"../general/log":30,"../general/public-api":34}]},{},[2]);
