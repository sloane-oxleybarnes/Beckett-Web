import Foundation

@MainActor
final class CoachStore: ObservableObject {
    @Published var selectedAction: MobileCoachAction = .decode
    @Published var text = ""
    @Published var person = ""
    @Published var goal = ""
    @Published private(set) var response: CoachResponse?
    @Published private(set) var isLoading = false
    @Published var errorMessage: String?

    private let api: APIClient

    init(api: APIClient = APIClient()) {
        self.api = api
    }

    func submit(accessToken: String, source: String = "app") async {
        let content = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            response = try await api.send(
                "api/mobile/v1/coach",
                body: CoachRequest(
                    action: selectedAction,
                    text: content,
                    conversationContext: "",
                    person: person,
                    goal: goal,
                    source: source
                ),
                accessToken: accessToken
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startOver() {
        response = nil
        errorMessage = nil
    }
}
