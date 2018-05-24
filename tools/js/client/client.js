const ClientDatapoints = require("./client-datapoints"),
  WebSocketClient = require("./web-socket-client"),
  SharedState = require("./shared-state");

document.nobo = {
  ClientDatapoints,
  WebSocketClient,
  SharedState
}


function testScript() {
  const {
    SharedState,
    ClientDatapoints,
    WebSocketClient
  } = document.nobo
  document.nobo.datapoints = new document.nobo.ClientDatapoints()
  SharedState.global.watch({
    onchangedstate: function (diff, changes) {
      console.log(`>> Stage change: ${JSON.stringify(diff)}`)
    }
  })
  SharedState.requestCommit(state => state.atPath('subscriptions').user__1__app_name = true)
}