#!/usr/bin/env ruby
# frozen_string_literal: true

require "open3"
require "shellwords"

module SigningIdentity
  module_function

  def list_identities(keychain_path = nil)
    cmd = ["security", "find-identity", "-v", "-p", "codesigning"]
    cmd << keychain_path if keychain_path && !keychain_path.empty?
    stdout, stderr, status = Open3.capture3(*cmd)
    raise "security find-identity failed: #{stderr}" unless status.success?

    stdout.lines.filter_map do |line|
      match = line.match(/^\s*\d+\)\s+([0-9A-F]{40})\s+"([^"]+)"/)
      next unless match

      { sha1: match[1], name: match[2] }
    end
  end

  def resolve_distribution_identity(expected_team:, keychain_path: nil)
    identities = list_identities(keychain_path)
    dist = identities.select do |entry|
      entry[:name].include?("Apple Distribution") || entry[:name].include?("iPhone Distribution")
    end
    team_matched = dist.select { |entry| entry[:name].include?("(#{expected_team})") }
    candidates = team_matched.empty? ? dist : team_matched

    if candidates.empty?
      raise "No Apple Distribution code signing identity found in keychain #{keychain_path || '(default)'}; " \
            "available: #{identities.map { |i| i[:name] }.inspect}"
    end
    if candidates.size > 1
      raise "Multiple matching Apple Distribution identities found for team #{expected_team}: " \
            "#{candidates.map { |c| c[:name] }.inspect}"
    end

    candidates.first
  end
end

if $PROGRAM_NAME == __FILE__
  team = ENV.fetch("EXPECTED_TEAM_ID", "NGV55K28X8")
  keychain = ENV["MATCH_KEYCHAIN_PATH"]
  found = SigningIdentity.resolve_distribution_identity(expected_team: team, keychain_path: keychain)
  puts "#{found[:sha1]} #{found[:name]}"
end
