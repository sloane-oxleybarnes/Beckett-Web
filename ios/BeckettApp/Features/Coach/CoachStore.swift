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
    }

    func apply(_ handoff: MobileCoachHandoff) {
        selectedAction = handoff.action
        text = handoff.text
        response = nil
        safetyResponse = nil
        errorMessage = nil
        errorCode = nil
    }
}
