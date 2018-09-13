require 'json'
require 'fileutils'

$stdout.sync = true

$orig_env = 'prod'
$base_join_dir = 'joined'
$secrets_dir = "secrets"
$ignore_in_app = /^log\/$|^tmp\/$|^\.|.pid(?:.lock)?$|\bsecrets.dat$|node_modules|page-server\/public\//
$can_pushback = true

args = ARGV.dup
loop_time = nil
do_loop = nil
set_arg = nil
until (arg=args.shift).nil?
  _set_arg = nil
  if arg=='--loop' && (do_loop.nil? || do_loop)
    _set_arg = arg
    loop_time=4
    do_loop = true
  elsif arg=='--no-loop'
    do_loop = false
  elsif arg=='--joinpath' or arg=='--joinuser' or arg=='--joingroup'
  _set_arg = arg
  elsif set_arg=='--joinpath'
    $base_join_dir = arg
  elsif set_arg=='--joinuser'
    $base_join_user = arg
    $can_pushback = false
  elsif set_arg=='--joingroup'
    $base_join_group = arg
    $can_pushback = false
  elsif set_arg=='--loop' and /^\.?\d+|\d*+(\.\d+)$/.match(arg) and (f=arg.to_f)>0
    loop_time=f
  else
    set_arg = nil
    case arg
    when '--development'
      $orig_env = 'dev'
    when '--production'
      $orig_env = 'prod'
    when '--deploy'
      $orig_env = 'deploy'
    end
  end
  set_arg = _set_arg
end

def set_env(env)
  $env = env
  $base_dirs = ['nobo','app',$env,'secrets']
  $pushback_order = ['app','nobo',$env,'secrets']
  $force_recent_dirs = [$env]
end

set_env($orig_env)


def refresh_env
  envFilename = "join_env.txt"
  env = if File.exist? envFilename
    File.read(envFilename).strip
  else
    $orig_env
  end
  env = $orig_env unless ['prod', 'dev', 'deploy'].include? env
  return if $env == env
  puts "Changing to env '#{env}' after change to env pointer file '#{envFilename}'"
  set_env(env)
end

def self.safe_JSON_parse(json)
  return if json.nil?
  begin
    JSON.parse(json)
  rescue => ex
    nil
  end
end

if !$secrets_dir.nil? and File.exist?("#{$secrets_dir}.dat") and File.exist?('nobo/bin/decrypt_secrets')
  puts " >> Decypting secrets\e[2m"
  system('nobo/bin/decrypt_secrets')
  print "\e[22m"
end

$prevModTimes = {}

def mtime(file)
  return $prevModTimes[file] if $prevModTimes.has_key? file
  $prevModTimes[file] = File.new(file).mtime  
end

def touch(file, mtime, deb)
  unless deb.nil?
    #puts "(#{deb}) Touch #{file} : #{mtime}"
  end
  mtime(file)
  FileUtils.touch file, :mtime => mtime
end

def ascendingTimes(tm1,file1,tm2,file2,deb=false)
  for dir in $force_recent_dirs do
    if file1.start_with? dir
      return false
    end
    if file2.start_with? dir
      return tm2-tm1>0.0001 || tm1-tm2>0.0001
    end
  end
  tm2-tm1>0.0001
end

def is_secret_change?(file)
  !$secrets_dir.nil? and file.start_with?("#{$secrets_dir}/") and !file.end_with?('/secrets.dat')
end

