const PageState = require('./page-state'),
  WebSocketClient = require('../web-socket/web-socket-client'),
  WebSocketProtocol = require('../web-socket/web-socket-protocol-client'),
  DomFunctions = require('../dom/dom-functions'),
  { htmlToElement, describeTree } = require('../dom/dom-functions'),
  DatapointCache = require('../datapoints/cache/datapoint-cache'),
  installDomDatapointGetterSetters = require('../dom/datapoint-getter-setters/install'),
  Schema = require('../general/schema'),
  appClient = require('./app-client'),
  log = require('../general/log'),
  installDraggable = require('./draggable');

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

installDraggable({ cache });

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
