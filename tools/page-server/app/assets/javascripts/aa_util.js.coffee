document._bpIndex = 0
window.BP=(indexOrPrint)->
  if typeof(indexOrPrint)!='number'
    bpIndex = +localStorage.getItem("bpIndex")
    if bpIndex == ++document._bpIndex
      console.log("Breakpoint at "+bpIndex)
    else if indexOrPrint
      console.log("bp:"+document._bpIndex+(if bpIndex then " -> "+bpIndex else ""))
  else
    localStorage.setItem("bpIndex", indexOrPrint)
    console.log("Aiming for breakpoint at "+indexOrPrint)
  document._bpIndex

window.ERROR=->
  console.log("==========Ahem, terribly sorry old chap, there appears to be a small issue that probably warrants brief inquiry:")
  console.log.apply(this,arguments)
  die()

window.WARN=->
  console.log("==========Ahem, terribly sorry old chap, there appears to be a little problem. I'll do my best to carry on.")
  console.log.apply(this,arguments)


JSON.mystringify=(o,maxDepth)->
  stack = []
  JSON.stringify o, (key, value)->
    if (index=stack.indexOf(this))==-1
      stack.push(this)
    else if stack.length>index+1
      stack.splice(index+1,stack.length-(index+1))
    return if maxDepth && stack.length>=maxDepth
      "{clipped}"
    else if typeof value=='object' && value!=null && stack.indexOf(value)!=-1
      "{circular}"
    else value


Array.newArrayWithSize = (size,meOrValue,fn)->
  @standard = @standard||[]
  if @standard.length<size
    for add in [@standard.length ... size]
      @standard.push undefined
  ret = @standard.slice 0, size
  if typeof fn=='function'
    for i in [0 ... size]
      ret[i] = fn.call meOrValue, i
  else if meOrValue!=undefined
    if typeof meOrValue=='object' && meOrValue.constructor==Array
      meOrValue = meOrValue.slice()
    for n in [0...size]
      ret[i] = meOrValue
  ret

Array.prototype.copyWithSize = (size,meOrValue,fn)->
  if @length >= size
    @slice 0, size
  else
    length = @length
    @concat(Array.newArrayWithSize(size-length, meOrValue, (
      if typeof fn=='function'
        (i)->
          fn.call(meOrValue, i+length)
      else
        fn
    )))

Array.prototype.setLength = (length,meOrValue,fn)->
  if @length>length
    @splice length, @length-length
  else if length>@length
    if typeof fn=='function'
      for i in [@length ... length]
        @push fn.call(meOrValue, i, true)
    else
      if typeof meOrValue=='object' && meOrValue.constructor==Array
        meOrValue = meOrValue.slice()
      for n in [0...length-@length]
        @push meOrValue
  this

Array.prototype.initWithLength = (length,meOrValue,fn)->
  if typeof fn=='function'
    n=Math.min(length,@length)
    for i in [0...n]
      @[i] = fn.call(meOrValue, i)
  else
    if typeof meOrValue=='object' && meOrValue.constructor==Array
      meOrValue = meOrValue.slice()
    for i in [0...Math.min(length,@length)]
      @[i] = meOrValue
  @setLength length, meOrValue, fn
  this

String.prototype.lpad = (length,ch)->
  ret = this
  if ch==undefined then ch=' '
  while ret.length<length
    ret = ch+ret
  ret

RegExp.escapeString = (string)->
  return string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, "\\$&")


