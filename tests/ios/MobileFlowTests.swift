import XCTest

final class MobileFlowTests: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.rookiei1.ieltspractice")
    var realDatabasePhase = false
    override func setUpWithError() throws { continueAfterFailure = false; app.launch() }
    private func element(_ label: String) -> XCUIElement { app.descendants(matching: .any).matching(NSPredicate(format: "label == %@",label)).firstMatch }
    private func tap(_ label: String) { let item=element(label); XCTAssertTrue(item.waitForExistence(timeout:30)); item.tap() }
    private func screenshot(_ name: String) { let shot=XCTAttachment(screenshot:app.screenshot());shot.name=name;shot.lifetime = .keepAlways;add(shot) }
    private func fill(_ number: Int, _ answer: String) {
        let field=app.textFields["答案 \(number)"].firstMatch
        XCTAssertTrue(field.waitForExistence(timeout:20))
        for _ in 0..<4 {
            let bottom=app.buttons["提交答案"].frame.minY-16
            let top=element("题目").frame.maxY+12
            if field.frame.maxY <= bottom && field.frame.minY >= top {break}
            let origin=app.coordinate(withNormalizedOffset:.zero)
            let low=origin.withOffset(CGVector(dx:app.frame.midX,dy:bottom-12))
            let high=origin.withOffset(CGVector(dx:app.frame.midX,dy:max(top+20,bottom-220)))
            if field.frame.maxY > bottom {low.press(forDuration:0.05,thenDragTo:high)}
            else {high.press(forDuration:0.05,thenDragTo:low)}
        }
        field.tap();field.typeText(answer)
        XCTAssertEqual(field.value as? String,answer,"Typed answer did not reach the visible field")
    }
    override func tearDownWithError() throws {
        if (testRun?.failureCount ?? 0) > 0 { screenshot("failure");let tree=XCTAttachment(string:app.debugDescription);tree.name="failure-tree";tree.lifetime = .keepAlways;add(tree) }
    }
    private func harbor() {
        let search=app.searchFields["搜索题目"].firstMatch
        XCTAssertTrue(search.waitForExistence(timeout:30));search.tap();search.typeText("Harbor\n")
        let start=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","开始练习 Harbor")).firstMatch
        XCTAssertTrue(start.waitForExistence(timeout:20));start.tap()
    }
    func testActualReadingOpenAndCompletePractice() throws {
        let first=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","开始练习 ")).firstMatch
        XCTAssertTrue(first.waitForExistence(timeout:30))
        XCTAssertGreaterThanOrEqual(first.frame.minX,0);XCTAssertLessThanOrEqual(first.frame.maxX,app.frame.maxX+1)
        realDatabasePhase=true;first.tap()
        XCTAssertTrue(element("文章").waitForExistence(timeout:20));tap("文章");screenshot("00-real-passage");tap("题目");screenshot("00-real-questions")
        XCTAssertTrue(app.buttons["提交答案"].waitForExistence(timeout:15));tap("提交答案")
        XCTAssertTrue(app.staticTexts.matching(NSPredicate(format:"label BEGINSWITH %@","得分 ")).firstMatch.waitForExistence(timeout:15))
        tap("返回题库");realDatabasePhase=false
        harbor()
        let one=app.textFields["答案 1"].firstMatch
        XCTAssertTrue(one.waitForExistence(timeout:20),"Question did not open")
        fill(1,"shed");fill(2,"lantern");fill(3,"cedar")
        let three=app.textFields["答案 3"].firstMatch
        tap("收起键盘")
        let hidden=XCTNSPredicateExpectation(predicate:NSPredicate(format:"exists == false"),object:app.keyboards.firstMatch)
        XCTAssertEqual(XCTWaiter.wait(for:[hidden],timeout:10),.completed,"Done did not dismiss the keyboard")
        XCTAssertEqual(three.value as? String,"cedar","The keyboard changed the typed answer")
        screenshot("01-questions")
        for label in ["第 4 题 TRUE","第 5 题 FALSE","第 6 题 NOT GIVEN"] {
            let choice=element(label)
            if !choice.isHittable {app.swipeUp(velocity:.slow)}
            choice.tap()
            let selected=XCTNSPredicateExpectation(predicate:NSPredicate(format:"value == '1'"),object:choice)
            if XCTWaiter.wait(for:[selected],timeout:2) != .completed {choice.tap()}
            XCTAssertEqual(choice.value as? String,"1","Answer choice did not select")
        }
        for label in ["第 4 题 TRUE","第 5 题 FALSE","第 6 题 NOT GIVEN"] {XCTAssertEqual(element(label).value as? String,"1","A prior answer choice was lost")}
        tap("提交答案")
        XCTAssertTrue(app.staticTexts["得分 6 / 6"].waitForExistence(timeout:20),"Grading did not complete")
        screenshot("02-result");tap("文章");screenshot("03-passage");tap("返回题库")
        app.terminate();app.launch();harbor()
        XCTAssertTrue(app.staticTexts["得分 6 / 6"].waitForExistence(timeout:20),"Answers lost after restart")
        tap("重新做这篇");let draft=app.textFields["答案 1"].firstMatch;draft.tap();draft.typeText("draft-marker");tap("返回题库")
        let start=app.buttons.matching(NSPredicate(format:"label BEGINSWITH %@","开始练习 Harbor")).firstMatch;XCTAssertTrue(start.waitForExistence(timeout:15));start.tap()
        XCTAssertEqual(app.textFields["答案 1"].firstMatch.value as? String,"draft-marker","Immediate return lost the answer")
        screenshot("04-draft-restored")
    }
}
