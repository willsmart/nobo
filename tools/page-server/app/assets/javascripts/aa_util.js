/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
document._bpIndex = 0;
window.BP=function(indexOrPrint){
  if (typeof(indexOrPrint)!=='number') {
    const bpIndex = +localStorage.getItem("bpIndex");
    if (bpIndex === ++document._bpIndex) {
      console.log(`Breakpoint at ${bpIndex}`);
    } else if (indexOrPrint) {
      console.log(`bp:${document._bpIndex}${bpIndex ? ` -> ${bpIndex}` : ""}`);
    }
  } else {
    localStorage.setItem("bpIndex", indexOrPrint);
    console.log(`Aiming for breakpoint at ${indexOrPrint}`);
  }
  return document._bpIndex;
};

window.ERROR=function() {
  console.log("==========Ahem, terribly sorry old chap, there appears to be a small issue that probably warrants brief inquiry:");
  console.log.apply(this,arguments);
  return die();
};

window.WARN=function() {
  console.log("==========Ahem, terribly sorry old chap, there appears to be a little problem. I'll do my best to carry on.");
  return console.log.apply(this,arguments);
};


JSON.mystringify=function(o,maxDepth){
  const stack = [];
  return JSON.stringify(o, function(key, value){
    let index;
    if ((index=stack.indexOf(this))===-1) {
      stack.push(this);
    } else if (stack.length>(index+1)) {
      stack.splice(index+1,stack.length-(index+1));
    }
    if (maxDepth && (stack.length>=maxDepth)) {
      return "{clipped}";
    } else if ((typeof value==='object') && (value!==null) && (stack.indexOf(value)!==-1)) {
      return "{circular}";
    } else { return value; }
  });
};


Array.newArrayWithSize = function(size,meOrValue,fn){
  let i;
  this.standard = this.standard||[];
  if (this.standard.length<size) {
    for (let add = this.standard.length, end = size, asc = this.standard.length <= end; asc ? add < end : add > end; asc ? add++ : add--) {
      this.standard.push(undefined);
    }
  }
  const ret = this.standard.slice(0, size);
  if (typeof fn==='function') {
    let asc1, end1;
    for (i = 0, end1 = size, asc1 = 0 <= end1; asc1 ? i < end1 : i > end1; asc1 ? i++ : i--) {
      ret[i] = fn.call(meOrValue, i);
    }
  } else if (meOrValue!==undefined) {
    if ((typeof meOrValue==='object') && (meOrValue.constructor===Array)) {
      meOrValue = meOrValue.slice();
    }
    for (let n = 0, end2 = size, asc2 = 0 <= end2; asc2 ? n < end2 : n > end2; asc2 ? n++ : n--) {
      ret[i] = meOrValue;
    }
  }
  return ret;
};

Array.prototype.copyWithSize = function(size,meOrValue,fn){
  if (this.length >= size) {
    return this.slice(0, size);
  } else {
    const { length } = this;
    return this.concat(Array.newArrayWithSize(size-length, meOrValue, (
      typeof fn==='function' ?
        i=> fn.call(meOrValue, i+length)
      :
        fn
    )));
  }
};

Array.prototype.setLength = function(length,meOrValue,fn){
  if (this.length>length) {
    this.splice(length, this.length-length);
  } else if (length>this.length) {
    if (typeof fn==='function') {
      for (let i = this.length, end = length, asc = this.length <= end; asc ? i < end : i > end; asc ? i++ : i--) {
        this.push(fn.call(meOrValue, i, true));
      }
    } else {
      if ((typeof meOrValue==='object') && (meOrValue.constructor===Array)) {
        meOrValue = meOrValue.slice();
      }
      for (let n = 0, end1 = length-this.length, asc1 = 0 <= end1; asc1 ? n < end1 : n > end1; asc1 ? n++ : n--) {
        this.push(meOrValue);
      }
    }
  }
  return this;
};

Array.prototype.initWithLength = function(length,meOrValue,fn){
  let i;
  if (typeof fn==='function') {
    let asc, end;
    const n=Math.min(length,this.length);
    for (i = 0, end = n, asc = 0 <= end; asc ? i < end : i > end; asc ? i++ : i--) {
      this[i] = fn.call(meOrValue, i);
    }
  } else {
    let asc1, end1;
    if ((typeof meOrValue==='object') && (meOrValue.constructor===Array)) {
      meOrValue = meOrValue.slice();
    }
    for (i = 0, end1 = Math.min(length,this.length), asc1 = 0 <= end1; asc1 ? i < end1 : i > end1; asc1 ? i++ : i--) {
      this[i] = meOrValue;
    }
  }
  this.setLength(length, meOrValue, fn);
  return this;
};

