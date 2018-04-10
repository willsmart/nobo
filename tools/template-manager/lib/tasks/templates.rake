namespace :templates do
  desc "TODO"
  task adjust: :environment do
    @rails_session ||= ActionDispatch::Integration::Session.new(Rails.application)
    @rails_session.post("/adjust_templates")
    puts @rails_session.response.status
  end

end
