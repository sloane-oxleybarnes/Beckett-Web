import Foundation

enum MobileContextMode: String, CaseIterable, Codable, Identifiable {
    case professional
    case personal

    var id: String { rawValue }
    var title: String { rawValue.capitalized }
}

enum MobileCoachAction: String, CaseIterable, Codable, Identifiable {
    case decode
    case respond
    case rewrite
    case clarify
    case toneCheck = "tone_check"

    var id: String { rawValue }

    static let visibleCases: [MobileCoachAction] = [.decode, .respond, .rewrite]

    var shortTitle: String {
        switch self {
        case .decode: "Decode"
        case .respond: "Respond"
        case .rewrite: "Rewrite"
        case .clarify: "Clarify"
        case .toneCheck: "Tone check"
        }
    }

    var title: String {
        switch self {
        case .decode: "Decode a message"
        case .respond: "Help me respond"
        case .rewrite: "Rewrite my draft"
        case .clarify: "Ask for clarity"
        case .toneCheck: "Check my tone"
        }
    }

    var systemImage: String {
        switch self {
        case .decode: "text.magnifyingglass"
        case .respond: "arrowshape.turn.up.left"
        case .rewrite: "pencil.and.outline"
        case .clarify: "questionmark.bubble"
        case .toneCheck: "waveform.badge.magnifyingglass"
        }
    }
}

struct InterpretationResult: Codable, Equatable {
    struct PossibleReading: Codable, Equatable, Identifiable {
        let label: String
        let explanation: String
        let evidence: String
        let confidence: String
        var id: String { "\(label)-\(explanation)" }

        var evidenceStrengthLabel: String {
            switch confidence.lowercased() {
            case "high": "Strong evidence"
            case "medium": "Some evidence"
            default: "Limited evidence"
            }
        }
    }

    let summary: String
    let clearSignals: [String]
    let possibleReadings: [PossibleReading]
    let uncertainties: [String]
    let usefulQuestions: [String]
}

struct DraftOptionsResult: Codable, Equatable {
    struct OriginalFeedback: Codable, Equatable {
        let tone: String
        let clarity: String
        let strengths: [String]
        let watchFor: [String]
    }

    struct Option: Codable, Equatable, Identifiable {
        let style: String
        let label: String
        let text: String
        let rationale: String
        var id: String { style }
    }

    let contextSummary: String
    let preservedIntent: [String]
    let originalFeedback: OriginalFeedback?
    let options: [Option]
    let uncertaintyNote: String?
}

struct ToneFeedbackResult: Codable, Equatable {
    struct Revision: Codable, Equatable {
        let text: String
        let changes: [String]
    }

    let likelyLanding: String
    let strengths: [String]
    let watchFor: [String]
    let revision: Revision?
}

enum MobileCoachResult: Decodable, Equatable {
    case interpretation(InterpretationResult)
    case draftOptions(DraftOptionsResult)
    case toneFeedback(ToneFeedbackResult)

    private enum CodingKeys: String, CodingKey { case type }
    private enum ResultType: String, Decodable {
        case interpretation
        case draftOptions = "draft_options"
        case toneFeedback = "tone_feedback"
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(ResultType.self, forKey: .type) {
        case .interpretation:
            self = .interpretation(try InterpretationResult(from: decoder))
        case .draftOptions:
            self = .draftOptions(try DraftOptionsResult(from: decoder))
        case .toneFeedback:
            self = .toneFeedback(try ToneFeedbackResult(from: decoder))
        }
    }
}

struct CoachResponse: Decodable {
    struct Retention: Decodable {
        let mode: String
        let contentSaved: Bool
    }

    let contractVersion: String
    let requestId: String
    let result: MobileCoachResult
    let retention: Retention
    let usage: UsageSummary?
}

struct SafetyResponse: Decodable, Equatable {
    struct Resource: Decodable, Equatable, Identifiable {
        let label: String
        let href: URL
        let kind: String
        var id: String { href.absoluteString }
    }

    let topic: String
    let title: String
    let message: String
    let resources: [Resource]
    let regionLabel: String
    let emergencyNumber: String
}

struct CoachRequest: Encodable {
    struct Settings: Encodable {
        let warmth = "warm"
        let directness = "balanced"
        let formality = "natural"
        let length = "concise"
    }

    let action: MobileCoachAction
    let text: String
    let conversationContext: String
    let person: String
    let goal: String
    let contextMode: MobileContextMode
    let settings = Settings()
    let source: String
}

struct MobileCoachHandoff: Codable, Equatable, Identifiable {
    let id: UUID
    let action: MobileCoachAction
    let text: String
    let createdAt: Date

    init(id: UUID = UUID(), action: MobileCoachAction, text: String, createdAt: Date = Date()) {
        self.id = id
        self.action = action
        self.text = text
        self.createdAt = createdAt
    }

    var deepLink: URL? {
        URL(string: "beckett://coach/handoff?id=\(id.uuidString)")
    }
}

enum MobileCoachHandoffStore {
    private static let filename = "pending-coach-handoff.json"
    private static let lifetime: TimeInterval = 15 * 60

    static func save(_ handoff: MobileCoachHandoff) throws {
        let url = try fileURL()
        let data = try JSONEncoder().encode(handoff)
        try data.write(to: url, options: [.atomic, .completeFileProtection])
    }

    static func consume(id: UUID, now: Date = Date()) -> MobileCoachHandoff? {
        guard let url = try? fileURL() else { return nil }
        defer { try? FileManager.default.removeItem(at: url) }
        guard let data = try? Data(contentsOf: url),
              let handoff = try? JSONDecoder().decode(MobileCoachHandoff.self, from: data),
              handoff.id == id,
              now.timeIntervalSince(handoff.createdAt) >= 0,
              now.timeIntervalSince(handoff.createdAt) <= lifetime else { return nil }
        return handoff
    }

    private static func fileURL() throws -> URL {
        guard let identifier = AppConfiguration.appGroupIdentifier,
              let container = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: identifier
              ) else {
            throw HandoffError.appGroupUnavailable
        }
        return container.appending(path: filename)
    }

    private enum HandoffError: Error {
        case appGroupUnavailable
    }
}
