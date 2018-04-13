Rails.application.routes.draw do

  # a key part of the app is translation from models to DOM. To this end, each model is automatically given a template (though templates are just models like everyone else)
  #  The templates are stored in the db, this call syncs the haml template views (app/vies/templates) into the db tables in a smart way. 
  #  As a bonus, all pages viewing any templates that changed will be notified and updated as for any other model
  get '/adjust_templates' => 'public#adjust_templates'

end
