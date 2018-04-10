document.ModelDOM_classes ||= {}
document.ModelDOM_classes.ModelDOM_diff = class ModelDOM_diff
  constructor:->
    @JSON_model_zero_detect_tolerance=1e-300 # used to differentiate a zero (indicating a diff) from a number as a field
    @JSON_model_zero_write_tolerance=1.1e-300 # used when writing a zero as a number
    @JSON_model_zero_correct_tolerance=1.2e-300 # used when reading a field value that was probably corrected to not look like zero
    @JSON_model_int_detect_tolerance=1e-10 # used to differentiate a count (skip/zero/delete) from a number as a value
    @JSON_model_int_write_tolerance=2e-10 # used when writing a number that could be mistaken for a count
    @JSON_model_int_correct_tolerance=3e-10 # used when reading a value that was probably corrected to not look like count
    @JSON_model_max_count=10000 # the max count (skip/zero/delete)

    @changedModels = {}


  applyModelDiffs:(diff)=>
    for modelId,modelDiff of diff when model=@model(modelId)
      @applyModelDiff(model,modelDiff)
    return


  applyModelDiff:(model,diff)=>
    # if the diff has the form [{field:val,...}] then the model is being edited
    # if the diff has the form {field:val,...} then the model is being set.
    #  The difference is in how the diff handles fields that are not specified in the diff.
    #   In edit mode they are left alone
    #   In set mode they are removed
    return if diff==null

    isEdit = false

    unless $.isPlainObject(diff)
      return ERROR("Can't apply model diff since the diff isn't an object")

    for field,d of diff
      f = model.fields[field]

      #the values may be strings/bools/null/maps/arrays/numbers...
      #    - string/bool/non-zero-number : the field (i.e. key) has the given basic value
      #    - null : the map has no value for that key. If editing then the key is deleted
      #    - zero : if there is any key with a zero as its value, then the map is interpretted as a diff.
      #            The only difference being that when applied as a diff, keys not specified in this map are not deleted from the applied to map.
      #            Keys that have zero as their value are otherwise ignored
      #    - array : the value is an array (see below)
      #    - map : the value is a map (i.e. interpretted like this one)


      if typeof(d)=='number'
        if Math.abs(d)<@JSON_model_zero_detect_tolerance
          isEdit = true
          continue
        else if Math.abs(d)<@JSON_model_zero_correct_tolerance
          d = 0


      change = true

      if $.isArray(d)
        model.fields[field] = @applyModelArrayDiff(f,d,model,field)
      else
        if $.isPlainObject(f) && f.array
          change = (v.index for v in f.array)
          @unlinkModels(model,childInfo.model) for childInfo in f.array when $.isPlainObject(childInfo) and childInfo.model


        if $.isPlainObject(d)
          model.fields[field] = @applyDictDiff(f,d,if field=='subtemplates' then model)
        else 
          if $.isPlainObject(f) and !f.array
            for chfield,chf of f
              if typeof(chf)=='string' and (chmodel = @models[chf])
                @unlinkModels(model,chmodel)
          if d!=null && d!=undefined
            model.fields[field] = d
          else
            delete model.fields[field]

      model.fieldChanges[field] = change


    # clear out unspecified fields if we're in set mode
    unless isEdit
      removeFields = (field for field of model.fields when !diff.hasOwnProperty(field) or (f=diff[field])==undefined or f==null or (typeof(f)=='number' and Math.abs(f)<@JSON_model_zero_detect_tolerance))
      for field in removeFields
        # if the field was an array but has been deleted then unlink child models
        if $.isPlainObject(f) && f.array
          model.fieldChanges[field] = (v.index for v in f.array)
          @unlinkModels(model,childInfo.model) for childInfo in f.array when childInfo && childInfo.model
        else
          if $.isPlainObject(f)
            for chfield,chf of f
              if typeof(chf)=='string' and (chmodel = @models[chf])
                @unlinkModels(model,chmodel)
          model.fieldChanges[field] = true
        field
        delete model.fields[field]

    if Object.keys(model.fieldChanges).length
      @changedModels[model.id] = model

    model

  applyDictDiff:(dict,diff,valuesAreChildrenOfModel)=>
    #if @_doDebugCall then return @debugCall("applyDictDiff",["model","diff"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    diff = {} unless $.isPlainObject(diff)
    dict = {} unless $.isPlainObject(dict)

    isEdit = true

    for field,d of diff
      f = dict[field]

      if typeof(d)=='number'
        if Math.abs(d)<@JSON_model_zero_detect_tolerance
          isEdit = true
          continue
        else if Math.abs(d)<@JSON_model_zero_correct_tolerance
          d = 0

      #the values may be strings/bools/null/maps/arrays/numbers...
      #    - string/bool : the field (i.e. key) has the given basic value
      #    - null : the map has no value for that key. If editing then the key is deleted
      #    - number : if there is any key with a number as its value, then the map is interpretted as a diff.
      #            The only difference being that when applied as a diff, keys not specified in this map are not deleted from the applied to map.
      #            Keys that have numbers as values are otherwise ignored
      #    - array : the value is an array (see below)
      #    - map : the value is a map (i.e. interpretted like this one)
      if valuesAreChildrenOfModel and d != f
        if typeof(f)=='string' and (model = @models[f])
          @unlinkModels(valuesAreChildrenOfModel,model)
        if typeof(d)=='string' and (model = @model(d))
          @linkModels(valuesAreChildrenOfModel,model)

      if $.isArray(d)
        dict[field] = @applyArrayDiff(f,d)
      else if $.isPlainObject(d)
        dict[field] = @applyDictDiff(f,d)
      else if d!=null && d!=undefined
        dict[field] = d
      else
        delete dict[field]

    unless isEdit
      removeFields = (field for field of dict when !diff.hasOwnProperty(field) or (f=diff[field])==undefined or f==null or (typeof(f)=='number' and Math.abs(f)<@JSON_model_zero_detect_tolerance))
      for field in removeFields
        if valuesAreChildrenOfModel and typeof(f=dict[field])=='string' and (model = @models[f])
          @unlinkModels(valuesAreChildrenOfModel,model)
        delete dict[field]

    dict


  # arrays at model level are different. They refer to arrays of child models and cannot contain other types of structure
  applyModelArrayDiff:(array, diff, parentModel, field)=>
    #if @_doDebugCall then return @debugCall("applyModelArrayDiff",["array","diff","parentModel"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    diff = [] unless $.isArray(diff)
    array = {array:[], changes:{}, markerIndex:@markerIndex(field)} unless $.isPlainObject(array) && $.isArray(array.array) && $.isPlainObject(array.changes)

    modelInd = 0
    # prevIndex is recorded with any change to a value, essentially it's the index of the element you should put that value after
    prevIndex = array.markerIndex

    for v,i in diff
      # the values (members of the array) may be strings/bools/null/maps/arrays/numbers...
      #  - string/bool/null : a basic value. If applying a diff, this overwrites the current value and advances down the array
      #  - zero : insert an undefined, to probably be replaced by the next value
      #          so, where this diff: [10,"new value at index 10"]  edits the current value at index 10 (if any) to become "new value at index 10"
      #          this one: [10,0,"new value at index 10"] inserts "new value at index 10" at index 10, and all existing entries from index 10 up are shifted accordingly
      #  - negative number : delete that many values (floats are rounded)
      #  - positive number : skip that many values (floats are rounded)
      #          note that if applied as a diff, any trailing values not specified (eg, apply diff [] to the tree ["b"]) are deleted
      #          this means that to insert an "a" before the "b", without removing the "a", we need a diff like ["b",1]
      #  - array : insert a value as an array (i.e. interpretted like this one)
      #  - map : insert a value as a map (like above)

      if typeof(v)=='number' && v>=-@JSON_model_max_count-@JSON_model_int_detect_tolerance && v<=@JSON_model_max_count+@JSON_model_int_detect_tolerance && Math.abs(v-Math.round(v))<@JSON_model_int_detect_tolerance
        v = Math.round(v)
        if v==0
          # insert a value at this index
          array.array.splice(modelInd,0,m={
            index: parentModel.nextIndex++,
            model: undefined
          })
          array.changes[m.index] = {type:"insert", prevIndex:prevIndex, value:v}
        else if v<0
          dels = Math.min(array.array.length-modelInd, -v)
          if dels>0
            for mi in [modelInd...modelInd+dels]
              m = array.array[mi]
              @unlinkModels(parentModel,m.model) if m.model
              if (c=array.changes[m.index]) && c.type=="insert"
                delete array.changes[m.index]
              else array.changes[m.index] = {type:"delete"}

              array.array.splice(modelInd,dels)
        else
          if skip = Math.min(array.array.length-modelInd, v)
            # potentially the prevIndex for the change record of the first skipped item is now different, update
            c.prevIndex = prevIndex if (c=array.changes[array.array[modelInd].index]) && c.prevIndex
            modelInd += skip
            # new prevIndex is the last item skipped
            prevIndex = array.array[modelInd-1].index
      else
        if typeof(v)=='string'
          v = @model(v)
        else v=undefined

        if modelInd<array.array.length
          # edit the value at this index
          m = array.array[modelInd]
          if m.model != v
            @unlinkModels(parentModel,m.model) if m.model
            m.model = v
            @linkModels(parentModel,m.model) if m.model
            if c=array.changes[m.index]
              c.type = "edit" unless c.type=="insert"
              c.prevIndex = prevIndex
              c.value = v
            else
              array.changes[m.index] = {type:"edit", prevIndex:prevIndex, value:v}
          else
            c.prevIndex = prevIndex if (c=array.changes[m.index]) && c.prevIndex
        else
          # insert a value at this index
          array.array.splice(modelInd,0,m={
            index: parentModel.nextIndex++,
            model: v
          })
          @linkModels(parentModel,m.model) if m.model
          array.changes[m.index] = {type:"insert", prevIndex:prevIndex, value:v}
        modelInd++
        prevIndex = m.index

    if modelInd<array.array.length
      # implicit deletion of remaining elements
      for mi in [modelInd...array.array.length]
        m = array.array[mi]
        @unlinkModels(parentModel,m.model) if m.model
        if array.changes[m.index]=="insert"
          delete array.changes[m.index]
        else
          array.changes[m.index] = {type:"delete"}
      array.array.splice(modelInd)

    array


  applyArrayDiff:(array, diff)=>
    #if @_doDebugCall then return @debugCall("applyArrayDiff",["array","diff"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    diff = [] unless $.isArray(diff)
    array = [] unless $.isArray(array)

    modelInd = 0
    for v,i in diff
      # the values (members of the array) may be strings/bools/null/maps/arrays/numbers...
      #  - string/bool/null : a basic value. If applying a diff, this overwrites the current value and advances down the array
      #  - zero : insert an undefined, to probably be replaced by the next value
      #          so, where this diff: [10,"new value at index 10"]  edits the current value at index 10 (if any) to become "new value at index 10"
      #          this one: [10,0,"new value at index 10"] inserts "new value at index 10" at index 10, and all existing entries from index 10 up are shifted accordingly
      #  - negative number : delete that many values (floats are rounded)
      #  - positive number : skip that many values (floats are rounded)
      #          note that if applied as a diff, any trailing values not specified (eg, apply diff [] to the tree ["b"]) are deleted
      #          this means that to insert an "a" before the "b", without removing the "a", we need a diff like ["b",1]
      #  - array : insert a value as an array (i.e. interpretted like this one)
      #  - map : insert a value as a map (like above)
      if typeof(v)=='number' && v>=-@JSON_model_max_count-@JSON_model_int_detect_tolerance && v<=@JSON_model_max_count+@JSON_model_int_detect_tolerance && Math.abs(v-Math.round(v))<@JSON_model_int_detect_tolerance
        v = Math.round(v)
        if v==0
          array.splice(modelInd,0,undefined)
        else if v<0
          dels = Math.min(array.length-modelInd, -v)
          array.splice(modelInd,dels) if dels>0
        else
          modelInd += Math.min(array.length-modelInd, v)
      else
        if typeof(v)=='number' && v>=-@JSON_model_max_count-@JSON_model_int_correct_tolerance && v<=@JSON_model_max_count+@JSON_model_int_correct_tolerance && Math.abs(v-Math.round(v))<@JSON_model_int_correct_tolerance
            v = Math.round(v)
        if modelInd<array.length
          if $.isPlainObject(v)
            v = @applyDictDiff(array[modelInd], v)
          else if $.isArray(v)
            v = @applyArrayDiff(array[modelInd], v)

          # edit the value at this index
          array[modelInd] = v
        else
          if $.isPlainObject(v)
            v = @applyDictDiff({}, v)
          else if $.isArray(v)
            v = @applyArrayDiff([], v)

          # insert a value at this index
          array.splice(modelInd,0,v)
        modelInd++

    array.splice(modelInd) unless modelInd==array.length
    array



  clearModelChanges:=>
    #if @_doDebugCall then return @debugCall("clearModelChanges",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    for id,model of @changedModels
      for field of model.fieldChanges
        model.fields[field].changes = {} if $.isPlainObject(model.fields[field]) and $.isPlainObject(model.fields[field].changes) and $.isArray(model.fields[field].array)
      model.fieldChanges = {}
    @changedModels = {}
    return

