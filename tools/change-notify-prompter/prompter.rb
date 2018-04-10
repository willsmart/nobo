#!/usr/bin/env ruby
require 'pg'

$outstandingChanges = 0

$prompterThread = Thread.new do
  conn = nil
  loop do
    conn = PG::Connection.open( host: '127.0.0.1', dbname: 'test2', user: 'postgres', password: " 8rw4rhfw84y3fubweuf27..." ) 
    #$conn = PG::Connection.open( host: 'poscaddbpg.csxu62uzhryf.ap-southeast-2.rds.amazonaws.com', dbname: 'poscaddb', user: 'poscadrails', password: "__Ru9843kns78xcsjhriuuo...?" ) 
    break unless conn.nil?
    puts "Failed to connect to db in prompter thread, trying again in 5 sec"
    sleep 5
  end

  promptDelay = 0.5

  $outstandingChanges = false
  loop do
    puts "Waiting for outstanding changes"
    until $outstandingChanges
      sleep 0.01
    end

    gotChangeAt = Process.clock_gettime(Process::CLOCK_MONOTONIC)
    puts "Got outstanding change"

    didPrompt = false
    while $outstandingChanges
      sleep 0.01
      unless didPrompt
        tm = Process.clock_gettime(Process::CLOCK_MONOTONIC)
        if tm-gotChangeAt > promptDelay
          puts "Telling the db to notify others of the outstanding change"
          didPrompt = true
          conn.exec( "UPDATE model_change_notify_request SET model_change_id = 0 WHERE name = 'modelchanges';" ) do |result|
          end
        end
      end
    end
  end
end


$conn = nil
loop do
  $conn = PG::Connection.open( host: '127.0.0.1', dbname: 'test2', user: 'postgres', password: " 8rw4rhfw84y3fubweuf27..." ) 
  #$conn = PG::Connection.open( host: 'poscaddbpg.csxu62uzhryf.ap-southeast-2.rds.amazonaws.com', dbname: 'poscaddb', user: 'poscadrails', password: "__Ru9843kns78xcsjhriuuo...?" ) 
  break unless $conn.nil?
  puts "Failed to connect to db, trying again in 5 sec"
  sleep 5
end

$conn.exec( "LISTEN prompterscript;" ) do |result|
end

$conn.exec( "LISTEN modelchanges;" ) do |result|
end


loop do
  puts '.'
  $conn.wait_for_notify(10) do |name, pid, payload|
    if name == 'prompterscript'
      $outstandingChanges = true
    elsif name == 'modelchanges'
      $outstandingChanges = false
      puts "#{name}: #{payload}"
    end
  end
end
