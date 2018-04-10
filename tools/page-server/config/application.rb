require File.expand_path('../boot', __FILE__)

require "action_controller/railtie"
require "action_mailer/railtie"
require "action_view/railtie"
require "active_job/railtie" # Only for Rails >= 4.2
#require "action_cable/engine" # Only for Rails >= 5.0
#require "active_storage/engine" # Only for Rails >= 5.2
require "sprockets/railtie"
require "rails/test_unit/railtie"

# Require the gems listed in Gemfile, including any gems
# you've limited to :test, :development, or :production.
Bundler.require(*Rails.groups)


module PoscadRails
  class Application < Rails::Application

    config.middleware.use Rack::ContentLength
    
    config.eager_load_paths << Rails.root.join("app","lib")

    # a directory for files specifying how models are seen by the outside world
    config.eager_load_paths << Rails.root.join("app","modelviews")
    # a directory for files describing models that simply describe ui elements
    config.eager_load_paths << Rails.root.join("app","utilitymodelviews")

    # Settings in config/environments/* take precedence over those specified here.
    # Application configuration should go into files in config/initializers
    # -- all .rb files in that directory are automatically loaded.

    # Set Time.zone default to the specified zone and make Active Record auto-convert to this zone.
    # Run "rake -D time" for a list of tasks for finding time zone names. Default is UTC.
    # config.time_zone = 'Central Time (US & Canada)'

    # The default locale is :en and all translations from config/locales/*.rb,yml are auto loaded.
    # config.i18n.load_path += Dir[Rails.root.join('my', 'locales', '*.{rb,yml}').to_s]
    # config.i18n.default_locale = :de

    config.assets.precompile += ['cparserWorker.js']

    config.after_initialize do #TODO hackhack
        ActionController::Base.cache_store = :mem_cache_store, "localhost"

        Rails.application.routes.default_url_options = {
          :host => '127.0.0.1',
          :port => 3000
        }
    end
  end
end
