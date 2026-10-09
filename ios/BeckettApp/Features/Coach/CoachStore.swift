import Foundation

@MainActor
final class CoachStore: ObservableObject {
    @Published var selectedAction: MobileCoachAction = .decode
    @Published var text = ""
    @Published var person = ""
    @Published var goal = ""
    @Published var conversationContext = ""
    @Published private(set) var response: CoachResponse?
    @Published private(set) var safetyResponse: SafetyResponse?
    @Published private(set) var usage: UsageSummary?
    @Published private(set) var isLoading = false
    @Published var followUpDraft = ""
    @Published private(set) var followUpMessages: [InboxMessage] = []
    @Published private(set) var isFollowingUp = false
    @Published var errorMessage: String?
    @Published private(set) var errorCode: String?

    private let api: APIClient

    init(api: APIClient = APIClient()) {
        self.api = api
    }

    @discardableResult
    func submit(
        accessToken: String,
        contextMode: MobileContextMode,
        action: MobileCoachAction? = nil,
        source: String = "app"
    ) async -> Bool {
        let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return false }
        let requestedAction = action ?? selectedAction
        isLoading = true
        errorMessage = nil
        errorCode = nil
        safetyResponse = nil
        defer { isLoading = false }
        do {
            response = try await api.send(
                "api/mobile/v1/coach",
                body: CoachRequest(
                    action: requestedAction,
                    text: content,
                    conversationContext: conversationContext,
                    person: person,
                    goal: goal,
                    contextMode: contextMode,
                    source: source
                ),
                accessToken: accessToken
            )
            selectedAction = requestedAction
            usage = response?.usage
            followUpDraft = ""
            followUpMessages = []
            return false
        } catch let APIError.server(status, message, code, safety, responseUsage) {
            usage = responseUsage ?? usage
            errorCode = code
            safetyResponse = safety
            if safety == nil { errorMessage = message }
            return status == 401
        } catch let error as URLError {
            errorCode = "network_unavailable"
            errorMessage = error.code == .notConnectedToInternet
                ? "You appear to be offline. Your text has not been sent."
                : "Beckett could not connect. Check your connection and try again."
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func startOver() {
        response = nil
        safetyResponse = nil
        errorMessage = nil
        errorCode = nil
        followUpDraft = ""
        followUpMessages = []
    }

    func apply(_ handoff: MobileCoachHandoff) {
        selectedAction = handoff.action
        text = handoff.text
        response = nil
        safetyResponse = nil
        errorMessage = nil
        errorCode = nil
        followUpDraft = ""
        followUpMessages = []
    }

    @discardableResult
    func sendFollowUp(accessToken: String, contextMode: MobileContextMode) async -> Bool {
        guard let response else { return false }
        let message = followUpDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !message.isEmpty else { return false }
        isFollowingUp = true
        errorMessage = nil
        errorCode = nil
        safetyResponse = nil
        defer { isFollowingUp = false }

        do {
            let envelope: InboxResponse = try await api.send(
                "api/mobile/v1/inbox",
                body: InboxRequest(
                    contextMode: contextMode,
                    action: selectedAction,
                    originalMessage: text,
                    initialCoaching: response.result.conversationSummary,
                    person: person,
                    goal: goal,
                    conversationContext: conversationContext,
                    messages: followUpMessages.map { .init(role: $0.role.rawValue, content: $0.content) },
                    message: message
                ),
                accessToken: accessToken
            )
            followUpMessages.append(InboxMessage(role: .user, content: message))
            followUpMessages.append(InboxMessage(role: .assistant, content: envelope.reply))
            followUpDraft = ""
            usage = envelope.usage ?? usage
            return false
        } catch let APIError.server(status, serverMessage, code, safety, responseUsage) {
            usage = responseUsage ?? usage
            errorCode = code
            safetyResponse = safety
            if safety == nil { errorMessage = serverMessage }
            return status == 401
        } catch let error as URLError {
            errorCode = "network_unavailable"
            errorMessage = error.code == .notConnectedToInternet
                ? "You appear to be offline. Your follow-up was not sent."
                : "Beckett could not connect. Check your connection and try again."
            return false
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}

struct InboxMessage: Identifiable, Equatable {
    enum Role: String { case user, assistant }

    let id = UUID()
    let role: Role
    let content: String
}

private struct InboxRequest: Encodable {
    struct Turn: Encodable {
        let role: String
        let content: String
    }

    let contextMode: MobileContextMode
    let action: MobileCoachAction
    let originalMessage: String
    let initialCoaching: String
    let person: String
    let goal: String
    let conversationContext: String
    let messages: [Turn]
    let message: String
}

private struct InboxResponse: Decodable {
    let requestId: String
    let reply: String
    let retention: CoachResponse.Retention
    let usage: UsageSummary?
}

private extension MobileCoachResult {
    var conversationSummary: String {
        switch self {
        case let .interpretation(value):
            return ([value.summary] + value.possibleReadings.map { "\($0.label): \($0.explanation)" })
                .joined(separator: "\n")
        case let .draftOptions(value):
            let feedback = value.originalFeedback.map { "Tone: \($0.tone)\nClarity: \($0.clarity)" }
            return ([feedback, Optional(value.contextSummary)].compactMap { $0 } + value.options.map { "\($0.label): \($0.text)" })
                .joined(separator: "\n")
        case let .toneFeedback(value):
            return ([value.likelyLanding] + value.watchFor + [value.revision?.text].compactMap { $0 })
                .joined(separator: "\n")
        }
    }
}