unless document.aautil
  document.aautil = {
    _bodyNoScrollers:{}

    cancelBubble:()->
      event.originalEvent ||= {}
      event.originalEvent.cancelBubble = true
      event.preventDefault()
      event.stopPropagation()
      return false


    preventBodyScrolling:(key)->
      key = true if key==undefined
      bodyNoScrollers = document.aautil._bodyNoScrollers
      if bodyNoScrollers[key]
        bodyNoScrollers[key]++
      else
        unless Object.keys(bodyNoScrollers).length
          $(document.body).addClass("no-scroll")
        bodyNoScrollers[key]=1

    stopPreventingBodyScrolling:(key)->
      key = true if key==undefined
      bodyNoScrollers = document.aautil._bodyNoScrollers
      return unless bodyNoScrollers[key]
      unless --bodyNoScrollers[key]
        delete bodyNoScrollers[key]
        unless Object.keys(bodyNoScrollers).length
          $(document.body).removeClass("no-scroll")

    _deferableLooseCallbacks: {}
    _deferableLooseCallbackFired:(name)->
      if cb = document.aautil._deferableLooseCallbacks[name]
        if (msec=cb[0])>0
          cb[0] = 0
          setTimeout(->
            document.aautil._deferableLooseCallbackFired(name)
          , msec
          )
        else
          cb[1]()
          delete document.aautil._deferableLooseCallbacks[name]

    deferableLooseCallback:(name, msec, callback)->
      if cb = document.aautil._deferableLooseCallbacks[name]
        cb[0] = Math.max(cb[0], msec)
      else
        document.aautil._deferableLooseCallbacks[name] = [0, callback]
        setTimeout(->
          document.aautil._deferableLooseCallbackFired(name)
        , msec
        )

  fullscreenElement:->
    document.fullscreenElement or document.webkitFullscreenElement or document.mozFullScreenElement or document.msFullscreenElement

  goFullscreen:(el) =>
    return false unless typeof(el)=='object' or (typeof(el)=='string' and (jqel=$(el)).length and (el=jqel[0]))
    ret = if el.requestFullscreen
      el.requestFullscreen()
      true
    else if el.msRequestFullscreen
      el.msRequestFullscreen()
      true
    else if el.mozRequestFullScreen
      el.mozRequestFullScreen()
      true
    else if el.webkitRequestFullscreen
      el.webkitRequestFullscreen()
      true
    else
      false

  _escapeHTMLMap: {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  }
  escapeHTML:(string) ->
    String(string).replace /[&<>"'`=\/]/g, (s)->
      document.aautil._escapeHTMLMap[s]
  escapeAttribute:(string) ->
    String(string).replace /["'\\]/g, (s)->
      '\\'+s


  _modals:[]
  killModals:->
    document.aautil.killTopModal(undefined,-1)
    return

  killTopModal:(el,count)->
    count = -1 if count==undefined
    if el
      found = false
      for modal in document.aautil._modals
        if modal.jqel[0]==el
          found = true
          break
      return unless found 

    return unless count and (modal=document.aautil._modals.pop())
    count = 1 if el and modal.jqel[0]==el

    modal.jqbg.removeClass('displayed') if modal.jqbg
    modal.callback() if typeof(modal.callback)=='function'  
    setTimeout(->
      modal.jqbg.remove() if modal.jqbg
      modal.jqel.removeClass('my-top-modal-focus')
      modal.jqel.removeClass('my-modal-focus')
      modal.jqgrpel.removeClass('my-top-modal-group')
      modal.jqgrpel.removeClass('my-modal-group')
      if l=document.aautil._modals.length
        modal = document.aautil._modals[l-1]
        if count>1
          document.aautil.killTopModal(undefined,count-1)
        else
          modal.jqel.addClass('my-top-modal-focus')
          modal.jqgrpel.addClass('my-top-modal-group')
    ,300)


  startModal:(el, grpel, callback)->
    jqel=$(el)
    jqel.addClass('my-modal-focus')
    jqel.addClass('my-top-modal-focus')

    jqgrpel=$(grpel)
    jqgrpel.addClass('my-modal-group')
    jqgrpel.addClass('my-top-modal-group')

    if l=document.aautil._modals.length
      modal = document.aautil._modals[l-1]
      modal.jqel.removeClass('my-top-modal-focus')
      modal.jqgrpel.removeClass('my-top-modal-group')
    else
      jqbg = $('<div class="my-modal"></div>')
      jqbg[0].onclick = ->
        document.aautil.killTopModal()
      document.body.appendChild(jqbg[0])

      setTimeout(->
        jqbg.addClass('displayed')
      ,50)

    document.aautil._modals.push {jqel:jqel, jqgrpel:jqgrpel, jqbg:jqbg, callback:callback}

  toggle:(el,event, setOffsToOn, setOnsToOff)->
    if event
      event.preventDefault()
      event.stopPropagation()
    groupName = el.getAttribute('toggle')
    if groupName
      groupSel = '[toggle="'+groupName+'"]' if groupName
      group = $(el).closest('.toggle-group'+groupSel) if groupSel
      group = $(el).closest('.toggle-group:not([toggle])') unless group and group.length
      group = $(el).parent() unless group and group.length
    else
      group = $(el).closest('.toggle-group')
      group = $(el).parent() unless group and group.length
      groupName = group[0].getAttribute('toggle')
      groupSel = '[toggle="'+groupName+'"]' if groupName

    if groupSel
      sel = '.toggle'+groupSel+',.toggle-display'+groupSel+',.toggle-fader'+groupSel
      tog = group.find(sel).addBack(sel)
    else
      sel = '.toggle:not([toggle]),.toggle-display:not([toggle]),.toggle-fader:not([toggle])'
      tog = group.children(sel).addBack(sel)
    
    togon = tog.filter('.toggle-on')
    togoff = tog.filter(':not(.toggle-on)')

    if group.hasClass('toggle-modal')
      focus = group.find('.toggle-focus'+groupSel) if groupSel
      focus = group.find('.toggle-focus:not([toggle])') unless focus and focus.length
      focus = group unless focus.length
      if (togon.length and (!setOnsToOff)) or (togoff.length and setOffsToOn)
        document.aautil.startModal focus[0], group[0], ->
          document.aautil.toggle(el, undefined, false, true)

    if setOffsToOn
      togoff.filter('.toggle-display,.toggle-fader').css('display','')
      setTimeout(->
        togoff.addClass('toggle-on')
      , 50)

    if setOnsToOff
      togon.removeClass('toggle-on')
      togon.filter('.toggle-display,.toggle-fader').each ->
        jqel=$(this)
        delay=400 unless (delay=@getAttribute('delay'))>0
        setTimeout(->
          return if jqel.hasClass('toggle-on')
          jqel.css('display','none')
        , delay)

    return false


  stylesheet:->
    return document.aautil._stylesheet if document.aautil._stylesheet
    # thank you https://davidwalsh.name/add-rules-stylesheets
    style = document.createElement "style"
    style.appendChild document.createTextNode("") # WebKit hack :(
    document.head.appendChild(style)

    document.aautil._stylesheetRuleNames = []
    document.aautil._stylesheetRules = []
    document.aautil._stylesheet = style.sheet

  removeStylesheetRule:(name)->
    stylesheet = document.aautil.stylesheet()
    return unless (index = document.aautil._stylesheetRuleNames.indexOf(name))>=0
    stylesheet.deleteRule index
    document.aautil._stylesheetRuleNames.splice(index,1)
    document.aautil._stylesheetRules.splice(index,1)
    return

  addStylesheetRule:(rule,name,atIndex)->
    name ||= rule
    stylesheet = document.aautil.stylesheet()
    if (index = document.aautil._stylesheetRuleNames.indexOf(name))>=0
      return if atIndex==undefined and document.aautil._stylesheetRules[index]==rule
      document.aautil.removeStylesheetRule(name)

    atIndex = document.aautil._stylesheetRuleNames.length if atIndex==undefined
    stylesheet.insertRule rule, atIndex
    document.aautil._stylesheetRuleNames.splice atIndex,0,name
    document.aautil._stylesheetRules.splice atIndex,0,rule
    return

  scrollbarWidth:->
    return document.aautil._scrollbarWidth if document.aautil._scrollbarWidth!=undefined

    # thank you lostsource https://stackoverflow.com/a/13382873/2301213
    outer = document.createElement "div"
    outer.style.visibility = "hidden"
    outer.style.width = "100px"
    outer.style.msOverflowStyle = "scrollbar" # needed for WinJS apps

    document.body.appendChild outer
    widthNoScroll = outer.offsetWidth
    outer.style.overflow = "scroll"
    inner = document.createElement "div"
    inner.style.width = "100%"
    outer.appendChild inner
    widthWithScroll = inner.offsetWidth
    outer.parentNode.removeChild outer

    ret = widthNoScroll - widthWithScroll
    document.aautil.addStylesheetRule ".width-scrollbar{width:"+ret+"px;}", 'width-scrollbar'
    document.aautil.addStylesheetRule ".right-padding-scrollbar{padding-right:"+ret+"px;}", 'padding-scrollbar'

    document.aautil._scrollbarWidth = ret

  setSelectionRange:(el,start,end)->
    window.getSelection().removeAllRanges()
    range = new Range()

    if el.childNodes.length == 0
      range.setStart el, 0
      range.setEnd el, 0
    else
      if el.childNodes.length != 1 or el.firstChild.nodeType != 3
        el.textContent = el.textContent
      return unless el.childNodes.length == 1 and el.firstChild.nodeType == 3

      len = el.textContent.length
      start = 0 unless start!=undefined
      end = len unless end!=undefined
      start = Math.max(0,Math.min(len,start))
      end = Math.max(0,Math.min(len,end))
      range.setStart el.firstChild, start
      range.setEnd el.firstChild, end

    window.getSelection().addRange range

  }

$(document).ready ->
  scrollbarWidth = document.aautil.scrollbarWidth()
  #document.aautil.addStylesheetRule "body{padding-top:"+scrollbarWidth+"px;}", 'body-steady-scrollbar-top'
  #document.aautil.addStylesheetRule "body{padding-left:"+scrollbarWidth+"px;}", 'body-steady-scrollbar-left'
  document.aautil.addStylesheetRule "body.has-scrollbar.no-scroll{padding-right:"+scrollbarWidth+"px;}", 'body-steady-scrollbar-right'



$(document).on "click tap", ".toggle-button", (event)->
  document.aautil.toggle(this,event, true, true)

$(document).on "click", ".dismisses-modal", (event)->
  document.aautil.killTopModal()

$(document).on "click", ".toggle-on-button", (event)->
  document.aautil.toggle(this,event,true,false)

$(document).on "click", ".toggle-off-button", (event)->
  document.aautil.toggle(this,event,false,true)

$(document).on "input", "input[sizer]", (event)->
  return unless (jqsizer = $('#'+event.target.getAttribute('sizer'))).length
  jqsizer.text(event.target.value)


$(document).on "click", ".posting-text", (event)->
  event.originalEvent ||= {}
  event.originalEvent.cancelBubble = true

$(document).on "blur", ".posting-text", (event)->
  el = event.target
  if el.hasAttribute('valueWas')
    el.textContent = el.getAttribute('valueWas')
  if (par=$(el).parent()).hasClass 'posting-text-parent'
    par.removeClass('child-has-focus')
  return

$(document).on "focus", ".posting-text", (event)->
  event.preventDefault()
  event.stopPropagation()
  el = event.target
  el.setAttribute('valueWas', el.textContent)
  if el.textContent.length==0
    el.textContent = '${placeholder|<type the new value>}'
  document.aautil.setSelectionRange(this, 0, this.textContent.length)
  if (par=$(el).parent()).hasClass 'posting-text-parent'
    par.addClass('child-has-focus')
  return

$(document).on 'keydown', ".posting-text", (event)->
  el = event.target
  if event.keyCode==13 # newline
    return unless el.getAttribute('lines')=='single' or !event.shiftKey
    event.preventDefault()
    event.stopPropagation()
    return unless el.hasAttribute('model') and el.hasAttribute('name')
    modelId = el.getAttribute('model')
    name = el.getAttribute('name')
    message = (if el.hasAttribute('message') then el.getAttribute('message') else '')
    form = {}
    form[name] = el.innerText
    document.modelDOM.submitWSMessage(undefined,message,modelId,form)
    el.blur()
    return false
  return