String.prototype.lpad = function(length,ch){
  let ret = this;
  if (ch===undefined) { ch=' '; }
  while (ret.length<length) {
    ret = ch+ret;
  }
  return ret;
};

RegExp.escapeString = string=> string.replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, "\\$&");


if (!document.aautil) {
  document.aautil = {
    _bodyNoScrollers:{},

    cancelBubble(){
      if (!event.originalEvent) { event.originalEvent = {}; }
      event.originalEvent.cancelBubble = true;
      event.preventDefault();
      event.stopPropagation();
      return false;
    },


    preventBodyScrolling(key){
      if (key===undefined) { key = true; }
      const bodyNoScrollers = document.aautil._bodyNoScrollers;
      if (bodyNoScrollers[key]) {
        return bodyNoScrollers[key]++;
      } else {
        if (!Object.keys(bodyNoScrollers).length) {
          $(document.body).addClass("no-scroll");
        }
        return bodyNoScrollers[key]=1;
      }
    },

    stopPreventingBodyScrolling(key){
      if (key===undefined) { key = true; }
      const bodyNoScrollers = document.aautil._bodyNoScrollers;
      if (!bodyNoScrollers[key]) { return; }
      if (!--bodyNoScrollers[key]) {
        delete bodyNoScrollers[key];
        if (!Object.keys(bodyNoScrollers).length) {
          return $(document.body).removeClass("no-scroll");
        }
      }
    },

    _deferableLooseCallbacks: {},
    _deferableLooseCallbackFired(name){
      let cb;
      if (cb = document.aautil._deferableLooseCallbacks[name]) {
        let msec;
        if ((msec=cb[0])>0) {
          cb[0] = 0;
          return setTimeout(() => document.aautil._deferableLooseCallbackFired(name)
          , msec
          );
        } else {
          cb[1]();
          return delete document.aautil._deferableLooseCallbacks[name];
        }
      }
    },

    deferableLooseCallback(name, msec, callback){
      let cb;
      if (cb = document.aautil._deferableLooseCallbacks[name]) {
        return cb[0] = Math.max(cb[0], msec);
      } else {
        document.aautil._deferableLooseCallbacks[name] = [0, callback];
        return setTimeout(() => document.aautil._deferableLooseCallbackFired(name)
        , msec
        );
      }
    },

  fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
  },

  goFullscreen:el => {
    let jqel, ret;
    if ((typeof(el)!=='object') && ((typeof(el)!=='string') || !(jqel=$(el)).length || (!(el=jqel[0])))) { return false; }
    return ret = (() => {
      if (el.requestFullscreen) {
      el.requestFullscreen();
      return true;
    } else if (el.msRequestFullscreen) {
      el.msRequestFullscreen();
      return true;
    } else if (el.mozRequestFullScreen) {
      el.mozRequestFullScreen();
      return true;
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
      return true;
    } else {
      return false;
    }
    })();
  },

  _escapeHTMLMap: {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;'
  },
  escapeHTML(string) {
    return String(string).replace(/[&<>"'`=\/]/g, s=> document.aautil._escapeHTMLMap[s]);
  },
  escapeAttribute(string) {
    return String(string).replace(/["'\\]/g, s=> `\\${s}`);
  },


  _modals:[],
  killModals() {
    document.aautil.killTopModal(undefined,-1);
  },

  killTopModal(el,count){
    let modal;
    if (count===undefined) { count = -1; }
    if (el) {
      let found = false;
      for (modal of document.aautil._modals) {
        if (modal.jqel[0]===el) {
          found = true;
          break;
        }
      }
      if (!found) { return; } 
    }

    if (!count || (!(modal=document.aautil._modals.pop()))) { return; }
    if (el && (modal.jqel[0]===el)) { count = 1; }

    if (modal.jqbg) { modal.jqbg.removeClass('displayed'); }
    if (typeof(modal.callback)==='function') { modal.callback(); }  
    return setTimeout(function() {
      let l;
      if (modal.jqbg) { modal.jqbg.remove(); }
      modal.jqel.removeClass('my-top-modal-focus');
      modal.jqel.removeClass('my-modal-focus');
      modal.jqgrpel.removeClass('my-top-modal-group');
      modal.jqgrpel.removeClass('my-modal-group');
      if (l=document.aautil._modals.length) {
        modal = document.aautil._modals[l-1];
        if (count>1) {
          return document.aautil.killTopModal(undefined,count-1);
        } else {
          modal.jqel.addClass('my-top-modal-focus');
          return modal.jqgrpel.addClass('my-top-modal-group');
        }
      }
    }
    ,300);
  },


  startModal(el, grpel, callback){
    let jqbg, l;
    const jqel=$(el);
    jqel.addClass('my-modal-focus');
    jqel.addClass('my-top-modal-focus');

    const jqgrpel=$(grpel);
    jqgrpel.addClass('my-modal-group');
    jqgrpel.addClass('my-top-modal-group');

    if (l=document.aautil._modals.length) {
      const modal = document.aautil._modals[l-1];
      modal.jqel.removeClass('my-top-modal-focus');
      modal.jqgrpel.removeClass('my-top-modal-group');
    } else {
      jqbg = $('<div class="my-modal"></div>');
      jqbg[0].onclick = () => document.aautil.killTopModal();
      document.body.appendChild(jqbg[0]);

      setTimeout(() => jqbg.addClass('displayed')
      ,50);
    }

    return document.aautil._modals.push({jqel, jqgrpel, jqbg, callback});
  },

  toggle(el,event, setOffsToOn, setOnsToOff){
    let group, groupSel, sel, tog;
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    let groupName = el.getAttribute('toggle');
    if (groupName) {
      if (groupName) { groupSel = `[toggle="${groupName}"]`; }
      if (groupSel) { group = $(el).closest(`.toggle-group${groupSel}`); }
      if (!group || !group.length) { group = $(el).closest('.toggle-group:not([toggle])'); }
      if (!group || !group.length) { group = $(el).parent(); }
    } else {
      group = $(el).closest('.toggle-group');
      if (!group || !group.length) { group = $(el).parent(); }
      groupName = group[0].getAttribute('toggle');
      if (groupName) { groupSel = `[toggle="${groupName}"]`; }
    }

    if (groupSel) {
      sel = `.toggle${groupSel},.toggle-display${groupSel},.toggle-fader${groupSel}`;
      tog = group.find(sel).addBack(sel);
    } else {
      sel = '.toggle:not([toggle]),.toggle-display:not([toggle]),.toggle-fader:not([toggle])';
      tog = group.children(sel).addBack(sel);
    }
    
    const togon = tog.filter('.toggle-on');
    const togoff = tog.filter(':not(.toggle-on)');

    if (group.hasClass('toggle-modal')) {
      let focus;
      if (groupSel) { focus = group.find(`.toggle-focus${groupSel}`); }
      if (!focus || !focus.length) { focus = group.find('.toggle-focus:not([toggle])'); }
      if (!focus.length) { focus = group; }
      if ((togon.length && (!setOnsToOff)) || (togoff.length && setOffsToOn)) {
        document.aautil.startModal(focus[0], group[0], () => document.aautil.toggle(el, undefined, false, true));
      }
    }

    if (setOffsToOn) {
      togoff.filter('.toggle-display,.toggle-fader').css('display','');
      setTimeout(() => togoff.addClass('toggle-on')
      , 50);
    }

    if (setOnsToOff) {
      togon.removeClass('toggle-on');
      togon.filter('.toggle-display,.toggle-fader').each(function() {
        let delay;
        const jqel=$(this);
        if ((delay=this.getAttribute('delay'))<=0) { delay=400; }
        return setTimeout(function() {
          if (jqel.hasClass('toggle-on')) { return; }
          return jqel.css('display','none');
        }
        , delay);
      });
    }

    return false;
  },


  stylesheet() {
    if (document.aautil._stylesheet) { return document.aautil._stylesheet; }
    // thank you https://davidwalsh.name/add-rules-stylesheets
    const style = document.createElement("style");
    style.appendChild(document.createTextNode("")); // WebKit hack :(
    document.head.appendChild(style);

    document.aautil._stylesheetRuleNames = [];
    document.aautil._stylesheetRules = [];
    return document.aautil._stylesheet = style.sheet;
  },

  removeStylesheetRule(name){
    let index;
    const stylesheet = document.aautil.stylesheet();
    if ((index = document.aautil._stylesheetRuleNames.indexOf(name))<0) { return; }
    stylesheet.deleteRule(index);
    document.aautil._stylesheetRuleNames.splice(index,1);
    document.aautil._stylesheetRules.splice(index,1);
  },

  addStylesheetRule(rule,name,atIndex){
    let index;
    if (!name) { name = rule; }
    const stylesheet = document.aautil.stylesheet();
    if ((index = document.aautil._stylesheetRuleNames.indexOf(name))>=0) {
      if ((atIndex===undefined) && (document.aautil._stylesheetRules[index]===rule)) { return; }
      document.aautil.removeStylesheetRule(name);
    }

    if (atIndex===undefined) { atIndex = document.aautil._stylesheetRuleNames.length; }
    stylesheet.insertRule(rule, atIndex);
    document.aautil._stylesheetRuleNames.splice(atIndex,0,name);
    document.aautil._stylesheetRules.splice(atIndex,0,rule);
  },

  scrollbarWidth() {
    if (document.aautil._scrollbarWidth!==undefined) { return document.aautil._scrollbarWidth; }

    // thank you lostsource https://stackoverflow.com/a/13382873/2301213
    const outer = document.createElement("div");
    outer.style.visibility = "hidden";
    outer.style.width = "100px";
    outer.style.msOverflowStyle = "scrollbar"; // needed for WinJS apps

    document.body.appendChild(outer);
    const widthNoScroll = outer.offsetWidth;
    outer.style.overflow = "scroll";
    const inner = document.createElement("div");
    inner.style.width = "100%";
    outer.appendChild(inner);
    const widthWithScroll = inner.offsetWidth;
    outer.parentNode.removeChild(outer);

    const ret = widthNoScroll - widthWithScroll;
    document.aautil.addStylesheetRule(`.width-scrollbar{width:${ret}px;}`, 'width-scrollbar');
    document.aautil.addStylesheetRule(`.right-padding-scrollbar{padding-right:${ret}px;}`, 'padding-scrollbar');

    return document.aautil._scrollbarWidth = ret;
  },

  setSelectionRange(el,start,end){
    window.getSelection().removeAllRanges();
    const range = new Range();

    if (el.childNodes.length === 0) {
      range.setStart(el, 0);
      range.setEnd(el, 0);
    } else {
      if ((el.childNodes.length !== 1) || (el.firstChild.nodeType !== 3)) {
        el.textContent = el.textContent;
      }
      if ((el.childNodes.length !== 1) || (el.firstChild.nodeType !== 3)) { return; }

      const len = el.textContent.length;
      if (start===undefined) { start = 0; }
      if (end===undefined) { end = len; }
      start = Math.max(0,Math.min(len,start));
      end = Math.max(0,Math.min(len,end));
      range.setStart(el.firstChild, start);
      range.setEnd(el.firstChild, end);
    }

    return window.getSelection().addRange(range);
  }

  };
}

$(document).ready(function() {
  const scrollbarWidth = document.aautil.scrollbarWidth();
  //document.aautil.addStylesheetRule "body{padding-top:"+scrollbarWidth+"px;}", 'body-steady-scrollbar-top'
  //document.aautil.addStylesheetRule "body{padding-left:"+scrollbarWidth+"px;}", 'body-steady-scrollbar-left'
  return document.aautil.addStylesheetRule(`body.has-scrollbar.no-scroll{padding-right:${scrollbarWidth}px;}`, 'body-steady-scrollbar-right');
});



$(document).on("click tap", ".toggle-button", function(event){
  return document.aautil.toggle(this,event, true, true);
});

$(document).on("click", ".dismisses-modal", event=> document.aautil.killTopModal());

$(document).on("click", ".toggle-on-button", function(event){
  return document.aautil.toggle(this,event,true,false);
});

$(document).on("click", ".toggle-off-button", function(event){
  return document.aautil.toggle(this,event,false,true);
});

$(document).on("input", "input[sizer]", function(event){
  let jqsizer;
  if (!(jqsizer = $(`#${event.target.getAttribute('sizer')}`)).length) { return; }
  return jqsizer.text(event.target.value);
});


$(document).on("click", ".posting-text", function(event){
  if (!event.originalEvent) { event.originalEvent = {}; }
  return event.originalEvent.cancelBubble = true;
});

$(document).on("blur", ".posting-text", function(event){
  let par;
  const el = event.target;
  if (el.hasAttribute('valueWas')) {
    el.textContent = el.getAttribute('valueWas');
  }
  if ((par=$(el).parent()).hasClass('posting-text-parent')) {
    par.removeClass('child-has-focus');
  }
});

$(document).on("focus", ".posting-text", function(event){
  let par;
  event.preventDefault();
  event.stopPropagation();
  const el = event.target;
  el.setAttribute('valueWas', el.textContent);
  if (el.textContent.length===0) {
    el.textContent = '${placeholder|<type the new value>}';
  }
  document.aautil.setSelectionRange(this, 0, this.textContent.length);
  if ((par=$(el).parent()).hasClass('posting-text-parent')) {
    par.addClass('child-has-focus');
  }
});

$(document).on('keydown', ".posting-text", function(event){
  const el = event.target;
  if (event.keyCode===13) { // newline
    if ((el.getAttribute('lines')!=='single') && !!event.shiftKey) { return; }
    event.preventDefault();
    event.stopPropagation();
    if (!el.hasAttribute('model') || !el.hasAttribute('name')) { return; }
    const modelId = el.getAttribute('model');
    const name = el.getAttribute('name');
    const message = (el.hasAttribute('message') ? el.getAttribute('message') : '');
    const form = {};
    form[name] = el.innerText;
    document.modelDOM.submitWSMessage(undefined,message,modelId,form);
    el.blur();
    return false;
  }
});



