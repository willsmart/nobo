# Be sure to restart your server when you modify this file.

if Rails.env.production?
  Rails.application.config.session_store :cookie_store, key: '_PoscadRails_session'
else
  Rails.application.config.session_store :cookie_store, key: '_LocalPoscadRails_session'
end
