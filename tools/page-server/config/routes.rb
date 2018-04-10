Rails.application.routes.draw do

  # all parts of the app share the same html base, this gets that html
  get '*path' => 'public#page'

end
