const ConvertIds = require('../datapoints/convert-ids');

module.exports = ({ cache }) => {
  cache.watch({
    callbackKey: 'draggable',
    onnewelement: ({ cache, forEachDescendent }) => {
      forEachDescendent((element, rowInfo) => {
        if (element.classList.contains('nobo-draggable')) {
          element.setAttribute('draggable', 'true');

          element.ondragstart = event => {
            const transfer = event.dataTransfer;
            if (!transfer) return;
            transfer.setData('context', element.getAttribute('drag-context'));

            const dataDatapointId = ConvertIds.recomposeId(rowInfo, { fieldName: 'attributeDragData' }).datapointId;
            cache.getOrCreateDatapoint(dataDatapointId).value.then(data => {
              switch (typeof data) {
                case 'object':
                  if (data) {
                    for (const [key, value] of Object.entries(data)) {
                      transfer.setData(key, value);
                    }
                    return;
                  }
                case 'function':
                  break;
                default:
                  transfer.setData('text/plain', String(data));
                  break;
              }
            });

            return (transfer.effectAllowed = 'move');
          };
        }

        if (element.classList.contains('nobo-dragee')) {
          element.ondragover = event => {
            event.dataTransfer.dropEffect = 'move';
            event.preventDefault();
            return;
          };

          element.ondragleave = () => {
            event.dataTransfer.dropEffect = undefined;
            element.removeAttribute('has-drag');
            return;
          };

          element.ondragenter = event => {
            element.setAttribute('has-drag', '1');

            const { fromElement } = event;
            if (!fromElement) return;

            if (fromElement.getAttribute('drag-context') !== event.target.getAttribute('drag-context')) {
              return;
            }
            event.preventDefault();
            return;
          };

          element.ondrop = event => {
            element.removeAttribute('has-drag');

            const { dataTransfer: transfer } = event;
            if (!transfer) return;

            const { types } = transfer,
              data = {};
            for (const type of types) {
              data[type] = transfer.getData(type);
            }
            if (element.getAttribute('drag-context') && context != element.getAttribute('drag-context')) return;

            const dropEventDatapointId = ConvertIds.recomposeId(rowInfo, { fieldName: 'attributeDropEvent' })
              .datapointId;
            cache.getOrCreateDatapoint(dropEventDatapointId).fireEvent(data);
            event.preventDefault();
            return;
          };
        }
      });
    },
  });
};
