document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_templating = class ModelDOM_templating
  constructor:->
 

  quickStartupTemplatedText:(value,model,parentModelId,fieldSubstitutes,elid)=>
    if startupFields = @startupTemplateFields(value)
      value = @templatedText(value,fieldSubstitutes||{},elid,model.id,parentModelId,startupFields)
    if fields = @templateFields(value)
      value = @templatedText(value,fieldSubstitutes||{},elid,model.id,parentModelId,startupFields,true)
    value

  quickTemplatedText:(value,model,parentModelId,fieldSubstitutes,elid)=>
    if startupFields = @startupTemplateFields(value)
      value = @templatedText(value,fieldSubstitutes||{},elid,model.id,parentModelId,startupFields)

    if fields = @templateFields(value)
      value = @templatedText(value,fieldSubstitutes||{},elid,model.id,parentModelId,startupFields,true)
    if fields = @templateFields(value)
      value = @templatedText(value,model.fields,elid,model.id,parentModelId,startupFields)
    value




  startupTemplateFields:(template)=>
    # simple text substitutions for non-model vars, i.e. fields set by parent elements for their descendents
    # eg ${{message?has render|no render}}
    # that used the ? op, which tests to see if the field exists in the model and is truthy (i.e. not null, false, 0, or an empty array)
    #   if so, the substitution evals to "has render", otherwise the default "no render" is used
    #   other ops include (all can have a default arg by using the ${field<op>val|default} syntax:
    # field==blah  --  the field exists and equals "blah", true or false
    # field->blah  --  just use "blah" if the field exists at all (even if falsey)
    # field*10     --  substitute with the field value * 10
    # field+10     --  substitute with the field value + 10
    # field-10     --  substitute with the field value - 10
    # field/10     --  substitute with the field value / 10
    regex = /\$\{\{(\w+)(?:(?:([\*\/\+\-\?]|->)|([\!=]=|[><]=?)([^|}?]*)(\?)?)([^|}]*))?(?:\|((?:[^\{\}]|\{[^\{\}]*\})*))?\}\}/g
    ret = []


    while match = regex.exec(template)
      compareTo = match[4]
      hasCompareTo = match[5]=='?'
      val = match[6]
      ret.push({
        field:match[1],
        val: val,
        def: match[7],
        transform:
          switch match[2]||match[3]
            when '=='
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v==compareTo
                    else
                      ""+(v==compareTo)
              )(val,compareTo,hasCompareTo)
            when '!='
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v!=compareTo
                    else
                      ""+(v!=compareTo)
              )(val,compareTo,hasCompareTo)
            when '<'
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v<compareTo
                    else
                      ""+(v<compareTo)
              )(val,compareTo,hasCompareTo)
            when '<='
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v<=compareTo
                    else
                      ""+(v<=compareTo)
              )(val,compareTo,hasCompareTo)
            when '>'
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v>compareTo
                    else
                      ""+(v>compareTo)
              )(val,compareTo,hasCompareTo)
            when '>='
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v>=compareTo
                    else
                      ""+(v>=compareTo)
              )(val,compareTo,hasCompareTo)
            when '?'
              ((val)->
                (v)->
                  val if v and (v==true or typeof(v)=='string' or typeof(v)=='number' or ($.isPlainObject(v) and v.array and v.array.length))
              )(val)
            when '->'
              ((val)->
                (v)->
                  val
              )(val)
            when '*'
              ((mul)->
                (v)->
                  ""+((+v)* mul) if typeof(v)=='string' or typeof(v)=='number'
              )(+val)
            when '/'
              ((div)->
                (v)->
                  ""+((+v)/ div) if typeof(v)=='string' or typeof(v)=='number'
              )(+val)
            when '+'
              ((add)->
                (v)->
                  ""+((+v)+ add) if typeof(v)=='string' or typeof(v)=='number'
              )(+val)
            when '-'
              ((sub)->
                (v)->
                  ""+((+v)- sub) if typeof(v)=='string' or typeof(v)=='number'
              )(+val)
        defFields:(if match[7]==undefined then undefined else @templateFields(match[7]))
        start:regex.lastIndex-match[0].length,
        length:match[0].length
      })
    ret if ret.length




  templateFields:(template)=>
    #if @_doDebugCall then return @debugCall("templateFields",["template"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    # simple text substitutions for model vars
    # eg ${render?has render|no render}
    # that used the ? op, which tests to see if the field exists in the model and is truthy (i.e. not null, false, 0, or an empty array)
    #   if so, the substitution evals to "has render", otherwise the default "no render" is used
    #   other ops include (all can have a default arg by using the ${field<op>val|default} syntax:
    # field==blah  --  the field exists and equals "blah", true or false
    # field->blah  --  just use "blah" if the field exists at all (even if falsey)
    # field*10     --  substitute with the field value * 10
    # field+10     --  substitute with the field value + 10
    # field-10     --  substitute with the field value - 10
    # field/10     --  substitute with the field value / 10
    regex = /\$\{(\w+)(?:(?:([\*\/\+\-\?]|->)|([\!=]=|[><]=?)([^|}?]*)(\?)?)([^|}]*))?(?:\|((?:[^\{\}]|\{[^\{\}]*\})*))?\}/g
    ret = []


    while match = regex.exec(template)
      compareTo = match[4]
      hasCompareTo = match[5]=='?'
      val = match[6]
      ret.push({
        field:match[1],
        val: val,
        def: match[7],
        transform:
          switch match[2]||match[3]
            when '=='
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v==compareTo
                    else
                      ""+(v==compareTo)
              )(val,compareTo,hasCompareTo)
            when '!='
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v!=compareTo
                    else
                      ""+(v!=compareTo)
              )(val,compareTo,hasCompareTo)
            when '<'
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v<compareTo
                    else
                      ""+(v<compareTo)
              )(val,compareTo,hasCompareTo)
            when '<='
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v<=compareTo
                    else
                      ""+(v<=compareTo)
              )(val,compareTo,hasCompareTo)
            when '>'
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v>compareTo
                    else
                      ""+(v>compareTo)
              )(val,compareTo,hasCompareTo)
            when '>='
              ((val,compareTo,hasCompareTo)->
                (v)->
                  if typeof(v)=='string' or typeof(v)=='number' or v==true or v==false
                    if hasCompareTo
                      val if v>=compareTo
                    else
                      ""+(v>=compareTo)
              )(val,compareTo,hasCompareTo)
            when '?'
              ((val)->
                (v)->
                  val if v and (v==true or typeof(v)=='string' or typeof(v)=='number' or ($.isPlainObject(v) and v.array and v.array.length))
              )(val)
            when '->'
              ((val)->
                (v)->
                  val
              )(val)
            when '*'
              ((mul)->
                (v)->
                  ""+((+v)* mul) if typeof(v)=='string' or typeof(v)=='number'
              )(+val)
            when '/'
              ((div)->
                (v)->
                  ""+((+v)/ div) if typeof(v)=='string' or typeof(v)=='number'
              )(+val)
            when '+'
              ((add)->
                (v)->
                  ""+((+v)+ add) if typeof(v)=='string' or typeof(v)=='number'
              )(+val)
            when '-'
              ((sub)->
                (v)->
                  ""+((+v)- sub) if typeof(v)=='string' or typeof(v)=='number'
              )(+val)
        defFields:(if match[7]==undefined then undefined else @templateFields(match[7]))
        start:regex.lastIndex-match[0].length,
        length:match[0].length
      })
    ret if ret.length


  templatedText:(text,dict,elid,modelId,parentModelId,fields,noDefaults,escape)=>
    #if @_doDebugCall then return @debugCall("templatedText",["escape",text","dict","modelId","elid","fields","noDefaults"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    return text unless fields || (fields = @templateFields(text))

    ret = ""
    ind = 0
    for field in fields
      if field.start>ind then ret += text.substring(ind,field.start)

      ret += switch field.field
        when "__id"
          if elid
            elid
          else if noDefaults && typeof(v = dict[field.field])=="string"
            v
          else
            text.substring(field.start,field.start+field.length)
        when "__model"
          if modelId!=undefined
            modelId
          else if noDefaults && typeof(v = dict[field.field])=="string"
            v
          else
            text.substring(field.start,field.start+field.length)
        when "__basemodel"
          if modelId!=undefined
            @modelIdWithVariant(modelId)
          else if noDefaults && typeof(v = dict[field.field])=="string"
            v
          else
            text.substring(field.start,field.start+field.length)
        when "__parentmodel"
          if parentModelId!=undefined
            if typeof(parentModelId)=='string'
              parentModelId
            else
              parentModelId.id
          else if noDefaults && typeof(v = dict[field.field])=="string"
            v
          else
            text.substring(field.start,field.start+field.length)
        when "__baseparentmodel"
          if parentModelId!=undefined
            @modelIdWithVariant(if typeof(parentModelId)=='string'
              parentModelId
            else
              parentModelId.id
            )
          else if noDefaults && typeof(v = dict[field.field])=="string"
            v
          else
            text.substring(field.start,field.start+field.length)
        else
          v = dict[field.field]
          if field.transform and (v=field.transform(v))!=undefined
            v
          else if typeof(v)=="string" and v!=""
            v
          else if typeof(v)=="number"
            ""+v
          else if noDefaults
            text.substring(field.start,field.start+field.length)
          else if field.def!=undefined
            @templatedText(field.def,dict,elid,modelId,field.defFields)
          else
            "_"

      ind = field.start+field.length
    ret += text.substring(ind,text.length) if ind<text.length

    switch escape
      when 'html'
        ret = document.aautil.escapeHTML(ret)
      when 'attr' 
        ret = document.aautil.escapeAttribute(ret)
    ret
