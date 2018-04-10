namespace :templates do
  desc "TODO"
  task adjust: :environment do
    @rails_session ||= ActionDispatch::Integration::Session.new(Rails.application)
    @rails_session.post("/adjust_templates")
    puts @rails_session.response.body
    if @rails_session.response.status == 200
      puts "\n\nUpdated templates ok"
    else
      puts "\n\nFailed to update templates"
    end
  end

end
