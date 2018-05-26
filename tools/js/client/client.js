const ClientDatapoints = require("./client-datapoints"),
  WebSocketClient = require("./web-socket-client"),
  SharedState = require("./shared-state");
ClientDom = require("./client-dom");

document.nobo = {
  ClientDatapoints,
  WebSocketClient,
  SharedState,
  ClientDom
};

document.nobo.datapoints = new document.nobo.ClientDatapoints();
document.nobo.dom = new document.nobo.ClientDom({ clientDatapoints: document.nobo.datapoints });

SharedState.global.watch({
  onchangedstate: function(diff, changes) {
    console.log(`>> Stage change: ${JSON.stringify(diff)}`);
  }
});

function testScript() {
  const { SharedState, ClientDatapoints, WebSocketClient } = document.nobo;
  SharedState.requestCommit(state => (state.atPath("subscriptions").user__1__app_name = true));
}
