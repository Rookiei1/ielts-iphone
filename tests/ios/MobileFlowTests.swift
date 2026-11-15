import XCTest

final class MobileFlowTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.rookiei1.ieltspractice")

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launch()
    }

    override func tearDownWithError() throws {
        if testRun?.hasSucceeded == false {
            screenshot("failure-screen")
            let hierarchy = XCTAttachment(string: app.debugDescription)
            hierarchy.name = "failure-accessibility-tree"
            hierarchy.lifetime = .keepAlways
            add(hierarchy)
        }
    }

    private func screenshot(_ name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    private func element(_ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    private func visible(_ control: XCUIElement, timeout: TimeInterval = 30) {
        let ready = NSPredicate { _, _ in
            control.exists && control.isHittable && !control.frame.isNull && control.frame.minY.isFinite
        }
        let expectation = XCTNSPredicateExpectation(predicate: ready, object: nil)
        XCTAssertEqual(XCTWaiter.wait(for: [expectation], timeout: timeout), .completed, "Control is not visible: \(control)")
    }

    private func tap(_ label: String) {
        let control = element(label)
        visible(control)
        control.tap()
    }

    func testMobileReadingAndPersistentRecord() throws {
        let heading = app.otherElements["阅读练习"].firstMatch
        visible(heading)
        XCTAssertLessThan(heading.frame.minY, 150, "Unexpected blank area above the app title")
        let start = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", "开始练习 Harbor Notebook")).firstMatch
        visible(start)
        XCTAssertGreaterThanOrEqual(start.frame.minX, app.frame.minX)
        XCTAssertLessThanOrEqual(start.frame.maxX, app.frame.maxX + 1)
        screenshot("01-library")
        start.tap()

        let answer1 = app.textFields["答案 1"].firstMatch
        XCTAssertTrue(answer1.waitForExistence(timeout: 25), "Practice WKWebView did not render")
        let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true AND hittable == true"), object: answer1)
        XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 20), .completed)
        answer1.tap()
        answer1.typeText("shed")
        let answer2 = app.textFields["答案 2"].firstMatch
        answer2.tap(); answer2.typeText("lantern")
        let answer3 = app.textFields["答案 3"].firstMatch
        answer3.tap(); answer3.typeText("cedar")
        tap("收起键盘")
        screenshot("02-questions")

        for label in ["第 4 题 TRUE", "第 5 题 FALSE", "第 6 题 NOT GIVEN"] {
            let choice = element(label)
            if !choice.isHittable { app.swipeUp() }
            XCTAssertTrue(choice.waitForExistence(timeout: 10), "Missing answer: \(label)")
            choice.tap()
        }
        let submit = app.buttons["提交答案"].firstMatch.exists
            ? app.buttons["提交答案"].firstMatch
            : app.buttons["Submit"].firstMatch
        XCTAssertTrue(submit.waitForExistence(timeout: 10))
        XCTAssertTrue(submit.isHittable, "Submit is covered or outside the viewport")
        submit.tap()
        let score = app.staticTexts.matching(NSPredicate(format: "label CONTAINS %@", "得分 6 / 6")).firstMatch
        XCTAssertTrue(score.waitForExistence(timeout: 25), "Grading or persistence receipt did not complete")
        screenshot("03-result")

        tap("文章")
        screenshot("04-passage")
        tap("返回题库")
        tap("记录")
        let record = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", "Harbor Notebook")).firstMatch
        XCTAssertTrue(record.waitForExistence(timeout: 20), "Saved record missing after closing practice")
        screenshot("05-records")
        app.terminate()
        app.launch()
        XCTAssertTrue(heading.waitForExistence(timeout: 30))
        tap("记录")
        XCTAssertTrue(record.waitForExistence(timeout: 20), "Saved record lost after app restart")
        tap("我的")
        XCTAssertTrue(element("导入阅读题库").waitForExistence(timeout: 10))
        screenshot("06-settings")
    }
}
