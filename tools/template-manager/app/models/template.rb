class Template < ActiveRecord::Base
  self.table_name = "template"
  
  has_many :children, class_name: 'TemplateChild', dependent: :destroy
  has_many :subtemplates, class_name: 'Subtemplate', dependent: :destroy
  has_many :displayed_fields, class_name: 'TemplateDisplayedField', dependent: :destroy

  deletion_dependents = [:children,:subtemplates,:displayed_fields]

  def self.view_template
    templates = ApplicationHelper.templates_prop_tree[false]
    clas = self.name.demodulize
    if templates.has_key?(nil)
      templates_with_nil = templates[nil]
      if templates_with_nil.has_key?(use_clas = clas) or templates_with_nil.has_key?(use_clas = nil)
        return templates_with_nil[use_clas]
      end
    end
  end

  def self.view_id(id, template = nil)
    "#{self.name.demodulize}_#{id}#{template.present? && template['key'].present? ? "(#{template['key']})" : ''}".to_sym
  end

  def model_view_fields(variant, id, parent_id, parent, fields_from_parent, template)
    fields = super(variant, id, parent_id, parent, fields_from_parent, template)
    subtemplates.each do |subtemplate|
      if subtemplate.model_view.present?
        fields[subtemplate.dom_field] = [ApplicationHelper.model_view_id(subtemplate.model_view, subtemplate.subtemplate_key)]
      end
    end
    fields
  end

  def self.subtemplate_ids(template_hash, model)
    ret = {}
    _subtemplate_ids(template_hash, model, ret, '')
    ret
  end

  def self._subtemplate_ids(template_hash, model, add_to, prefix)
    ap "\n\n\n>>>_subtemplate_ids: "
    ap template_hash
    ap model
    return unless (subtemplates = template_hash[:subtemplates]).present?
    ap subtemplates
    is_owner = User.quiet__is_owner? model
    subtemplates.each do |subtemplate|
      unless subtemplate[:model_view].present?
        next unless (subtemplate_template = ApplicationHelper.model_view_template(model,subtemplate[:subtemplate_key],is_owner)).present? #TODO default template
        User.mark_as_using_current if subtemplate_template['owner_only']
        path = prefix+subtemplate[:dom_field]
        add_to[path] = view_id(subtemplate_template['id'])
        _subtemplate_ids(subtemplate_template,model,add_to,path+' ')
      end
    end
    return
  end


  def displayed_fields_hash
    ret = {}
    if displayed_fields.is_a?(String) and (a = JSON.parse(displayed_fields)).is_a? Array
      a.each{|field| ret[field] = true}
    end
    ret
  end
end

