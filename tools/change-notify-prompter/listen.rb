#!/usr/bin/env ruby
require 'pg'

$conn = nil
loop do
  $conn = PG::Connection.open( host: '127.0.0.1', dbname: 'test2', user: 'postgres', password: " 8rw4rhfw84y3fubweuf27..." ) 
  #$conn = PG::Connection.open( host: 'poscaddbpg.csxu62uzhryf.ap-southeast-2.rds.amazonaws.com', dbname: 'poscaddb', user: 'poscadrails', password: "__Ru9843kns78xcsjhriuuo...?" ) 
  break unless $conn.nil?
  puts "Failed to connect to db, trying again in 5 sec"
  sleep 5
end

$conn.exec( "LISTEN modelchanges;" ) do |result|
end

loop do
	puts '.'
	$conn.wait_for_notify(10) do |name, pid, payload|
    puts "#{name}: #{payload}"
  end
end