def sync
  $prevModTimes = {}
  secrets_changed = false
  ret=0
  dirs = $base_dirs.select{|dir| Dir.exist?(dir)}
  mtimes = {}
  dirs.each do |dir|
    mtimes[dir] = mtime(dir)
  end

  stack=[{
    files:dirs,
    mtimes:mtimes,
    _files:dirs,
    joined:$base_join_dir,
    joined_mtime: File.exist?($base_join_dir) ? mtime($base_join_dir) : nil,
    is_pushback:($can_pushback ? nil : false),
    is_ignore:false
  }]
  until stack.empty?
    info = stack.pop
    if !info[:files].empty? and File.directory?(info[:files].last)
      dirs=info[:files].select{|file| File.directory? file}

      if Dir.exist? info[:joined]
        jdtm = info[:joined_mtime]
      else
        puts "    >> #{info[:joined]}: mkdir"
        ret+=1
        File.delete(info[:joined]) if File.exist? info[:joined]
        Dir.mkdir info[:joined]
        FileUtils.chown $base_join_user, $base_join_group, info[:joined] unless $base_join_user.nil? and $base_join_group.nil?
        touch info[:joined], info[:mtimes][info[:files].last], "A"
      end

      all_entries = {}
      pushback_entries = {}
      for dir in dirs
        for file in Dir.entries(dir).reject{|file| file[0]=='.' or file[-6,6]=='.props'}
          if all_entries.has_key? file
            all_entries[file] << dir
          else
            all_entries[file] = [dir]
          end
        end
      end

      for file in Dir.entries(info[:joined]).reject{|file| file=='.' or file=='..'}
        path = "#{info[:joined]}/#{file}"
        if !info[:is_ignore] and ($ignore_in_app !~ file)
          if file[0]=='.' or file[-6,6]=='.props'
            puts "    >> #{path}: removing a dotfile or props file. These aren't copied to the join dir."
            ret+=1
            FileUtils.rm_rf(path)
          elsif !all_entries.has_key?(file)
            jdtm = mtime(info[:joined])
            jtm = mtime(path)
            if (is_pushback = info[:is_pushback]).nil?
              for dir in dirs
                _dtm = info[:mtimes][dir]
                dtm_file = dir
                dtm = _dtm if dtm.nil? or dtm<_dtm
              end
              is_pushback = !ascendingTimes(jdtm,info[:joined], dtm,dtm_file)
            end

            if is_pushback
              pushback_dir = nil
              for base_dir in $pushback_order
                for dir in dirs
                  if dir.start_with? base_dir
                    pushback_dir = dir
                    break
                  end
                end
                break unless pushback_dir.nil?
              end
              if pushback_dir.nil?
                puts "!!! script error 1 : no pushback path could be determined for #{path}"
                next
              end
              unless File.exist? "#{pushback_dir}/nopushback"
                pushback_path = "#{pushback_dir}/#{file}"
                if File.directory? path
                  puts "    >> #{path}: pushing back newer join directory as #{pushback_path}"
                  ret+=1
                  Dir.mkdir pushback_path
                  touch pushback_dir, jdtm, "B"
                  touch pushback_path, jtm, "C"
                  all_entries[file] = [pushback_dir]
                  pushback_entries[file] = true
                  secrets_changed = true if is_secret_change? pushback_path
                else
                  puts "    >> #{path}: pushing back newer join file as #{pushback_path}"
                  ret+=1
                  FileUtils.cp path, pushback_path
                  touch pushback_dir, jdtm, "D"
                  touch pushback_path, jtm, "E"
                  secrets_changed = true if is_secret_change? pushback_path
                end
              end
            else
              puts "    >> #{path}: removing older file or directory that isn't present in the newer source"
              ret+=1
              FileUtils.rm_rf(path)
              touch info[:joined], dtm, "F"
            end
          end
        end
      end
      all_entries.each do|subdir,file_dirs|
        files = file_dirs.map{|dir| "#{dir}/#{subdir}"}
        join_path = "#{info[:joined]}/#{subdir}"
        unless jdtm.nil? or File.exist?(join_path)
          for dir in file_dirs
            file = "#{dir}/#{subdir}"
            _tm = mtime(file)
            _tm = info[:mtimes][dir] if info[:mtimes][dir]>_tm
            tm = _tm if tm.nil? or tm<_tm
          end
          if tm<jdtm and $can_pushback
            for file in files
              puts "    >> #{join_path}: pushing back newly deleted file by deleting #{file}"
              ret+=1
              FileUtils.rm_rf(file)
              touch dir, jdtm, "G"
              secrets_changed = true if is_secret_change? file
            end
            next
          end
        end

        mtimes ={}
        file_dirs.each do |dir|
          dtm = info[:mtimes][dir]
          file = "#{dir}/#{subdir}"
          tm = mtime(file)
          mtimes[file] = (ascendingTimes(dtm, dir, tm, file) ? tm : dtm)
        end

        stack.push({
          files: files,
          mtimes: mtimes,
          _files:dirs.map{|dir| "#{dir}/#{subdir}"}, 
          joined:join_path,
          joined_mtime: File.exist?(join_path) ? ((tm=mtime(join_path))>info[:joined_mtime] ? tm : info[:joined_mtime]) : nil,
          is_pushback: pushback_entries.has_key?(subdir) ? true : (jdtm.nil? ? false : info[:is_pushback]),
          is_ignore: info[:is_ignore] || !($ignore_in_app !~ "#{subdir}/")
        })
      end
    else
      next unless ($ignore_in_app !~ info[:joined])
      next if info[:_files].empty?
      props={}
      prop_is_secret = false
      ptm=nil
      ptm_file = nil
      for file in info[:_files]
        if File.exist? "#{file}.props" and (hash=safe_JSON_parse(File.read("#{file}.props"))).is_a?(Hash)
          _ptm = mtime("#{file}.props")
          if ptm.nil? or ascendingTimes(ptm, ptm_file,_ptm, "#{file}.props")
            ptm=_ptm 
            ptm_file = file
          end
          props.merge! hash
          prop_is_secret = true if is_secret_change? file
        end
      end

      tm = mtime(info[:files].last)
      tm_file = info[:files].last
      if !ptm.nil? and ascendingTimes(tm,tm_file, ptm,ptm_file)
        tm = ptm 
        tm_file=ptm_file
      end

      was_pushback = false

      if props.empty?
        FileUtils.rm_rf(info[:joined]) if Dir.exist? info[:joined]
        if File.exist? info[:joined]
          jtm = mtime(info[:joined])
          if ascendingTimes(jtm,info[:joined],tm,tm_file)
            puts "    >> #{info[:joined]}: copy modified file from #{info[:files].last}"
            ret+=1
            FileUtils.cp info[:files].last, info[:joined]
          elsif ascendingTimes(tm,tm_file,jtm,info[:joined]) and $can_pushback
            puts "    >> #{info[:joined]}: push back join file to #{info[:files].last}"
            ret+=1
            FileUtils.cp info[:joined], info[:files].last
            tm=jtm
            tm_file = info[:joined]
            touch info[:files].last, tm, "H"
            secrets_changed = true if is_secret_change? info[:files].last
            was_pushback = true
          else 
            next
          end
        else
          puts "    >> #{info[:joined]}: copy new file from #{info[:files].last}"
          ret+=1
          FileUtils.cp info[:files].last, info[:joined]
        end
      else
        body = File.read(info[:files].last)
        props.each do |key,value|
          body.gsub! key, (value.is_a?(String) ? value : value.to_json)
        end

        if File.exist? info[:joined]
          jtm = mtime(info[:joined])
          if ascendingTimes(jtm,info[:joined],tm,tm_file)
            puts "    >> #{info[:joined]}: copy modified templated file from #{info[:files].last} and associated prop file(s)"
            ret+=1
            File.open(info[:joined], 'w') {|file| file.write body}
          elsif ascendingTimes(tm,tm_file,jtm,info[:joined])
            puts "    >> #{info[:joined]}: !!!  can't push back join file to #{info[:files].last} since it has one or more prop files, and that's beyond me at the moment, please edit the data at its source"
            ret+=1
          else 
            next
          end
        else
          puts "    >> #{info[:joined]}: copy new templated file from #{info[:files].last} and associated prop file(s)"
          ret+=1
          File.open(info[:joined], 'w') {|file| file.write body}
        end
        secrets_changed = true if prop_is_secret or is_secret_change? info[:files].last
      end

      unless was_pushback
        unless $base_join_user.nil? and $base_join_group.nil?
          FileUtils.chown $base_join_user, $base_join_group, info[:joined] 
        end
        touch info[:joined], tm, "I"
      end
    end
  end


  if secrets_changed and Dir.exist?($secrets_dir) and File.exist?('nobo/bin/encrypt_secrets')
    puts " >> Re-encrypting secrets\e[2m"
    system("nobo/bin/encrypt_secrets")
    print "\e[22m"
  end

  ret
