const PublicApi = require("../general/public-api");

// API is auto-generated at the bottom from the public interface of the WSServerDatapoints class

const SharedState = require("./shared-state");

const callbackKey = 'ClientDom'

class ClientDom {
  // public methods
  static publicMethods() {
    return [];
  }

  constructor({
    clientDatapoints
  }) {
    const clientDom = this

    clientDom.clientDatapoints = clientDatapoints;

    clientDom.nextUid = 1

    SharedState.global.watch({
      callbackKey: 'adjust-divs',
      onchangedstate: (diff, changes, forEachChangedKeyPath) => {
        let payloadObject

        let subscribe = {}

        forEachChangedKeyPath((keyPath, change) => {
          if (!keyPath.length || keyPath[0] != 'datapointsById') return;
          if (keyPath.length == 1) return true;
          const datapointId = keyPath[1];
          if (!ConvertIds.datapointRegex.test(datapointId)) return;

          if (keyPath.length == 2) {
            if (Array.isArray(change.is)) return true

            clientDom.updateFieldValue({
              datapointId,
              was: change.was,
              is: change.is
            })
          } else if (keyPath.length == 3 && typeof (keyPath[3]) == 'number') {
            const
              wasRowId = (typeof (change.was) == 'string' && ConvertIds.rowRegex.test(change.was) ? change.was : undefined),
              isRowId = (typeof (change.is) == 'string' && ConvertIds.rowRegex.test(change.is) ? change.is : undefined)

            if (wasRowId == isRowId) return;

            if (change.type == 'change' || change.type == 'delete') {
              clientDom.deleteDOMChild({
                datapointId,
                index: keyPath[2],
                rowId: wasRowId
              })
            }
            if (change.type == 'change' || change.type == 'insert') {
              clientDom.insertDOMChild({
                datapointId,
                index: keyPath[2],
                rowId: isRowId,
                subscribe
              })
            }
          }
        })

        if (Object.keys(subscribe).length) clientDatapoints.subscribe(subscribe)
      }
    })
  }

  classForDatapointChildPlaceholder({
    datapointId
  }) {
    return `${datapointId}__children`
  }

  classAsDatapointChild({
    placeholderDiv
  }) {
    return `child_of_${placeholderDiv.id}`
  }

  getPlaceholderChildUids({
    placeholderDiv
  }) {
    return placeholder.getAttribute('childuids').split(' ')
  }

  setPlaceholderChildUids({
    placeholderDiv,
    placeholderChildUids
  }) {
    return placeholder.setAttribute('childuids', placeholderChildUids.join(' '))
  }

  classForDatapointField({
    datapointId,
  }) {
    return `${datapointId}__field`
  }

  classForDatapointTemplateField({
    datapointId,
  }) {
    return `${datapointId}__template`
  }

  classForDatapointDomField({
    datapointId,
  }) {
    return `${datapointId}__dom`
  }

  updateFieldValue({
    datapointId,
    was,
    is
  }) {}

  findChildAtIndex({
    placeholderDiv,
    index
  }) {
    const clientDom = this;

    if (index < -1) return;
    if (index == -1) return placeholderDiv;

    const classAsChild = clientDom.classAsDatapointChild({
      placeholderDiv
    })

    function nextElement(div) {
      for (div = div.nextElement; div && !div.classList.contains(classAsChild); div = div.nextElement);
      return div;
    }

    let childElement = placeholderDiv;
    for (let childIndex = -1; childIndex < index; childIndex++) childElement = nextElement(childElement);
    return childElement;
  }

  insertDOMChild({
    parentDatapointId,
    index,
    rowId,
    datapointsById,
    subscribe
  }) {
    const clientDom = this

    const placeholderDivs = document.getElementsByClassName(clientDom.classForDatapointChildPlaceholder({
      datapointId: parentDatapointId
    }))
    for (const placeholderDiv of placeholderDivs) {
      clientDom.insertSpecificDOMChild({
        placeholderDiv,
        index,
        rowId,
        datapointsById,
        subscribe
      })
    }
  }

  insertSpecificDOMChild({
    placeholderDiv,
    index,
    rowId,
    datapointsById,
    subscribe
  }) {
    const clientDom = this


    let afterElement = clientDom.findChildAtIndex({
      placeholderDiv,
      index: index - 1
    })

    const
      variant = placeholderDiv.getAttribute('variant'),
      childElement = childElement.createChild({
        rowId,
        variant,
        datapointsById,
        subscribe
      })

    afterElement.insertAdjacentElement('afterend', childElement)

    return childElement
  }

