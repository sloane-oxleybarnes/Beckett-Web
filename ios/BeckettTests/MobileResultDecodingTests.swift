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

    func testDecodesCoachResponseWithCredits() throws {
        let data = Data(#"{"contractVersion":"2026-10-07","requestId":"request-1","result":{"type":"draft_options","contextSummary":"Replying","preservedIntent":[],"options":[],"uncertaintyNote":null},"retention":{"mode":"transient","contentSaved":false},"usage":{"limit":30,"used":4,"remaining":26,"unlimited":false}}"#.utf8)
        let response = try JSONDecoder().decode(CoachResponse.self, from: data)
        XCTAssertEqual(response.usage?.remaining, 26)
        XCTAssertFalse(response.retention.contentSaved)
    }

    func testDecodesSafetyRedirect() throws {
        let data = Data(#"{"topic":"crisis","title":"Immediate support matters here","message":"Contact immediate support.","resources":[{"label":"Support","href":"https://example.com/support","kind":"crisis"}],"regionLabel":"United States","emergencyNumber":"911"}"#.utf8)
        let safety = try JSONDecoder().decode(SafetyResponse.self, from: data)
        XCTAssertEqual(safety.resources.first?.label, "Support")
        XCTAssertEqual(safety.emergencyNumber, "911")
    }

    func testCoachHandoffDeepLinkContainsOnlyOpaqueIdentifier() throws {
        let id = UUID(uuidString: "00000000-0000-0000-0000-000000000123")!
        let handoff = MobileCoachHandoff(
            id: id,
            action: .respond,
            text: "Sensitive shared message",
            createdAt: Date(timeIntervalSince1970: 1_000)
        )
        let url = try XCTUnwrap(handoff.deepLink)
        XCTAssertEqual(url.absoluteString, "beckett://coach/handoff?id=00000000-0000-0000-0000-000000000123")
        XCTAssertFalse(url.absoluteString.contains("Sensitive"))

        let decoded = try JSONDecoder().decode(
            MobileCoachHandoff.self,
            from: JSONEncoder().encode(handoff)
        )
        XCTAssertEqual(decoded, handoff)
    }
}