end


if !do_loop || loop_time.nil?
  puts "Joining the directory trees under #{$base_dirs.to_json} into #{$base_join_dir} ..."
  if sync==0
    puts "No changes, directories were already synced"
  end
  puts "... #{Time.now.to_s}"
  puts "(if you want the joiner script to watch for changes, use the '--loop' command line flag)"
else
  puts "Joining the directory trees under #{$base_dirs.to_json} into #{$base_join_dir}, will resync each #{loop_time} sec"
  quit = false
  paused = false
  until quit
    refresh_env
    if !paused and sync>0
      puts "... #{Time.now.to_s}\n"
    end
    $force_recent_dirs = []
    # begin
    #   system("stty raw -echo") #=> Raw mode, no echo
    #   char = STDIN.read_nonblock(1)
    #   system("stty -raw echo")
    #   unless char.nil?
    #     print "Input: #{char} >> " 
    #     case char

    #     when 'q'
    #       quit = true 
    #       puts "Quitting"
    #     when ' '
    #       if (paused = !paused)
    #         puts "Syncing is paused, press space again to unpause"
    #       else
    #         puts "Syncing is now active"
    #       end
    #     else
    #       puts "??"
    #     end
    #   end
    # rescue Exception => ex
    #   system("stty -raw echo")
    # end
    sleep loop_time unless quit
  end
end

