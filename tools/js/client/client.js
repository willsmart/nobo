const PageState = require('./page-state'),
  WebSocketClient = require('../web-socket/web-socket-client'),
  WebSocketProtocol = require('../web-socket/web-socket-protocol'),
  DomGenerator = require('../dom/dom-generator'),
  DomUpdater = require('../dom/dom-updater'),
  DomFunctions = require('../dom/dom-functions'),
  { htmlToElement } = require('../dom/dom-functions'),
  ClientActions = require('./client-actions'),
  DatapointCache = require('../datapoints/cache/datapoint-cache'),
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
  wsprotocol = new WebSocketProtocol({ cache, ws: wsclient, isServer: false }),
  domGenerator = new DomGenerator({
    htmlToElement,
    cache,
  }),
  domUpdater = new DomUpdater({
    domGenerator,
    cache,
  }),
  pageState = new PageState({
    cache,
  }),
  clientActions = new ClientActions({ domGenerator: domGenerator });

domGenerator.prepPage();

pageState.visit();

window.nobo = {
  PageState,
  WebSocketClient,
  WebSocketProtocol,
  DomGenerator,
  DomUpdater,
  DomFunctions,
  DatapointCache,
  Schema,
  appDbRowId,
  schema,
  wsclient,
  cache,
  domGenerator,
  domUpdater,
  pageState,
  clientActions,
  appClient,
  wsprotocol,
  log,
};
