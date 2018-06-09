const PublicApi = require('../general/public-api');
const ConvertIds = require('../convert-ids');
const SharedState = require('../general/shared-state');

let globalPageState;

// API is auto-generated at the bottom from the public interface of this class

class PageState {
  // public methods
  static publicMethods() {
    return ['visit', 'global'];
  }

  constructor({ getDatapoint, defaultPageDatapointInfo } = {}) {
    const pageState = this;

    globalPageState = pageState;

    pageState.defaultPageDatapointInfo =
      defaultPageDatapointInfo ||
      ConvertIds.recomposeId({
        typeName: 'app',
        dbRowId: 1,
        fieldName: '',
      });

    pageState.getDatapoint = getDatapoint;

    window.onpopstate = event => {
      const pageState = this;

      pageState.visit();
    };

    pageState.callbackKey = SharedState.global.watch({
      onchangedstate: function(diff, changes, forEachChangedKeyPath) {
        forEachChangedKeyPath((keyPath, change) => {
          switch (keyPath.length) {
            case 0:
              return true;
            case 1:
              return keyPath[0] == 'datapointsById';
            case 2:
              if (keyPath[0] == 'datapointsById') {
                if (keyPath[1] == 'page' && Array.isArray(change.is)) {
                  pageState.visit(change.is.length && typeof change[0] == 'string' ? change.is[0] : undefined);
                }
                if (keyPath[1] == PageState.currentWindowState.titleDatapointId) {
                  pageState.updateState(PageState.currentWindowState.pageDatapointId);
                }
              }
            default:
              return false;
          }
        });
      },
    });
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

    const state = pageState.updateState(rowOrDatapointId);

    SharedState.global.withTemporaryState(
      tempState => (tempState.atPath('datapointsById').page = [state.pageDatapointId])
    );
  }

  updateState(rowOrDatapointId) {
    const pageState = this;

    let pageDatapointInfo = ConvertIds.proxyableDatapointRegex.test(rowOrDatapointId)
      ? ConvertIds.recomposeId({
          proxyableDatapointId: rowOrDatapointId,
          permissive: true,
        })
      : ConvertIds.recomposeId({
          proxyableRowId: rowOrDatapointId,
          fieldName: '',
          permissive: true,
        });
    if (!pageDatapointInfo) {
      pageDatapointInfo = PageState.datapointInfoFromPath;
      if (!pageDatapointInfo) {
        pageDatapointInfo = pageState.defaultPageDatapointInfo;
      }
    }
    const pageDatapointId = pageDatapointInfo.proxyableDatapointId,
      titleDatapointId = ConvertIds.recomposeId(pageDatapointInfo, {
        fieldName: 'name',
      }).proxyableDatapointId;

    const title = pageState.getDatapoint(titleDatapointId, '');

    const oldState = PageState.currentWindowState,
      newState = {
        nobo: true,
        pageDatapointId,
        titleDatapointId,
        title,
      };

    if (!oldState.nobo) {
      window.history.replaceState(newState, title, pageState.pathNameForState(newState));
    } else if (newState.pageDatapointId == oldState.pageDatapointId) {
      if (newState.title != oldState.title) {
        window.history.replaceState(newState, title, pageState.pathNameForState(newState));
      }
    } else {
      window.history.pushState(newState, title, pageState.pathNameForState(newState));
    }

    return newState;
  }

  pathNameForState(state) {
    const pageState = this,
      datapointInfo = ConvertIds.decomposeId({ proxyableDatapointId: state.pageDatapointId, permissive: true });
    if (!datapointInfo) return;
    const regex = /(?=((?:[\!\$&'\(\)\*\+,;=a-zA-Z0-9\-._~:@\/?]|%[0-9a-fA-F]{2})*))\1./g,
      titleForFragment = !state.title ? undefined : state.title.substring(0, 100).replace(regex, '$1-');

    const dbRowIdOrProxyKey =
      datapointInfo.proxyKey == 'default' ? '' : datapointInfo.dbRowId || datapointInfo.proxyKey;
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
