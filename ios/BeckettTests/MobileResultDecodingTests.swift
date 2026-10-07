import XCTest
@testable import Beckett

final class MobileResultDecodingTests: XCTestCase {
    func testDecodesInterpretationContract() throws {
        let data = Data(#"{"type":"interpretation","summary":"A deadline is explicit.","clearSignals":["Due Friday"],"possibleReadings":[],"uncertainties":["Priority is unclear"],"usefulQuestions":["Which item comes first?"]}"#.utf8)
        let result = try JSONDecoder().decode(MobileCoachResult.self, from: data)
        guard case let .interpretation(value) = result else {
            return XCTFail("Expected an interpretation")
        }
        XCTAssertEqual(value.clearSignals, ["Due Friday"])
    }

    func testDecodesDraftOptionsContract() throws {
        let data = Data(#"{"type":"draft_options","contextSummary":"Replying to a request","preservedIntent":["Confirm"],"options":[{"style":"direct","label":"Direct","text":"Yes.","rationale":"Confirms"}],"uncertaintyNote":null}"#.utf8)
        let result = try JSONDecoder().decode(MobileCoachResult.self, from: data)
        guard case let .draftOptions(value) = result else {
            return XCTFail("Expected draft options")
        }
        XCTAssertEqual(value.options.first?.text, "Yes.")
    }

    func testDecodesToneFeedbackContract() throws {
        let data = Data(#"{"type":"tone_feedback","likelyLanding":"Clear and firm.","strengths":["Specific"],"watchFor":[],"revision":null}"#.utf8)
        let result = try JSONDecoder().decode(MobileCoachResult.self, from: data)
        guard case let .toneFeedback(value) = result else {
            return XCTFail("Expected tone feedback")
        }
        XCTAssertEqual(value.likelyLanding, "Clear and firm.")
    }
}
