class PublicController < ActionController::Base

  # each model served up from the models method of the ModelsController has a template as a child
  # They are almost always automaitically inferred by looking at the class, variant, and ownership of the model
  # This method scrapes the views/templates dir for template files (HAML) and passes them into the db,
  # the naming of each file determines what models it will be used for:
  # eg:
  #  Post              - used for posts, possibly not-owned by the user, regardless of the requested variant
  #  my Post           - used for posts that the user owns, regardless of the requested variant
  #  my Post[variant]  - used for posts that the user owns, when the 'variant' variant is requested
  # this call also assigns the template children (i.e. a post has replies) 
  #   and subtemplates (i.e. a post shows a common control filled with some of its own data)
  #   by scraping the dom tree. This could do with improvement but is nice enough for now
  # The upshot is that changing the template file on disk, then calling this method will update the templates/children/etc
  #   in the db, and for most changes will propagate the new template to clients that are viewing any changed templates/connections
  def adjust_templates
    _adjust_templates
    render nothing: true
  end


  def _adjust_templates
    Thread.current[:uses_fields] = {}
    Thread.current[:uses_models] = {}
    Thread.current[:uses_current_user] = false

    refs = {}
    ids = []
    displayed_field_ids = []

    rx = /\$\{(\w+)(?:(?:([\*\/\+\-\?]|->)|([\!=]=|&[lg]t;=?)([^|}?]*)(\?)?)([^|}]*))?(?:\|((?:[^\{\}]|\{[^\{\}]*\})*))?\}/
    Dir.glob("app/views/templates/**/*.html*").each do |full_filename|
      logger.debug "Template file: #{full_filename}"
      match=(full_filename.match /app\/views\/(.*\/)((my )?+([\w]+)?+(?:\[(\w+)\])?)\.html(\.haml)?/)
      if match then
        dir=match[1]
        filename=match[2]
        owner_only=match[3].present?
        clas=match[4]
        variant=match[5]
        is_haml=match[6].present?
        
        dom = File.open(full_filename, "rb") {|io| io.read}
        puts dom
        if is_haml
          dom = Haml::Engine.new(dom).render
        end
        logger.debug "dir:#{dir} filename:#{filename} owner_only:#{owner_only} class:#{clas} variant:#{variant}\n    dom:#{dom}\n\n"
        next unless dom.present?

        if match2 = (dom.match /^\s*<!--\s*->\s*([\w_\-\[\]\(\)]+)\s*-->\s*$/)
          refs[filename] = {
            ref_name:match2[1],
            filename:filename,
            variant:variant,
            owner_only:owner_only,
            class_filter:clas
          }
          next
        end

        fields = {}

        dom.scan(rx).each do |caps|
          fields[caps[0]] = true
        end

        fields = fields.keys

        refs[filename] = {dom:dom, fields:fields}

        if (template = Template.find_by(variant:variant, owner_only:owner_only, class_filter:clas)).nil?
          template = Template.new({filename:filename, variant:variant, owner_only:owner_only, class_filter:clas, dom:dom})
        else
          template.dom = dom
          template.filename = filename
        end

        template.save!
        ids.push template.id

        fields.each do |field|
          if (displayed_field = TemplateDisplayedField.find_by(template:template, field:field)).nil?
            displayed_field = TemplateDisplayedField.new({template:template, field:field})
            displayed_field.save!
          end

          displayed_field_ids.push displayed_field.id
        end
      end
    end

    refs.each do |filename,ref|  
      next unless ref.has_key?(:ref_name)
      ref_name = ref[:ref_name]

      stack={}
      stack[ref_name] = true
      while refs.has_key?(ref_name) && refs[ref_name].has_key?(:ref_name)
        if stack.has_key?(refs[ref_name][:ref_name])
          ref_name = nil
          break
        end
        ref_name = refs[ref_name][:ref_name]
        stack[ref_name] = true
      end

      next if ref_name.nil? || !refs.has_key?(ref_name)

      filename=ref[:filename]
      variant=ref[:variant]
      owner_only=ref[:owner_only]
      class_filter=ref[:class_filter]
      dom = refs[ref_name][:dom]
      fields = refs[ref_name][:fields]

      if (template = Template.find_by(variant:variant, owner_only:owner_only, class_filter:class_filter)).nil?
        template = Template.new({filename:filename, variant:variant, owner_only:owner_only, class_filter:class_filter, dom:dom})
      else
        template.dom = dom
        template.filename = filename
      end
      template.save!
      ids.push template.id      

      fields.each do |field|
        if (displayed_field = TemplateDisplayedField.find_by(template:template, field:field)).nil?
          displayed_field = TemplateDisplayedField.new({template:template, field:field})
          displayed_field.save!
        end

        displayed_field_ids.push displayed_field.id
      end
    end

    TemplateDisplayedField.where('id NOT IN (?)',displayed_field_ids).delete_all
    Template.where('id NOT IN (?)',ids).delete_all

    child_ids=[]
    subtemplate_ids=[]
    Template.all.each do |template|
      rx = /<(\w+(?:\s+(?!class)\w+\s*=\s*(?:'(?:\\.|[^'])*+'|"(?:\\.|[^"])*+"))*+\s+class\s*=\s*'(?:\s*+(?!(?:my-|subtemplate-uses-)?[\w_]++(?:-model-child|-subtemplate)\b)(?:\\.|[^' ])*+\s*+)*+(my-|subtemplate-uses-)?+([\w_]++)(-model-child|-subtemplate)\b(?:\\.|[^'])*+'(?:\s+\w+\s*=\s*(?:'(?:\\.|[^'])*+'|"(?:\\.|[^"])*+"))*+)>/
      key_count = {}
      subtemplate_key_count = {}
      template.dom.scan(rx).each do |caps|
        dom_field_base = caps[2].camelize(:lower)
        owner_only = caps[1].present? && caps[1]=='my-'
        virtual = caps[1].present? && caps[1]=='subtemplate-uses-'
        if caps[3]=='-subtemplate'
          if subtemplate_key_count.has_key? dom_field_base
            subtemplate_key_count[dom_field_base] += 1
            dom_field = "#{dom_field_base}-#{subtemplate_key_count[dom_field_base]}"
          else
            subtemplate_key_count[dom_field_base] = 1
            dom_field = dom_field_base
          end
          variant = if (match = caps[0].match(/\w+(?:\s+(?!variant)\w+\s*=\s*(?:'(?:\\.|[^'])*+'|"(?:\\.|[^"])*+"))*+\s+variant\s*=\s*'((?:\\.|[^'])*+)'/)).present?
            match[1]
          end
          model_view = if (match = caps[0].match(/\w+(?:\s+(?!model)\w+\s*=\s*(?:'(?:\\.|[^'])*+'|"(?:\\.|[^"])*+"))*+\s+model\s*=\s*'((?:\\.|[^'])*+)'/)).present?
            match[1]
          end
          if (child = template.subtemplates.find_by(variant:variant, dom_field:dom_field, model_view:model_view)).nil?
            child = Subtemplate.new({template:template, variant:variant, dom_field:dom_field, model_view:model_view})
            child.save!
          end

          subtemplate_ids.push child.id   
        else  
          model_field = dom_field_base.camelize(:lower)
          if key_count.has_key? dom_field_base
            key_count[dom_field_base] += 1
            dom_field = "#{dom_field_base}-#{key_count[dom_field_base]}"
          else
            key_count[dom_field_base] = 1
            dom_field = dom_field_base
          end
          variant = if (match = caps[0].match(/\w+(?:\s+(?!variant)\w+\s*=\s*(?:'(?:\\.|[^'])*+'|"(?:\\.|[^"])*+"))*+\s+variant\s*=\s*'((?:\\.|[^'])*+)'/)).present?
            match[1]
          end
          if (child = template.children.find_by(owner_only:owner_only, class_filter:nil, variant:variant, dom_field:dom_field, model_field:model_field)).nil?
            child = TemplateChild.new({template:template, owner_only:owner_only, class_filter:nil, variant:variant, dom_field:dom_field, model_field:model_field})
            child.save!
          end

          child_ids.push child.id   
        end   
      end
    end

    Subtemplate.where('id NOT IN (?)',subtemplate_ids).delete_all
    TemplateChild.where('id NOT IN (?)',child_ids).delete_all
  end

end
