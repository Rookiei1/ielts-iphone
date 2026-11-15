require "xcodeproj"

root = File.expand_path("..", __dir__)
project_path = File.join(root, "ios", "App", "App.xcodeproj")
project = Xcodeproj::Project.open(project_path)
app = project.targets.find { |target| target.name == "App" }
raise "App target missing" unless app
tests = project.targets.find { |target| target.name == "AppMobileUITests" }
unless tests
  tests = project.new_target(:ui_test_bundle, "AppMobileUITests", :ios, "15.0")
  tests.add_dependency(app)
  tests.build_configurations.each do |configuration|
    configuration.build_settings.merge!(
      "PRODUCT_BUNDLE_IDENTIFIER" => "com.rookiei1.ieltspractice.uitests",
      "GENERATE_INFOPLIST_FILE" => "YES",
      "SWIFT_VERSION" => "5.0",
      "TEST_TARGET_NAME" => "App",
      "CODE_SIGNING_ALLOWED" => "NO",
      "ENABLE_TESTING_SEARCH_PATHS" => "YES",
      "TARGETED_DEVICE_FAMILY" => "1"
    )
  end
  reference = project.main_group.new_file(File.join(root, "tests", "ios", "MobileFlowTests.swift"))
  tests.add_file_references([reference])
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(tests)
scheme.set_launch_target(app)
scheme.add_test_target(tests)
scheme.save_as(project_path, "AppMobileUITests", true)
puts "Prepared AppMobileUITests for actual iOS WKWebView validation."
