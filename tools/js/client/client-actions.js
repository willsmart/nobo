const PublicApi = require('../general/public-api');
const ConvertIds = require('../datapoints/convert-ids');
const PageState = require('./page-state');
const { uniquePathForElement } = require('../dom/dom-functions');

let globalClientActions;
const callbackKey = 'client-actions';

// API is auto-generated at the bottom from the public interface of this class

class ClientActions {
  // public methods
  static publicMethods() {
    return ['installOnElement'];
  }

  constructor({ domGenerator } = {}) {
    const clientActions = this;

    clientActions.nextElementIndex = 1;

    if (!globalClientActions) globalClientActions = clientActions;

    clientActions.domGenerator = domGenerator;
    domGenerator.watch({
      callbackKey,
      onprepelement: ({ element, rowId }) => {
        clientActions.installOnElement({ element, rowId });
      },
    });
  }

  installOnElement({ element, rowId }) {
    if (
      element.classList.contains('pushModel') ||
      element.hasAttribute('pushmodel') ||
      element.hasAttribute('pushvariant')
    )
      do {
        let pushModel = element.getAttribute('pushmodel') || rowId;
        if (ConvertIds.rowRegex.test(pushModel) && element.hasAttribute('pushvariant')) {
          const modelInfo = ConvertIds.recomposeId({
            rowId: pushModel,
            fieldName: element.getAttribute('pushvariant'),
          });
          if (!modelInfo) break;
          pushModel = modelInfo.datapointId;
        }
        if (!pushModel) break;
        element.addEventListener('click', () => {
          PageState.global.visit(pushModel);
        });
      } while (0);

    let value;
    if ((value = element.getAttribute('clickvariant')) && ConvertIds.fieldNameRegex.test(value)) {
      element.addEventListener('click', () => {
        const path = uniquePathForElement(element);
        //TODO SharedState.global.withTemporaryState(state => (state.atPath('overriddenElementDatapoints')[path] = value));
      });
    }
  }
}

// API is the public facing class
module.exports = PublicApi({
  fromClass: ClientActions,
  hasExposedBackDoor: true,
});
