module Cprec
  class Processor
    attr_accessor :defines
    def self.process(str, type=:c, keepDefines=false)
      Cprec::Processor.new.process(str,type,keepDefines)
    end
  
    def remake_define_pattern
      ret=@define_pattern = @defines.empty? ?
        nil
        : Regexp.new("("+(@defines.map do |k,v|
          v[:args]?
            (k[0]=='@' ?
              "#{Regexp.escape(k)}\\("
              : "\\b#{Regexp.escape(k)}\\(")
            : (k[0]=='@' ?
              "#{Regexp.escape(k)}\\b"
              : "\\b#{Regexp.escape(k)}\\b")
        end.join('|'))+")[^\"']*+(?>(?:\'(?:\\\\\\\\|\\\\\\\'|[^\'])*+\'|\"(?:\\\\\\\\|\\\\\\\"|[^\"])*+\")[^\"']*+)*+$",Regexp::MULTILINE)
      #puts ret
      ret
    end

    def process(str, type=:c, keepDefines=false)
      @unique_index ||= 0
      
      case type
      when :coffee
        str.without_coffee_block_comments!
      when :c
        str.without_c_block_comments!
      end
      #puts "string: #{str}"
        
      if keepDefines
        @defines ||= {}
        @define_pattern ||= nil
      else
        @defines = {}
        @define_pattern = nil
      end

      ret=""
      loop do
        ln = str.unshift_code_line
        #puts "line: #{ln}"
        break if ln.nil?
        
        if res = ln.match(/^\s*#undef\s+(@\w*|\w+)\s*$/)
          @defines.delete res[1]
          self.remake_define_pattern
        elsif ln.match(/^\s*#define\s+(@\w*|\w+)/)
          ln.slice! -1 if ln[-1]=="\n"
          en = -1
          if ln[en]=="\\"
            ln.slice! en..-1
            loop do
              _ln = str.unshift_code_line
              break unless _ln
              #puts "define subline: #{_ln}"
              en = (_ln[-1]=="\n" ? -2 : -1)
              if _ln.length>=-en && _ln[en]=="\\"
                ln += "\n"+_ln[0..en-1] if ln.length>-en
              else
                ln += "\n"+_ln
                break
              end
            end
          end
          #puts "define line: #{ln}"
          if res = ln.match(/^\s*#define\s+(@\w*|\w+)(?:\(\s*([^\)]*)\s*\))?\s*(.*)/m)
            name, args_str, template = res.captures
            if args_str
              args = args_str.indexed_matches(/\s*+(?:(\w++)\s*+(?:$|,)|(\.\.\.)\s*+$)/,0,1).map do |m|
                if m[0]
                  m[0]
                else
                  '__VA_ARGS__'
                end
              end
            end

            @defines[name] = {
              name: name,
              args: args,
              template: template
            }

            self.remake_define_pattern
          end
        elsif @define_pattern.nil?
          ret+=ln
        else
          case type
          when :coffee
            ln.without_coffee_line_comments!
          when :c
            ln.without_c_line_comments!
          end

          while res = @define_pattern.match(ln) do
            _name = res[1]
            res_r  = res.begin(1)..res.end(1)-1
            
            
            name = (_name[-1]=='(' ? _name[0..-2] : _name)
            unless @defines.has_key? name
              binding.pry
              raise "Expected macro called #{name}\n#{ln}"
            end
            defn = @defines[name]
            template = defn[:template]
            args = defn[:args]

            if _name[-1]=='('
              if (end_paran = ln.end_of_paran_block(res_r.end+1)).nil?
                binding.pry
                raise "No end to macro #{_name} block #{ln}"
              end
              #p res_r,(end_paran>res_r.end+1 ? ln[res_r.end+1..end_paran-1] : '')
              substs = (end_paran>res_r.end+1 ? ln[res_r.end+1..end_paran-1] : '').split_code_on_commas(res_r.end+1).map{|m| m[0]}

              unless args
                binding.pry
                raise "Macro has no args block #{ln}\n#{substs}\n#{defn}"
              end

              if substs.size>=args.size-1 && args.size>0 && args[-1]=='__VA_ARGS__'
                if substs.size==args.size-1
                  substs<<""
                elsif substs.size>args.size
                  substs[args.size-1] = substs[args.size-1..-1].join(',')
                  substs.slice!(args.size..-1)
                end
              end

              #p substs
              
              if args.size > substs.size
                binding.pry
                raise "Too few substitutions in #{name} block #{ln}\n#{substs}\n#{defn}"
              end
              if args.size < substs.size
                binding.pry
                raise "Too many substitutions in #{name} block #{ln}\n#{substs}\n#{defn}"
              end
              
              s = template.dup
              ind = -1
              args.each do |arg|
                ind+=1
                esc_arg = Regexp.escape(arg)
                s.gsub!(Regexp.new('(?<!#)#'+esc_arg+'\b'),'"'+substs[ind].gsub("\\",'\\').gsub('"','\\"').gsub("\n",'\n').gsub("\r",'\r')+'"')
                s.gsub!(Regexp.new('\b'+esc_arg+'\b'),substs[ind])
              ##puts esc_arg+' > '+substs[ind]+' : '+s
              end
              #puts s

              if !s.index('__UNIQUE__').nil?
                @unique_index+=1
                temp = s.gsub('__UNIQUE__',@unique_index.to_s)
              else
                temp = s
              end

              ln = (res_r.begin>0?ln[0..res_r.begin-1]:'') + temp + ln[end_paran+1..-1]
            else
              if args
                binding.pry
                raise "Macro has an args block #{ln}\n#{substs}\n#{defn}"
              end
              
              if !template.index('__UNIQUE__').nil?
                @unique_index+=1
                temp = template.gsub('__UNIQUE__',@unique_index.to_s)
              else
                temp = template
              end
              ln = (res_r.begin>0?ln[0..res_r.begin-1]:'') + temp + ln[res_r.end+1..-1]
            end
          end
          ln.gsub!('##','')
          ret+=ln
        end
      end
      #puts "\nret:\n#{ret}\n"
      ret
    end
  end
end