  createChild({
    rowId,
    variant,
    datapointsById,
    subscribe
  }) {
    const
      subscribe = {},
      decomposedRowId = ConvertIds.decomposeId({
          rowId
        },
        templateDatapointId = ConvertIds.recomposeId(Object.assign(decomposedRowId, {
          variant: `template_${ChangeCase.snakeCase(variant)}`
        }))).datapointId,
      templateDatapoint = datapointsById[templateDatapointId];

    let domDatapointId, dom

    if (templateDatapoint === undefined) subscribe[templateDatapointId] = 1;
    else if (Array.isArray(templateDatapoint) && templateDatapoint.length == 1 && ConvertIds.rowRegex.test(templateDatapoint[0])) {
      domDatapointId = ConvertIds.recomposeId(Object.assign(ConvertIds.decomposeId({
        rowId: templateDatapoint[0]
      }, {
        variant: 'dom'
      }))).datapointId

      dom = datapointsById[domDatapointId];

      if (dom === undefined) subscribe[domDatapointId] = 1;
    }

    const defaultDom = '<div></div>'
    if (typeof (dom) != 'string') dom = defaultDom

    let childElement = ClientDom.htmlToElement(dom);
    if (!childElement) childElement = ClientDom.htmlToElement(defaultDom);

    clientDom.prepDomTree({
      element: childElement,
      templateDatapointId,
      domDatapointId,
      decomposedRowId,
      subscribe,
      datapointsById
    })
  }

  prepDomTree({
    element,
    templateDatapointId,
    domDatapointId,
    decomposedRowId,
    subscribe,
    datapointsById
  }) {
    const clientDom = this;

    clientDom.prepDomSubtree({
      element,
      decomposedRowId,
      subscribe,
      datapointsById
    })

    if (templateDatapointId) {
      element.classList.add(clientDom.classForDatapointTemplateField({
        datapointId: templateDatapointId
      }))
    }

    if (domDatapointId) {
      element.classList.add(clientDom.classForDatapointDomField({
        datapointId: domDatapointId
      }))
    }
  }

  prepDomSubtree({
    element,
    decomposedRowId,
    subscribe,
    datapointsById
  }) {
    const clientDom = this;

    for (const className of element.classList) {
      const match = /^(\w+)-model-child$/.exec(className)
      if (match) {
        const
          fieldName = ChangeCase.snakeCase(match[1]),
          datapointId = ConvertIds.recomposeId(decomposedRowId, {
            fieldName
          })

        if (element.style.display && !element.style.getAttribute('nobo-style-display')) {
          element.style.setAttribute('nobo-style-display', element.style.display);
        }
        element.style.display = 'none'
        element.id = `nobo-${clientDom.nextUid++}`

        element.classList.add(clientDom.classForDatapointChildPlaceholder({
          datapointId
        }))

        const datapoint = datapointsById[datapointId];
        if (datapoint === undefined) subscribe[datapointId] = true;
        else if (Array.isArray(datapoint)) {
          const variant = element.getAttribute('variant')

          for (let index = 0; index < datapoint; index++) {
            const rowId = typeof (datapoint[index]) == 'string' && ConvertIds.rowRegex.test(datapoint[index]) ? datapoint[index] : undefined
            const childElement = clientDom.insertSpecificDOMChild({
              placeholderDiv: element,
              index,
              rowId,
              datapointsById,
              subscribe
            })

            childElement.classList.add(clientDom.classAsDatapointChild({
              placeholderDiv: element
            }))
          }
        }
      }
    }
  }


  deleteDOMChild({
    datapointId,
    index,
    rowId
  }) {
    const clientDom = this

    const placeholderDivs = document.getElementsByClassName(clientDom.classForDatapointChildPlaceholder)
    for (const placeholderDiv of placeholderDivs) {
      let childElement = placeholderDiv.nextElementSibling
      for (let childIndex = 0; childIndex < index; childIndex++) childElement = childElement.nextElementSibling;
      childElement.parentElement.removeChild(childElement)
    }
  }


  static htmlToElement(html) {
    var template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }
}


// API is the public facing class
module.exports = PublicApi({
  fromClass: ClientDom,
  hasExposedBackDoor: true
});