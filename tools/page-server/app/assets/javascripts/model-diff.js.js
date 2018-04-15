/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS202: Simplify dynamic range loops
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let ModelDOM_diff;
if (!document.ModelDOM_classes) { document.ModelDOM_classes = {}; }
document.ModelDOM_classes.ModelDOM_diff = (ModelDOM_diff = class ModelDOM_diff {
  constructor() {
    this.applyModelDiffs = this.applyModelDiffs.bind(this);
    this.applyModelDiff = this.applyModelDiff.bind(this);
    this.applyDictDiff = this.applyDictDiff.bind(this);
    this.applyModelArrayDiff = this.applyModelArrayDiff.bind(this);
    this.applyArrayDiff = this.applyArrayDiff.bind(this);
    this.clearModelChanges = this.clearModelChanges.bind(this);
    this.JSON_model_zero_detect_tolerance=1e-300; // used to differentiate a zero (indicating a diff) from a number as a field
    this.JSON_model_zero_write_tolerance=1.1e-300; // used when writing a zero as a number
    this.JSON_model_zero_correct_tolerance=1.2e-300; // used when reading a field value that was probably corrected to not look like zero
    this.JSON_model_int_detect_tolerance=1e-10; // used to differentiate a count (skip/zero/delete) from a number as a value
    this.JSON_model_int_write_tolerance=2e-10; // used when writing a number that could be mistaken for a count
    this.JSON_model_int_correct_tolerance=3e-10; // used when reading a value that was probably corrected to not look like count
    this.JSON_model_max_count=10000; // the max count (skip/zero/delete)

    this.changedModels = {};
  }


  applyModelDiffs(diff){
    for (let modelId in diff) {
      var model;
      const modelDiff = diff[modelId];
      if ((model=this.model(modelId))) {
        this.applyModelDiff(model,modelDiff);
      }
    }
  }


  applyModelDiff(model,diff){
    // if the diff has the form [{field:val,...}] then the model is being edited
    // if the diff has the form {field:val,...} then the model is being set.
    //  The difference is in how the diff handles fields that are not specified in the diff.
    //   In edit mode they are left alone
    //   In set mode they are removed
    let chf, chfield, childInfo, chmodel;
    let v, field, f;
    if (diff===null) { return; }

    let isEdit = false;

    if (!$.isPlainObject(diff)) {
      return ERROR("Can't apply model diff since the diff isn't an object");
    }

    for (field in diff) {
      let d = diff[field];
      f = model.fields[field];

      //the values may be strings/bools/null/maps/arrays/numbers...
      //    - string/bool/non-zero-number : the field (i.e. key) has the given basic value
      //    - null : the map has no value for that key. If editing then the key is deleted
      //    - zero : if there is any key with a zero as its value, then the map is interpretted as a diff.
      //            The only difference being that when applied as a diff, keys not specified in this map are not deleted from the applied to map.
      //            Keys that have zero as their value are otherwise ignored
      //    - array : the value is an array (see below)
      //    - map : the value is a map (i.e. interpretted like this one)


      if (typeof(d)==='number') {
        if (Math.abs(d)<this.JSON_model_zero_detect_tolerance) {
          isEdit = true;
          continue;
        } else if (Math.abs(d)<this.JSON_model_zero_correct_tolerance) {
          d = 0;
        }
      }


      let change = true;

      if ($.isArray(d)) {
        model.fields[field] = this.applyModelArrayDiff(f,d,model,field);
      } else {
        if ($.isPlainObject(f) && f.array) {
          change = ((() => {
            const result = [];
            for (v of f.array) {               result.push(v.index);
            }
            return result;
          })());
          for (childInfo of f.array) { if ($.isPlainObject(childInfo) && childInfo.model) { this.unlinkModels(model,childInfo.model); } }
        }


        if ($.isPlainObject(d)) {
          model.fields[field] = this.applyDictDiff(f,d,field==='subtemplates' ? model : undefined);
        } else { 
          if ($.isPlainObject(f) && !f.array) {
            for (chfield in f) {
              chf = f[chfield];
              if ((typeof(chf)==='string') && (chmodel = this.models[chf])) {
                this.unlinkModels(model,chmodel);
              }
            }
          }
          if ((d!==null) && (d!==undefined)) {
            model.fields[field] = d;
          } else {
            delete model.fields[field];
          }
        }
      }

      model.fieldChanges[field] = change;
    }


    // clear out unspecified fields if we're in set mode
    if (!isEdit) {
      const removeFields = ((() => {
        const result1 = [];
        for (field in model.fields) {
          if (!diff.hasOwnProperty(field) || ((f=diff[field])===undefined) || (f===null) || ((typeof(f)==='number') && (Math.abs(f)<this.JSON_model_zero_detect_tolerance))) {
            result1.push(field);
          }
        }
        return result1;
      })());
      for (field of removeFields) {
        // if the field was an array but has been deleted then unlink child models
        if ($.isPlainObject(f) && f.array) {
          model.fieldChanges[field] = ((() => {
            const result2 = [];
            for (v of f.array) {               result2.push(v.index);
            }
            return result2;
          })());
          for (childInfo of f.array) { if (childInfo && childInfo.model) { this.unlinkModels(model,childInfo.model); } }
        } else {
          if ($.isPlainObject(f)) {
            for (chfield in f) {
              chf = f[chfield];
              if ((typeof(chf)==='string') && (chmodel = this.models[chf])) {
                this.unlinkModels(model,chmodel);
              }
            }
          }
          model.fieldChanges[field] = true;
        }
        field;
        delete model.fields[field];
      }
    }

    if (Object.keys(model.fieldChanges).length) {
      this.changedModels[model.id] = model;
    }

    return model;
  }

  applyDictDiff(dict,diff,valuesAreChildrenOfModel){
    //if @_doDebugCall then return @debugCall("applyDictDiff",["model","diff"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    let model;
    let field, f;
    if (!$.isPlainObject(diff)) { diff = {}; }
    if (!$.isPlainObject(dict)) { dict = {}; }

    let isEdit = true;

    for (field in diff) {
      let d = diff[field];
      f = dict[field];

      if (typeof(d)==='number') {
        if (Math.abs(d)<this.JSON_model_zero_detect_tolerance) {
          isEdit = true;
          continue;
        } else if (Math.abs(d)<this.JSON_model_zero_correct_tolerance) {
          d = 0;
        }
      }

      //the values may be strings/bools/null/maps/arrays/numbers...
      //    - string/bool : the field (i.e. key) has the given basic value
      //    - null : the map has no value for that key. If editing then the key is deleted
      //    - number : if there is any key with a number as its value, then the map is interpretted as a diff.
      //            The only difference being that when applied as a diff, keys not specified in this map are not deleted from the applied to map.
      //            Keys that have numbers as values are otherwise ignored
      //    - array : the value is an array (see below)
      //    - map : the value is a map (i.e. interpretted like this one)
      if (valuesAreChildrenOfModel && (d !== f)) {
        if ((typeof(f)==='string') && (model = this.models[f])) {
          this.unlinkModels(valuesAreChildrenOfModel,model);
        }
        if ((typeof(d)==='string') && (model = this.model(d))) {
          this.linkModels(valuesAreChildrenOfModel,model);
        }
      }

      if ($.isArray(d)) {
        dict[field] = this.applyArrayDiff(f,d);
      } else if ($.isPlainObject(d)) {
        dict[field] = this.applyDictDiff(f,d);
      } else if ((d!==null) && (d!==undefined)) {
        dict[field] = d;
      } else {
        delete dict[field];
      }
    }

    if (!isEdit) {
      const removeFields = ((() => {
        const result = [];
        for (field in dict) {
          if (!diff.hasOwnProperty(field) || ((f=diff[field])===undefined) || (f===null) || ((typeof(f)==='number') && (Math.abs(f)<this.JSON_model_zero_detect_tolerance))) {
            result.push(field);
          }
        }
        return result;
      })());
      for (field of removeFields) {
        if (valuesAreChildrenOfModel && (typeof(f=dict[field])==='string') && (model = this.models[f])) {
          this.unlinkModels(valuesAreChildrenOfModel,model);
        }
        delete dict[field];
      }
    }

    return dict;
  }


  // arrays at model level are different. They refer to arrays of child models and cannot contain other types of structure
  applyModelArrayDiff(array, diff, parentModel, field){
    //if @_doDebugCall then return @debugCall("applyModelArrayDiff",["array","diff","parentModel"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    let m, mi;
    if (!$.isArray(diff)) { diff = []; }
    if (!$.isPlainObject(array) || !$.isArray(array.array) || !$.isPlainObject(array.changes)) { array = {array:[], changes:{}, markerIndex:this.markerIndex(field)}; }

    let modelInd = 0;
    // prevIndex is recorded with any change to a value, essentially it's the index of the element you should put that value after
    let prevIndex = array.markerIndex;

    for (let i = 0; i < diff.length; i++) {
      // the values (members of the array) may be strings/bools/null/maps/arrays/numbers...
      //  - string/bool/null : a basic value. If applying a diff, this overwrites the current value and advances down the array
      //  - zero : insert an undefined, to probably be replaced by the next value
      //          so, where this diff: [10,"new value at index 10"]  edits the current value at index 10 (if any) to become "new value at index 10"
      //          this one: [10,0,"new value at index 10"] inserts "new value at index 10" at index 10, and all existing entries from index 10 up are shifted accordingly
      //  - negative number : delete that many values (floats are rounded)
      //  - positive number : skip that many values (floats are rounded)
      //          note that if applied as a diff, any trailing values not specified (eg, apply diff [] to the tree ["b"]) are deleted
      //          this means that to insert an "a" before the "b", without removing the "a", we need a diff like ["b",1]
      //  - array : insert a value as an array (i.e. interpretted like this one)
      //  - map : insert a value as a map (like above)

      var c;
      let v = diff[i];
      if ((typeof(v)==='number') && (v>=(-this.JSON_model_max_count-this.JSON_model_int_detect_tolerance)) && (v<=(this.JSON_model_max_count+this.JSON_model_int_detect_tolerance)) && (Math.abs(v-Math.round(v))<this.JSON_model_int_detect_tolerance)) {
        v = Math.round(v);
        if (v===0) {
          // insert a value at this index
          array.array.splice(modelInd,0,(m={
            index: parentModel.nextIndex++,
            model: undefined
          }));
          array.changes[m.index] = {type:"insert", prevIndex, value:v};
        } else if (v<0) {
          const dels = Math.min(array.array.length-modelInd, -v);
          if (dels>0) {
            var asc, end;
            for (mi = modelInd, end = modelInd+dels, asc = modelInd <= end; asc ? mi < end : mi > end; asc ? mi++ : mi--) {
              m = array.array[mi];
              if (m.model) { this.unlinkModels(parentModel,m.model); }
              if ((c=array.changes[m.index]) && (c.type==="insert")) {
                delete array.changes[m.index];
              } else { array.changes[m.index] = {type:"delete"}; }

              array.array.splice(modelInd,dels);
            }
          }
        } else {
          var skip;
          if (skip = Math.min(array.array.length-modelInd, v)) {
            // potentially the prevIndex for the change record of the first skipped item is now different, update
            if ((c=array.changes[array.array[modelInd].index]) && c.prevIndex) { c.prevIndex = prevIndex; }
            modelInd += skip;
            // new prevIndex is the last item skipped
            prevIndex = array.array[modelInd-1].index;
          }
        }
      } else {
        if (typeof(v)==='string') {
          v = this.model(v);
        } else { v=undefined; }

        if (modelInd<array.array.length) {
          // edit the value at this index
          m = array.array[modelInd];
          if (m.model !== v) {
            if (m.model) { this.unlinkModels(parentModel,m.model); }
            m.model = v;
            if (m.model) { this.linkModels(parentModel,m.model); }
            if (c=array.changes[m.index]) {
              if (c.type!=="insert") { c.type = "edit"; }
              c.prevIndex = prevIndex;
              c.value = v;
            } else {
              array.changes[m.index] = {type:"edit", prevIndex, value:v};
            }
          } else {
            if ((c=array.changes[m.index]) && c.prevIndex) { c.prevIndex = prevIndex; }
          }
        } else {
          // insert a value at this index
          array.array.splice(modelInd,0,(m={
            index: parentModel.nextIndex++,
            model: v
          }));
          if (m.model) { this.linkModels(parentModel,m.model); }
          array.changes[m.index] = {type:"insert", prevIndex, value:v};
        }
        modelInd++;
        prevIndex = m.index;
      }
    }

    if (modelInd<array.array.length) {
      // implicit deletion of remaining elements
      let asc1, end1;
      for (mi = modelInd, end1 = array.array.length, asc1 = modelInd <= end1; asc1 ? mi < end1 : mi > end1; asc1 ? mi++ : mi--) {
        m = array.array[mi];
        if (m.model) { this.unlinkModels(parentModel,m.model); }
        if (array.changes[m.index]==="insert") {
          delete array.changes[m.index];
        } else {
          array.changes[m.index] = {type:"delete"};
        }
      }
      array.array.splice(modelInd);
    }

    return array;
  }


  applyArrayDiff(array, diff){
    //if @_doDebugCall then return @debugCall("applyArrayDiff",["array","diff"],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    if (!$.isArray(diff)) { diff = []; }
    if (!$.isArray(array)) { array = []; }

    let modelInd = 0;
    for (let i = 0; i < diff.length; i++) {
      // the values (members of the array) may be strings/bools/null/maps/arrays/numbers...
      //  - string/bool/null : a basic value. If applying a diff, this overwrites the current value and advances down the array
      //  - zero : insert an undefined, to probably be replaced by the next value
      //          so, where this diff: [10,"new value at index 10"]  edits the current value at index 10 (if any) to become "new value at index 10"
      //          this one: [10,0,"new value at index 10"] inserts "new value at index 10" at index 10, and all existing entries from index 10 up are shifted accordingly
      //  - negative number : delete that many values (floats are rounded)
      //  - positive number : skip that many values (floats are rounded)
      //          note that if applied as a diff, any trailing values not specified (eg, apply diff [] to the tree ["b"]) are deleted
      //          this means that to insert an "a" before the "b", without removing the "a", we need a diff like ["b",1]
      //  - array : insert a value as an array (i.e. interpretted like this one)
      //  - map : insert a value as a map (like above)
      let v = diff[i];
      if ((typeof(v)==='number') && (v>=(-this.JSON_model_max_count-this.JSON_model_int_detect_tolerance)) && (v<=(this.JSON_model_max_count+this.JSON_model_int_detect_tolerance)) && (Math.abs(v-Math.round(v))<this.JSON_model_int_detect_tolerance)) {
        v = Math.round(v);
        if (v===0) {
          array.splice(modelInd,0,undefined);
        } else if (v<0) {
          const dels = Math.min(array.length-modelInd, -v);
          if (dels>0) { array.splice(modelInd,dels); }
        } else {
          modelInd += Math.min(array.length-modelInd, v);
        }
      } else {
        if ((typeof(v)==='number') && (v>=(-this.JSON_model_max_count-this.JSON_model_int_correct_tolerance)) && (v<=(this.JSON_model_max_count+this.JSON_model_int_correct_tolerance)) && (Math.abs(v-Math.round(v))<this.JSON_model_int_correct_tolerance)) {
            v = Math.round(v);
          }
        if (modelInd<array.length) {
          if ($.isPlainObject(v)) {
            v = this.applyDictDiff(array[modelInd], v);
          } else if ($.isArray(v)) {
            v = this.applyArrayDiff(array[modelInd], v);
          }

          // edit the value at this index
          array[modelInd] = v;
        } else {
          if ($.isPlainObject(v)) {
            v = this.applyDictDiff({}, v);
          } else if ($.isArray(v)) {
            v = this.applyArrayDiff([], v);
          }

          // insert a value at this index
          array.splice(modelInd,0,v);
        }
        modelInd++;
      }
    }

    if (modelInd!==array.length) { array.splice(modelInd); }
    return array;
  }



  clearModelChanges() {
    //if @_doDebugCall then return @debugCall("clearModelChanges",[],arguments) else (if @_doDebugCall = @doDebugCall then console.log.apply(this,@_debugCallArgs); window.BP())

    for (let id in this.changedModels) {
      const model = this.changedModels[id];
      for (let field in model.fieldChanges) {
        if ($.isPlainObject(model.fields[field]) && $.isPlainObject(model.fields[field].changes) && $.isArray(model.fields[field].array)) { model.fields[field].changes = {}; }
      }
      model.fieldChanges = {};
    }
    this.changedModels = {};
  }
});

