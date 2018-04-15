/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_server;
if (!document.ModelDOM_classes) {
  document.ModelDOM_classes = {};
}
document.ModelDOM_classes.ModelDOM_server = ModelDOM_server = class ModelDOM_server {
  constructor() {
    let match;
    this.latestAllModelsBody = this.latestAllModelsBody.bind(this);
    this.latestRootModelBody = this.latestRootModelBody.bind(this);
    this.latestSubscriptionBody = this.latestSubscriptionBody.bind(this);
    this.processLatest = this.processLatest.bind(this);
    this.submitWSMessage = this.submitWSMessage.bind(this);
    this.open = this.open.bind(this);
    this._open = this._open.bind(this);
    this.close = this.close.bind(this);
    this.send = this.send.bind(this);
    this.sendDiff = this.sendDiff.bind(this);
    this.callbackOfType = this.callbackOfType.bind(this);
    this.sendAllModels = this.sendAllModels.bind(this);
    this.sendAllModelsNow = this.sendAllModelsNow.bind(this);
    this.sendRootModel = this.sendRootModel.bind(this);
    this.sendRootModelNow = this.sendRootModelNow.bind(this);
    this.sendModels = this.sendModels.bind(this);
    this.sendModelsNow = this.sendModelsNow.bind(this);
    this._sendi = 1;
    this._NconnectFail = 0;
    this._sendsWhileClosed = [];
    this._sends = {};
    this._serverModels = null;
    this._sendAllModelsTimer = undefined;
    this._sendModelsTimer = undefined;

    this._updatingModels = false;
    this._updatingModelsTimer = undefined;

    this.ackModels = {};

    const isLocal =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname.endsWith(".local") ||
      /192.168.1.\d{1,3}/.test(window.location.hostname);
    this.wsProtocol = isLocal ? "ws://" : "wss://";

    let { hostname } = window.location;
    if ((match = hostname.match(/\.s3-website.*\.amazonaws\.com/))) {
      hostname = hostname.substring(0, match.index);
    }
    const sockPrefix = isLocal || hostname.match(/\..*\./) ? "" : "sock.";
    this.apiHostname = sockPrefix + hostname + ":3100";
  }

  latestAllModelsBody(asObj) {
    //if @_doDebugCall then return @debugCall("latestAllModelsBody",["asObj"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    let body = {
      subscribe: {},
      unsubscribe: "all"
    };
    for (let id in this.models) {
      const model = this.models[id];
      if (id !== "root") {
        body.subscribe[id] = model.ver;
      }
    }

    if (!asObj) {
      body = JSON.stringify(body);
    }
    return body;
  }

  latestRootModelBody(asObj, resetVersions) {
    //if @_doDebugCall then return @debugCall("latestAllModelsBody",["asObj"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    let models, root;
    if (!(root = this.models.root) || !root.fields.page || !(models = root.fields.page.array).length) {
      return;
    }
    let body = {
      subscribe: {}
    };

    for (let o of models) {
      if (resetVersions) {
        o.model.ver = 0;
      }
      body.subscribe[o.model.id] = o.model.ver;
    }

    if (!asObj) {
      body = JSON.stringify(body);
    }
    return body;
  }

  latestSubscriptionBody(asObj) {
    //if @_doDebugCall then return @debugCall("latestSubscriptionBody",["asObj"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    let model;
    let body = {
      subscribe: {},
      unsubscribe: []
    };
    for (var id in this.needModels) {
      model = this.needModels[id];
      body.subscribe[id] = model.ver || 0;
    }
    for (id in this.ackModels) {
      model = this.ackModels[id];
      body.subscribe[id] = model.ver || 0;
    }
    for (id in this.doneWithModels) {
      const o = this.doneWithModels[id];
      body.unsubscribe.push(id);
    }
    if (!Object.keys(body.subscribe).length && !body.unsubscribe.length) {
      return;
    }

    if (!asObj) {
      body = JSON.stringify(body);
    }
    return body;
  }

  processLatest(data) {
    //if @_doDebugCall then return @debugCall("processLatest",["data"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    if (data) {
      for (let id in data) {
        var model;
        const o = data[id];
        if (!(model = this.models[id])) {
          continue;
        }

        if (o.from === model.ver) {
          if (o.from === o.to) {
            delete this.ackModels[id];
          } else {
            model.ver = o.to || 0;
            if (o.diff) {
              const options = {};
              this.applyModelDiff(model, o.diff);
            }
            this.ackModels[id] = model;
          }
        }
        delete this.needModels[id];
      }

      if (Object.getOwnPropertyNames(this.ackModels).length) {
        this.sendModels();
      } else if (!Object.getOwnPropertyNames(this.needModels).length) {
        let jqel;
        if ((jqel = $("#change-page-loading.toggle-on")).length) {
          document.aautil.killTopModal(jqel[0]);
        }
        this.updateModels();
        $("body").removeClass("loading-page");
      }
    }
  }

  submitWSMessage(event, message, modelId, formSelOrData) {
    let jqel;
    if (event && (jqel = $(event.target).closest(".modal-message-links")).length) {
      if (jqel.filter(":not(.my-modal-focus)").length) {
        return document.aautil.toggle(event.target, event, true, true);
      } else {
        document.aautil.killTopModal(jqel[0]);
      }
    }

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const data = {
      message,
      modelId
    };

    if ($.isPlainObject(formSelOrData)) {
      data.form = formSelOrData;
    } else if (formSelOrData) {
      let jqform;
      if ((jqform = $(formSelOrData)).length !== 1) {
        return;
      }
      data.form = this.formAsNameValues(jqform[0]);
    }

    if (data.modelMessage && !data.message) {
      data.message = data.modelMessage;
    }

    this.send(`message:${JSON.stringify(data)}`);
    return false;
  }

  open() {
    const me = this;
    if (!WebSocket || this._isOpen !== undefined) {
      return;
    }

    const { phoenixKey } = this;

    const ua = navigator.userAgent.toLowerCase();
    if (phoenixKey && ua.indexOf("safari") > -1 && ua.indexOf("chrome") === -1) {
      // safari has an issue where cookies are not set from websocket upgrades (maybe just localhost?)
      return $.ajax({
        type: "post",
        url: window.location.protocol + "//" + this.apiHostname + "/phoenix",
        crossDomain: true,
        dataType: "text",
        xhrFields: {
          withCredentials: true
        },
        data: phoenixKey,
        success() {
          delete me.phoenixKey;
          return me._open();
        }
        //TODO failure
      });
    } else {
      return this._open();
    }
  }

  _open() {
    let ws;
    const { phoenixKey } = this;
    const addr = this.wsProtocol + this.apiHostname + (phoenixKey ? `?${phoenixKey}` : "");
    this.sock = ws = new WebSocket(addr);
    this._isOpen = false;

    ws.onopen = function() {
      const me = document.modelDOM;
      me._isOpen = true;
      if (me._sendsWhileClosed) {
        for (let pair of me._sendsWhileClosed) {
          me.send(pair.msg, pair.cb);
        }
        me._sendsWhileClosed = [];
      }

      me._NconnectFail = 0;
      $("body").removeClass("errorConnectingToServer");
      return $("body").removeClass("disconnectedFromServer");
    };

    ws.onmessage = function(evt) {
      let cb, match;
      const me = document.modelDOM;
      let msg = evt.data;
      if ((match = msg.match(/^(\d+):/))) {
        msg = msg.substring(match[0].length);
        const sendi = +match[1];

        //console.log "WS received index "+sendi,msg

        if (!(cb = me._sends[sendi])) {
          return;
        }
        delete me._sends[sendi];

        if (typeof cb === "function") {
          cb(msg);
        }
      } else if ((match = msg.match(/^(\w*):/))) {
        msg = msg.substring(match[0].length);
        const type = match[1];

        //console.log "WS received type "+type,msg

        if (!(cb = me.callbackOfType(type))) {
          return;
        }
        if (typeof cb === "function") {
          cb(msg);
        }
      }
    };

    return (ws.onclose = function() {
      const me = document.modelDOM;
      console.log("WS Closed");
      delete me.sock;
      delete me._isOpen;

      if (me.phoenixKey) {
        $("body").addClass("loading-page");
        me.sendRootModel(true);
        return;
      }

      $("body").addClass("disconnectedFromServer");

      me._NconnectFail += 1;
      if (me._NconnectFail >= 5) {
        $("body").addClass("errorConnectingToServer");
        return setTimeout(() => me.sendAllModels(), 20000);
      } else {
        return setTimeout(() => me.sendAllModels(), 4000);
      }
    });
  }

  close() {
    if (this.sock) {
      this.sock.close();
    }
    return delete this.sock;
  }

  send(msg, cb) {
    if (this._isOpen) {
      if (typeof cb === "function") {
        this._sends[this._sendi] = cb;
      }
      this.sock.send(this._sendi + ":" + msg);
      return this._sendi++;
    } else {
      this._sendsWhileClosed.push({ msg, cb });
      return this.open();
    }
  }

  sendDiff(diff) {
    return this.send(`diff:${JSON.stringify(diff)}`);
  }

  callbackOfType(type) {
    const me = this;
    switch (type) {
      case "Models":
        return dataString => me.processLatest(JSON.parse(dataString));
      case "Changed":
        return () => me.sendAllModels();
      case "Phoenix":
        return function(dataString) {
          me.phoenixKey = dataString;
          return me.close();
        };
    }
  }

  sendAllModels() {
    const body = this.latestAllModelsBody();
    if (body === this._serverAllModels) {
      this.open();
      return;
    }

    if (!this._sendAllModelsTimer) {
      const me = this;
      return (this._sendAllModelsTimer = setTimeout(function() {
        delete me._sendAllModelsTimer;
        return me.sendAllModelsNow();
      }, 1));
    }
  }

  sendAllModelsNow() {
    if (this._sendAllModelsTimer) {
      clearTimeout(this._sendAllModelsTimer);
      delete this._sendAllModelsTimer;
    }
    const me = this;
    const body = this.latestAllModelsBody();
    this._serverAllModels = body;
    return this.send(`models:${body}`, msg => me.processLatest(JSON.parse(msg)));
  }

  sendRootModel(resetVersions) {
    let body;
    if (!(body = this.latestRootModelBody(undefined, resetVersions))) {
      return;
    }
    if (!resetVersions && body === this._serverRootModels) {
      this.open();
      return;
    }

    if (!this._sendRootModelTimer) {
      const me = this;
      return (this._sendRootModelTimer = setTimeout(function() {
        delete me._sendRootModelTimer;
        return me.sendRootModelNow(resetVersions);
      }, 1));
    }
  }

  sendRootModelNow(resetVersions) {
    if (this._sendRootModelTimer) {
      clearTimeout(this._sendRootModelTimer);
      delete this._sendRootModelTimer;
    }
    const me = this;
    const body = this.latestRootModelBody(undefined, resetVersions);
    this._serverRootModels = body;
    return this.send(`models:${body}`, msg => me.processLatest(JSON.parse(msg)));
  }

  sendModels() {
    if (!this._sendModelsTimer) {
      const me = this;
      return (this._sendModelsTimer = setTimeout(function() {
        delete me._sendModelsTimer;
        return me.sendModelsNow();
      }, 1));
    }
  }

  sendModelsNow() {
    let body;
    if (this._sendModelsTimer) {
      clearTimeout(this._sendModelsTimer);
      delete this._sendModelsTimer;
    }
    const me = this;
    const { doneWithModels } = this;
    if (!(body = this.latestSubscriptionBody())) {
      return;
    }
    this._serverModels = body;
    return this.send(`models:${body}`, function(msg) {
      for (let id in doneWithModels) {
        const o = doneWithModels[id];
        delete me.doneWithModels[id];
      }
      return me.processLatest(JSON.parse(msg));
    });
  }
};
