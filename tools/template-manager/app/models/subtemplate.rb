class Subtemplate < ActiveRecord::Base
  self.table_name = "subtemplate"

  belongs_to :template, inverse_of: :subtemplates

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
end

