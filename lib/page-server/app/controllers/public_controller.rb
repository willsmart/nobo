class PublicController < ActionController::Base
  #protect_from_forgery except: [:templates,:models]

  layout 'base'

  # there is only one page, here it is
  def page
  end
end
