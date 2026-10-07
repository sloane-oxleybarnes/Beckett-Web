import Foundation

enum MobileCoachAction: String, CaseIterable, Codable, Identifiable {
    case decode
    case respond
    case rewrite
    case clarify
    case toneCheck = "tone_check"

    var id: String { rawValue }

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
    }

    let summary: String
    let clearSignals: [String]
    let possibleReadings: [PossibleReading]
    let uncertainties: [String]
    let usefulQuestions: [String]
}

struct DraftOptionsResult: Codable, Equatable {
    struct Option: Codable, Equatable, Identifiable {
        let style: String
        let label: String
        let text: String
        let rationale: String
        var id: String { style }
    }

    let contextSummary: String
    let preservedIntent: [String]
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
    let settings = Settings()
    let source: String
}
