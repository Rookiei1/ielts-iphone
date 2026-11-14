#!/usr/bin/env ruby
# frozen_string_literal: true

require "base64"
require "openssl"
require "open3"
require "plist"

module ProfileCertificates
  module_function

  def parse_profile_plist(profile_path)
    xml, stderr, status = Open3.capture3("security", "cms", "-D", "-i", profile_path)
    raise "Failed to decode provisioning profile #{profile_path}: #{stderr}" unless status.success?

    Plist.parse_xml(xml)
  end

  def extract_certificate_fingerprints(plist_data)
    certs = Array(plist_data["DeveloperCertificates"])
    certs.map do |raw|
      der = raw.respond_to?(:read) ? raw.read : raw.to_s
      x509 = OpenSSL::X509::Certificate.new(der)
      OpenSSL::Digest::SHA1.hexdigest(x509.to_der).upcase
    end
  end

  def verify_profile!(profile_path:, expected_bundle_id:, expected_team:, identity_sha1: nil)
    plist = parse_profile_plist(profile_path)
    entitlements = plist["Entitlements"] || {}
    app_id = entitlements["application-identifier"].to_s
    team_id = entitlements["com.apple.developer.team-identifier"].to_s
    expected_app_id = "#{expected_team}.#{expected_bundle_id}"

    raise "Provisioning profile team #{team_id.inspect} != #{expected_team.inspect}" unless team_id == expected_team
    raise "Provisioning profile app-id #{app_id.inspect} != #{expected_app_id.inspect}" unless app_id == expected_app_id
    if entitlements["get-task-allow"]
      raise "Refusing debug provisioning profile with get-task-allow=true"
    end

    exp = plist["ExpirationDate"]
    raise "Provisioning profile expired at #{exp}" if exp && exp.to_time <= Time.now

    fingerprints = extract_certificate_fingerprints(plist)
    raise "Provisioning profile embeds no DeveloperCertificates" if fingerprints.empty?
    if identity_sha1 && !fingerprints.include?(identity_sha1.upcase)
      raise "Provisioning profile certificates #{fingerprints.inspect} do not include identity #{identity_sha1.upcase}"
    end

    {
      name: plist["Name"].to_s,
      uuid: plist["UUID"].to_s,
      team_id: team_id,
      app_id: app_id,
      fingerprints: fingerprints,
      expiration: exp.to_s
    }
  end
end

if $PROGRAM_NAME == __FILE__
  if ARGV.empty?
    # Self-test mode
    cert = OpenSSL::X509::Certificate.new
    key = OpenSSL::PKey::RSA.new(2048)
    cert.version = 2
    cert.serial = 1
    cert.subject = OpenSSL::X509::Name.parse("/CN=Apple Distribution: Test (NGV55K28X8)")
    cert.issuer = cert.subject
    cert.public_key = key.public_key
    cert.not_before = Time.now - 60
    cert.not_after = Time.now + 3600
    cert.sign(key, OpenSSL::Digest::SHA256.new)
    fps = ProfileCertificates.extract_certificate_fingerprints("DeveloperCertificates" => [cert.to_der])
    raise "Expected 1 fingerprint" unless fps.size == 1 && fps.first.size == 40
    puts "ProfileCertificates self-test OK"
  else
    profile_path = ARGV.fetch(0)
    bundle_id = ENV.fetch("APP_IDENTIFIER", "com.rookiei1.ieltspractice")
    team_id = ENV.fetch("EXPECTED_TEAM_ID", "NGV55K28X8")
    identity_sha1 = ENV["SIGNING_IDENTITY_SHA1"]
    info = ProfileCertificates.verify_profile!(
      profile_path: profile_path,
      expected_bundle_id: bundle_id,
      expected_team: team_id,
      identity_sha1: identity_sha1,
    )
    puts "Verified profile #{info[:name]} (#{info[:uuid]}) expires #{info[:expiration]}"
  end
end
