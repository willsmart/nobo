class String
  def indexed_matches(re, index_offset=0, capture_group=0)
    self.enum_for(:scan, re).map do |match|
      if Regexp.last_match[capture_group]
        [Regexp.last_match[capture_group],
          Regexp.last_match.begin(capture_group)+index_offset..Regexp.last_match.end(capture_group)-1+index_offset,
          Regexp.last_match.begin(0)+index_offset..Regexp.last_match.end(0)-1+index_offset
        ]
      else
        [
          nil,
          nil,
          Regexp.last_match.begin(0)+index_offset..Regexp.last_match.end(0)-1+index_offset
        ]
      end
    end
  end
  
  def match_ranges(re, index_offset=0, capture_group=0)
    self.enum_for(:scan, re).map do |match|
      if Regexp.last_match[capture_group]
        Regexp.last_match.begin(capture_group)+index_offset..Regexp.last_match.end(capture_group)-1+index_offset
      else
        nil
      end
    end
  end
  
  def paran_count
    ret = 0
    self.matches_for_non_strings.each do |m|
      ret+=m[0].count('(')-m[0].count(')')
    end
    ret
  end
  
  def matches_for_strings(index_offset=0)
    self.indexed_matches(/(?:\'(?:\\\\|\\\'|[^\'])*+\'|\"(?:\\\\|\\\"|[^\"])*+\")/m, index_offset)
  end
  
  def matches_for_paran_chars(index_offset=0)
    ret = []
    #p "matches_for_paran_chars #{self}",self.matches_for_strings
    self.matches_for_non_strings.each do |m|
      ret+=m[0].indexed_matches(/[()]/, m[1].begin+index_offset)
    end
    #p ret
    ret
  end
  
  def matches_for_non_strings(index_offset=0)
    ret = []
    st = 0
    #p "matches_for_non_strings #{self}",self.matches_for_strings
    self.matches_for_strings.each do |m|
      en = m[1].begin
      if en>st
        ret<<=[self[st..en-1], st+index_offset..en-1+index_offset]
      end
      st = m[1].end+1
    end
    en = self.length
    if en>st
      ret<<=[self[st..en-1], st+index_offset..en-1+index_offset]
    end
    #p ret
    ret
  end
  
  def matches_for_paran_blocks(index_offset=0)
    d = 0
    ret = []
    st = 0
    #p "paran_blocks #{self}", self.matches_for_paran_chars
    self.matches_for_paran_chars.each do |m|
      if m[0]=='('
        st = m[1].begin if d==0
        d+=1
      elsif m[0]==')'
        d-=1
        if d==0
          en = m[1].end
          ret<<[self[st..en],st+index_offset..en+index_offset]
        end
      end
    end
    #p ret
    ret
  end
  
  def end_of_paran_block(start_index=0, index_offset=0)
    d = 1
    str = (start_index==0 ? self : self[start_index..-1])
    index_offset+=start_index
    
    str.matches_for_non_strings.each do |m|
      m[0].indexed_matches(/[()]/, m[1].begin).each do |m2|
        if m2[0]=='('
          d+=1
        elsif m2[0]==')'
          d-=1
          if d==0
            return m2[1].begin + index_offset
          end
        end
      end
    end
    nil
  end
  
  def split_code_on_commas(index_offset=0)
    ret = []
    after_comma = 0
    st = 0
    
    #p "splitting #{self}", self.matches_for_paran_blocks
    self.matches_for_paran_blocks.each do |m|
      en = m[1].begin
      if en>st
        self[st..en-1].matches_for_non_strings(st).each do |m2|
          m2[0].match_ranges(/,/, m2[1].begin).each do |r|
            if r.begin>after_comma
              ret<<[self[after_comma..r.begin-1],[after_comma+index_offset..r.begin-1+index_offset]]
            else
              ret<<['',[after_comma+index_offset..r.begin-1+index_offset]]
            end
            after_comma = r.end+1
          end
        end
      end
      st = m[1].end+1
    end
    en = self.length
    if en>st
      self[st..en-1].matches_for_non_strings(st).each do |m2|
        m2[0].match_ranges(/,/, m2[1].begin).each do |r|
          if r.begin>after_comma
            ret<<[self[after_comma..r.begin-1],[after_comma+index_offset..r.begin-1+index_offset]]
          else
            ret<<['',[after_comma+index_offset..r.begin-1+index_offset]]
          end
          after_comma = r.end+1
        end
      end
    end
    if self.length>after_comma
      ret<<[self[after_comma..self.length-1],[after_comma+index_offset..self.length-1+index_offset]]
    else
      ret<<['',[after_comma+index_offset..self.length-1+index_offset]]
    end

    #p ret
    ret
  end
  
  def without_c_line_comments!
    len = self.length
    was = self
    loop do
      self.gsub!(/(^(?:(?!\/\/|\'|\").)*+((?:\'(?:\\\\|\\\'|[^\'])*+\'|\"(?:\\\\|\\\"|[^\"])*+\")(?:(?!\/\/|\'|\").)*+)*+)\/\/[^\n]*+/m,'\1')
      if len==self.length
        break
      else
        #puts "was : #{was}"
        #puts "is : #{self}"
      end
      len = self.length
    end
    self
  end
  
  def without_c_block_comments!
    #self.gsub!(/\/\*(?:(?!\*\/).)*+\*\//m,'')
    self
  end
  
  def without_coffee_block_comments
    #self.gsub(/###(?:(?!###).)*+###/m,'')TODO
    self
  end
  def without_coffee_line_comments
    self.matches_for_non_strings.each do |m|
      if ind = m[0].index(/#(?!define\b|undef\b).*/)
        ind+=m[1].begin
        return (ind>0 ? self[0..ind-1] : '')
      end
    end
    self
  end
  
  def without_coffee_block_comments!
    #self.gsub!(/###(?:(?!###).)*+###/m,'')TODO
    self
  end
  def without_coffee_line_comments!
    self.matches_for_non_strings.each do |m|
      if ind = m[0].index(/#(?!define\b|undef\b).*/)
        ind+=m[1].begin
        self.slice!(ind..-1)
        break
      end
    end
    self
  end
  
  def unshift_code_line
    return nil if self.empty?
    
    subline_start = 0
    line_end = self.index("\n")
    return self.slice!(0..self.length-1) unless line_end

    if line_end && line_end==0
      return self.slice!(0)
    end
    paran_count = 0
    loop do
      paran_count += self[subline_start..line_end].paran_count
      break unless paran_count>0
      subline_start = line_end+1
      line_end = self.index("\n", subline_start)
      return self.slice!(0..self.length-1) unless line_end
    end
    self.slice!(0..line_end)
  end
end
