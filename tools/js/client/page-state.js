const PublicApi = require('../general/public-api');
const ConvertIds = require('../datapoints/convert-ids');

let globalPageState;

const callbackKey = 'page-state';

// API is auto-generated at the bottom from the public interface of this class

class PageState {
  // public methods
  static publicMethods() {
    return ['visit', 'global'];
  }

  constructor({ cache, defaultPageDatapointInfo } = {}) {
    const pageState = this;

    let itemsDatapoint = (pageState.itemsDatapoint = cache.getOrCreateDatapoint( 'page__1__items' ));
    itemsDatapoint.setIsClient();

    itemsDatapoint.setVirtualField({
      getterFunction: () => {
        const state = PageState.currentWindowState;
        return state && state.pageDatapointId ? [state.pageDatapointId] : [];
      },
      isId: true,
      isMultiple: true,
    });

    itemsDatapoint.watch({
      callbackKey,
      onchange: datapoint => {
        const items = datapoint.valueIfAny;
        if (Array.isArray(items)) {
          pageState.visit(items.length && typeof items[0] == 'string' ? items[0] : undefined);
        }
      },
    });

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

    const titleDatapoint = pageState.cache.getOrCreateDatapoint( titleDatapointId );
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
