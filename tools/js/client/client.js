const ClientDatapoints = require('./client-datapoints'),
  PageState = require('./page-state'),
  WebSocketClient = require('./web-socket-client'),
  SharedState = require('../general/shared-state'),
  DomGenerator = require('../dom/dom-generator'),
  DomUpdater = require('../dom/dom-updater'),
  DomFunctions = require('../dom/dom-functions'),
  ConvertIds = require('../convert-ids'),
  { htmlToElement } = require('../dom/dom-functions'),
  ClientActions = require('./client-actions'),
  DatapointConnection = require('./client-datapoint-connection'),
  { DatapointCache, Schema } = require('../datapoint-cache-module');

document.nobo = {
  ClientDatapoints,
  PageState,
  WebSocketClient,
  SharedState,
  DomGenerator,
  DomFunctions,
  DomUpdater,
  DatapointConnection,
  DatapointCache,
  Schema,
};

const schema = (document.nobo.schema = new Schema());
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

document.nobo.wsclient = new WebSocketClient();
document.nobo.datapoints = new document.nobo.ClientDatapoints({ wsclient: document.nobo.wsclient });
document.nobo.datapointConnection = new DatapointConnection({ clientDatapoints: document.nobo.datapoints });
document.nobo.cache = new DatapointCache({
  schema: document.nobo.schema,
  datapointConnection: document.nobo.datapointConnection,
});

const getDatapoint = (proxyableDatapointId, defaultValue) =>
  document.nobo.datapoints.getDatapoint(proxyableDatapointId, defaultValue);

document.nobo.domGenerator = new document.nobo.DomGenerator({
  htmlToElement,
  getDatapoint,
});
document.nobo.domUpdater = new document.nobo.DomUpdater({
  domGenerator: document.nobo.domGenerator,
});
document.nobo.pageState = new document.nobo.PageState({
  getDatapoint,
});

document.nobo.clientActions = new ClientActions({ domGenerator: document.nobo.domGenerator });

SharedState.global.watch({
  onchangedstate: function(diff, changes) {
    console.log(`>> State change: ${JSON.stringify(diff)}`);
  },
});

document.nobo.pageState.visit();
