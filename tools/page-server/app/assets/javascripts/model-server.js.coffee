document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_server = class ModelDOM_server
  constructor:->
    @_sendi=1
    @_NconnectFail=0
    @_sendsWhileClosed=[]
    @_sends={}
    @_serverModels=null
    @_sendAllModelsTimer=undefined
    @_sendModelsTimer=undefined

    @_updatingModels= false
    @_updatingModelsTimer= undefined

    @ackModels = {}

    isLocal = window.location.hostname=='localhost' or window.location.hostname=='127.0.0.1' or window.location.hostname.endsWith('.local') or /192.168.1.\d{1,3}/.test(window.location.hostname)
    @wsProtocol = (if isLocal then 'ws://' else 'wss://')

    hostname = window.location.hostname
    if match = hostname.match(/\.s3-website.*\.amazonaws\.com/)
      hostname = hostname.substring(0,match.index)
    sockPrefix = (if isLocal or hostname.match(/\..*\./) then '' else 'sock.')
    @apiHostname = sockPrefix+hostname+":3100"

  latestAllModelsBody:(asObj)=>
    #if @_doDebugCall then return @debugCall("latestAllModelsBody",["asObj"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    body = {
      subscribe:{},
      unsubscribe:'all'
    }
    for id, model of @models when id!='root'
      body.subscribe[id] = model.ver

    body = JSON.stringify(body) unless asObj
    body

  latestRootModelBody:(asObj, resetVersions)=>
    #if @_doDebugCall then return @debugCall("latestAllModelsBody",["asObj"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    return unless (root=@models.root) and root.fields.page and (models=root.fields.page.array).length
    body = {
      subscribe:{}
    }

    for o in models
      o.model.ver=0 if resetVersions
      body.subscribe[o.model.id] = o.model.ver

    body = JSON.stringify(body) unless asObj
    body

  latestSubscriptionBody:(asObj)=>
    #if @_doDebugCall then return @debugCall("latestSubscriptionBody",["asObj"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    body = {
      subscribe:{},
      unsubscribe:[]
    }
    for id, model of @needModels
      body.subscribe[id] = model.ver || 0
    for id, model of @ackModels
      body.subscribe[id] = model.ver || 0
    for id, o of @doneWithModels
      body.unsubscribe.push id
    return unless Object.keys(body.subscribe).length or body.unsubscribe.length

    body = JSON.stringify(body) unless asObj
    body

  processLatest:(data)=>
    #if @_doDebugCall then return @debugCall("processLatest",["data"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())
    if data
      for id,o of data
        continue unless model=@models[id]

        if o.from == model.ver
          if o.from == o.to
            delete @ackModels[id]
          else
            model.ver = o.to || 0
            if o.diff
              options = {}
              @applyModelDiff(model, o.diff)
            @ackModels[id] = model
        delete @needModels[id]

      if Object.getOwnPropertyNames(@ackModels).length
        @sendModels()
      else if !Object.getOwnPropertyNames(@needModels).length
        if (jqel = $('#change-page-loading.toggle-on')).length
          document.aautil.killTopModal(jqel[0])
        @updateModels()
        $('body').removeClass('loading-page')
    return

  submitWSMessage:(event, message, modelId, formSelOrData)=>
    if event and (jqel = $(event.target).closest('.modal-message-links')).length
      if (jqel.filter(':not(.my-modal-focus)')).length
        return document.aautil.toggle(event.target,event, true, true)
      else
        document.aautil.killTopModal(jqel[0])

    if event
      event.preventDefault()
      event.stopPropagation()

    data = {
      message: message,
      modelId: modelId
    }

    if $.isPlainObject(formSelOrData)
      data.form = formSelOrData
    else if formSelOrData
      return unless (jqform=$(formSelOrData)).length == 1
      data.form = @formAsNameValues(jqform[0])

    data.message = data.modelMessage if data.modelMessage && !data.message

    @send "message:"+JSON.stringify(data)
    return false


  open: =>
    me = this
    return unless WebSocket && @_isOpen==undefined

    phoenixKey = @phoenixKey

    ua = navigator.userAgent.toLowerCase()
    if phoenixKey and ua.indexOf("safari") > -1 and ua.indexOf("chrome") == -1
      # safari has an issue where cookies are not set from websocket upgrades (maybe just localhost?)
      $.ajax({
          type: 'post',
          url: window.location.protocol+'//'+@apiHostname+'/phoenix',
          crossDomain: true,
          dataType: "text",
          xhrFields: {
              withCredentials: true
          },
          data: phoenixKey,
          success: ->
            delete me.phoenixKey
            me._open()
          #TODO failure
        })
    else
      @_open()

  _open: =>
    phoenixKey = @phoenixKey
    addr = @wsProtocol + @apiHostname + (if phoenixKey then "?"+phoenixKey else "")
    @sock = ws = new WebSocket(addr)
    @_isOpen = false

    ws.onopen = ->
      me = document.modelDOM
      me._isOpen = true
      if me._sendsWhileClosed
        for pair in me._sendsWhileClosed
          me.send pair.msg, pair.cb
        me._sendsWhileClosed = []

      me._NconnectFail = 0
      $("body").removeClass("errorConnectingToServer")
      $("body").removeClass("disconnectedFromServer")

    ws.onmessage = (evt)->
      me = document.modelDOM
      msg = evt.data
      if match = msg.match(/^(\d+):/)
        msg = msg.substring(match[0].length)
        sendi = +match[1]

        #console.log "WS received index "+sendi,msg

        return unless cb = me._sends[sendi]
        delete me._sends[sendi]

        cb(msg) if typeof(cb)=='function'
      else if match = msg.match(/^(\w*):/)
        msg = msg.substring(match[0].length)
        type = match[1]

        #console.log "WS received type "+type,msg

        return unless cb = me.callbackOfType(type)
        cb(msg) if typeof(cb)=='function'
      return

    ws.onclose = ->
      me = document.modelDOM
      console.log("WS Closed")
      delete me.sock
      delete me._isOpen

      if me.phoenixKey
        $('body').addClass('loading-page')
        me.sendRootModel(true)
        return

      $("body").addClass("disconnectedFromServer")

      me._NconnectFail += 1
      if me._NconnectFail >= 5
        $("body").addClass("errorConnectingToServer")
        setTimeout(->
          me.sendAllModels()
        ,20000)
      else
        setTimeout(->
          me.sendAllModels()
        ,4000)

  close: =>
    @sock.close() if @sock
    delete @sock

  send: (msg, cb)=>
    if @_isOpen
      if typeof(cb) == 'function'
        @_sends[@_sendi] = cb
      @sock.send(@_sendi+":"+msg)
      @_sendi++
    else
      @_sendsWhileClosed.push {msg:msg,cb:cb}
      @open()

  sendDiff: (diff)=>
    @send "diff:"+JSON.stringify(diff)

  callbackOfType:(type)=>
    me = this
    switch type
      when 'Models' then (dataString)->
        me.processLatest JSON.parse(dataString)
      when 'Changed' then ->
        me.sendAllModels()
      when 'Phoenix' then (dataString)->
        me.phoenixKey = dataString
        me.close()


  sendAllModels:=>
    body = @latestAllModelsBody()
    if body==@_serverAllModels
      @open()
      return

    unless @_sendAllModelsTimer
      me = this
      @_sendAllModelsTimer = setTimeout(->
        delete me._sendAllModelsTimer
        me.sendAllModelsNow()
      , 1)

  sendAllModelsNow:=>
    if @_sendAllModelsTimer
      clearTimeout(@_sendAllModelsTimer)
      delete @_sendAllModelsTimer
    me = this
    body = @latestAllModelsBody()
    @_serverAllModels = body
    @send "models:"+body, (msg)->
      me.processLatest(JSON.parse(msg))

  sendRootModel:(resetVersions)=>
    return unless body = @latestRootModelBody(undefined,resetVersions)
    if !resetVersions and body==@_serverRootModels
      @open()
      return

    unless @_sendRootModelTimer
      me = this
      @_sendRootModelTimer = setTimeout(->
        delete me._sendRootModelTimer
        me.sendRootModelNow(resetVersions)
      , 1)

  sendRootModelNow:(resetVersions)=>
    if @_sendRootModelTimer
      clearTimeout(@_sendRootModelTimer)
      delete @_sendRootModelTimer
    me = this
    body = @latestRootModelBody(undefined,resetVersions)
    @_serverRootModels = body
    @send "models:"+body, (msg)->
      me.processLatest(JSON.parse(msg))

  sendModels:=>
    unless @_sendModelsTimer
      me = this
      @_sendModelsTimer = setTimeout(->
        delete me._sendModelsTimer
        me.sendModelsNow()
      , 1)

  sendModelsNow:=>
    if @_sendModelsTimer
      clearTimeout(@_sendModelsTimer)
      delete @_sendModelsTimer
    me = this
    doneWithModels = @doneWithModels
    return unless body = @latestSubscriptionBody()
    @_serverModels = body
    @send "models:"+body, (msg)->
      for id,o of doneWithModels
        delete me.doneWithModels[id]
      me.processLatest(JSON.parse(msg))

