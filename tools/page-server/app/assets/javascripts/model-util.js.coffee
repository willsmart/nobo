document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_util = class ModelDOM_util
  constructor:->
 
  isEqual:(a,b)->
    if $.isPlainObject(a)
      return false unless $.isPlainObject(b)
      for own k,v of a
        return false unless b.hasOwnProperty[k] && document.modelDOM.isEqual(v,b[k])
      for own k,v of b
        return false unless a.hasOwnProperty[k]
      true
    else if $.isArray(a)
      return false unless $.isArray(b) && a.length==b.length
      for v,i in a
        return false unless document.modelDOM.isEqual(v,b[i])
      true
    else
      a==b

  clone:(value)->
    if $.isPlainObject(value)
      ret = {}
      for k,v of value
        ret[k] = document.modelDOM.cloneModelValue(v)
      ret
    else if $.isArray(value)
      ret = []
      for v in value
        ret.push(document.modelDOM.cloneModelValue(v))
      ret
    else value

  sanitizeClassName:(name,ignoreClassStartRules)->
    name="" unless typeof name == 'string'
    ret = ''
    re = /[^a-zA-Z0-9]/g
    index = 0
    while (match = re.exec(name)) != null
      ret += name.substring(index,match.index) if match.index>index
      ret += name.charCodeAt(match.index)+"-"
      index = match.index+1
    ret += name.substring(index) if name.length>index

    ret = "c-"+ret if !ignoreClassStartRules && (ret.length<2 || /^\d/.test(ret))
    ret

  formAsNameValues:(form)->
    ret = {}
    if form && (els = form.elements)
      for el in els
        ret[el.name]=el.value
    ret
