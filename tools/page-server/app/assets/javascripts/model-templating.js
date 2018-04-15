/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_templating;
if (!document.ModelDOM_classes) { document.ModelDOM_classes = {}; }
document.ModelDOM_classes.ModelDOM_templating = (ModelDOM_templating = class ModelDOM_templating {
  constructor() {
    this.quickStartupTemplatedText = this.quickStartupTemplatedText.bind(this);
    this.quickTemplatedText = this.quickTemplatedText.bind(this);
    this.startupTemplateFields = this.startupTemplateFields.bind(this);
    this.templateFields = this.templateFields.bind(this);
    this.templatedText = this.templatedText.bind(this);
  }
 

  quickStartupTemplatedText(value,model,parentModelId,fieldSubstitutes,elid){
    let fields, startupFields;
    if (startupFields = this.startupTemplateFields(value)) {
      value = this.templatedText(value,fieldSubstitutes||{},elid,model.id,parentModelId,startupFields);
    }
    if (fields = this.templateFields(value)) {
      value = this.templatedText(value,fieldSubstitutes||{},elid,model.id,parentModelId,startupFields,true);
    }
    return value;
  }

  quickTemplatedText(value,model,parentModelId,fieldSubstitutes,elid){
    let fields, startupFields;
    if (startupFields = this.startupTemplateFields(value)) {
      value = this.templatedText(value,fieldSubstitutes||{},elid,model.id,parentModelId,startupFields);
    }

    if (fields = this.templateFields(value)) {
      value = this.templatedText(value,fieldSubstitutes||{},elid,model.id,parentModelId,startupFields,true);
    }
    if (fields = this.templateFields(value)) {
      value = this.templatedText(value,model.fields,elid,model.id,parentModelId,startupFields);
    }
    return value;
  }




  startupTemplateFields(template){
    // simple text substitutions for non-model vars, i.e. fields set by parent elements for their descendents
    // eg ${{message?has render|no render}}
    // that used the ? op, which tests to see if the field exists in the model and is truthy (i.e. not null, false, 0, or an empty array)
    //   if so, the substitution evals to "has render", otherwise the default "no render" is used
    //   other ops include (all can have a default arg by using the ${field<op>val|default} syntax:
    // field==blah  --  the field exists and equals "blah", true or false
    // field->blah  --  just use "blah" if the field exists at all (even if falsey)
    // field*10     --  substitute with the field value * 10
    // field+10     --  substitute with the field value + 10
    // field-10     --  substitute with the field value - 10
    // field/10     --  substitute with the field value / 10
    let match;
    let val, compareTo, hasCompareTo;
    const regex = /\$\{\{(\w+)(?:(?:([\*\/\+\-\?]|->)|([\!=]=|[><]=?)([^|}?]*)(\?)?)([^|}]*))?(?:\|((?:[^\{\}]|\{[^\{\}]*\})*))?\}\}/g;
    const ret = [];


    while ((match = regex.exec(template))) {
      compareTo = match[4];
      hasCompareTo = match[5]==='?';
      val = match[6];
      ret.push({
        field:match[1],
        val,
        def: match[7],
        transform:
          (() => { switch (match[2]||match[3]) {
            case '==':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v===compareTo) { return val; }
                    } else {
                      return `${v===compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '!=':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v!==compareTo) { return val; }
                    } else {
                      return `${v!==compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '<':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v<compareTo) { return val; }
                    } else {
                      return `${v<compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '<=':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v<=compareTo) { return val; }
                    } else {
                      return `${v<=compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '>':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v>compareTo) { return val; }
                    } else {
                      return `${v>compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '>=':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v>=compareTo) { return val; }
                    } else {
                      return `${v>=compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '?':
              return (val=>
                function(v){
                  if (v && ((v===true) || (typeof(v)==='string') || (typeof(v)==='number') || ($.isPlainObject(v) && v.array && v.array.length))) { return val; }
                }
              )(val);
            case '->':
              return (val=>
                v=> val
              )(val);
            case '*':
              return (mul=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number')) { return `${(+v)* mul}`; }
                }
              )(+val);
            case '/':
              return (div=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number')) { return `${(+v)/ div}`; }
                }
              )(+val);
            case '+':
              return (add=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number')) { return `${(+v)+ add}`; }
                }
              )(+val);
            case '-':
              return (sub=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number')) { return `${(+v)- sub}`; }
                }
              )(+val);
          } })(),
        defFields:(match[7]===undefined ? undefined : this.templateFields(match[7])),
        start:regex.lastIndex-match[0].length,
        length:match[0].length
      });
    }
    if (ret.length) { return ret; }
  }




  templateFields(template){
    //if @_doDebugCall then return @debugCall("templateFields",["template"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    // simple text substitutions for model vars
    // eg ${render?has render|no render}
    // that used the ? op, which tests to see if the field exists in the model and is truthy (i.e. not null, false, 0, or an empty array)
    //   if so, the substitution evals to "has render", otherwise the default "no render" is used
    //   other ops include (all can have a default arg by using the ${field<op>val|default} syntax:
    // field==blah  --  the field exists and equals "blah", true or false
    // field->blah  --  just use "blah" if the field exists at all (even if falsey)
    // field*10     --  substitute with the field value * 10
    // field+10     --  substitute with the field value + 10
    // field-10     --  substitute with the field value - 10
    // field/10     --  substitute with the field value / 10
    let match;
    let val, compareTo, hasCompareTo;
    const regex = /\$\{(\w+)(?:(?:([\*\/\+\-\?]|->)|([\!=]=|[><]=?)([^|}?]*)(\?)?)([^|}]*))?(?:\|((?:[^\{\}]|\{[^\{\}]*\})*))?\}/g;
    const ret = [];


    while ((match = regex.exec(template))) {
      compareTo = match[4];
      hasCompareTo = match[5]==='?';
      val = match[6];
      ret.push({
        field:match[1],
        val,
        def: match[7],
        transform:
          (() => { switch (match[2]||match[3]) {
            case '==':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v===compareTo) { return val; }
                    } else {
                      return `${v===compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '!=':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v!==compareTo) { return val; }
                    } else {
                      return `${v!==compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '<':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v<compareTo) { return val; }
                    } else {
                      return `${v<compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '<=':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v<=compareTo) { return val; }
                    } else {
                      return `${v<=compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '>':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v>compareTo) { return val; }
                    } else {
                      return `${v>compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '>=':
              return ((val,compareTo,hasCompareTo)=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number') || (v===true) || (v===false)) {
                    if (hasCompareTo) {
                      if (v>=compareTo) { return val; }
                    } else {
                      return `${v>=compareTo}`;
                    }
                  }
                }
              )(val,compareTo,hasCompareTo);
            case '?':
              return (val=>
                function(v){
                  if (v && ((v===true) || (typeof(v)==='string') || (typeof(v)==='number') || ($.isPlainObject(v) && v.array && v.array.length))) { return val; }
                }
              )(val);
            case '->':
              return (val=>
                v=> val
              )(val);
            case '*':
              return (mul=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number')) { return `${(+v)* mul}`; }
                }
              )(+val);
            case '/':
              return (div=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number')) { return `${(+v)/ div}`; }
                }
              )(+val);
            case '+':
              return (add=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number')) { return `${(+v)+ add}`; }
                }
              )(+val);
            case '-':
              return (sub=>
                function(v){
                  if ((typeof(v)==='string') || (typeof(v)==='number')) { return `${(+v)- sub}`; }
                }
              )(+val);
          } })(),
        defFields:(match[7]===undefined ? undefined : this.templateFields(match[7])),
        start:regex.lastIndex-match[0].length,
        length:match[0].length
      });
    }
    if (ret.length) { return ret; }
  }


  templatedText(text,dict,elid,modelId,parentModelId,fields,noDefaults,escape){
    //if @_doDebugCall then return @debugCall("templatedText",["escape",text","dict","modelId","elid","fields","noDefaults"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    if (!fields && (!(fields = this.templateFields(text)))) { return text; }

    let ret = "";
    let ind = 0;
    for (var field of fields) {
      if (field.start>ind) { ret += text.substring(ind,field.start); }

      ret += (() => { let v;
      switch (field.field) {
        case "__id":
          if (elid) {
            return elid;
          } else if (noDefaults && (typeof(v = dict[field.field])==="string")) {
            return v;
          } else {
            return text.substring(field.start,field.start+field.length);
          }
        case "__model":
          if (modelId!==undefined) {
            return modelId;
          } else if (noDefaults && (typeof(v = dict[field.field])==="string")) {
            return v;
          } else {
            return text.substring(field.start,field.start+field.length);
          }
        case "__basemodel":
          if (modelId!==undefined) {
            return this.modelIdWithVariant(modelId);
          } else if (noDefaults && (typeof(v = dict[field.field])==="string")) {
            return v;
          } else {
            return text.substring(field.start,field.start+field.length);
          }
        case "__parentmodel":
          if (parentModelId!==undefined) {
            if (typeof(parentModelId)==='string') {
              return parentModelId;
            } else {
              return parentModelId.id;
            }
          } else if (noDefaults && (typeof(v = dict[field.field])==="string")) {
            return v;
          } else {
            return text.substring(field.start,field.start+field.length);
          }
        case "__baseparentmodel":
          if (parentModelId!==undefined) {
            return this.modelIdWithVariant(typeof(parentModelId)==='string' ?
              parentModelId
            :
              parentModelId.id
            );
          } else if (noDefaults && (typeof(v = dict[field.field])==="string")) {
            return v;
          } else {
            return text.substring(field.start,field.start+field.length);
          }
        default:
          v = dict[field.field];
          if (field.transform && ((v=field.transform(v))!==undefined)) {
            return v;
          } else if ((typeof(v)==="string") && (v!=="")) {
            return v;
          } else if (typeof(v)==="number") {
            return `${v}`;
          } else if (noDefaults) {
            return text.substring(field.start,field.start+field.length);
          } else if (field.def!==undefined) {
            return this.templatedText(field.def,dict,elid,modelId,field.defFields);
          } else {
            return "_";
          }
      } })();

      ind = field.start+field.length;
    }
    if (ind<text.length) { ret += text.substring(ind,text.length); }

    switch (escape) {
      case 'html':
        ret = document.aautil.escapeHTML(ret);
        break;
      case 'attr': 
        ret = document.aautil.escapeAttribute(ret);
        break;
    }
    return ret;
  }
});
