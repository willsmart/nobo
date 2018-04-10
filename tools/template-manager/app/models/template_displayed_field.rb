class TemplateDisplayedField < ActiveRecord::Base
  self.table_name = "template_displayed_field"
  
  belongs_to :template, inverse_of: :displayed_fields

end

