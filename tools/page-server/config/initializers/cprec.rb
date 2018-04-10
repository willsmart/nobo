require Rails.root.join('config','initializers','misc')
require Rails.root.join('lib','cprec','cprec')

module Cprec
  class Template < ::Tilt::Template
    def prepare
      @@cprec = Cprec::Processor.new
    end
 
    def evaluate(scope, locals, &block)
      @@cprec.process data
    end
  end
end

Rails.application.config.assets.configure do |env|
  env.register_engine '.cprec', Cprec::Template
end

