import SwiftUI

@main
struct BeckettApp: App {
    @StateObject private var auth = AuthStore()
    @StateObject private var handoff = CoachHandoffCoordinator()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(auth)
                .environmentObject(handoff)
                .task { await auth.bootstrap() }
                .onOpenURL { handoff.receive($0) }
        }
    }
}

@MainActor
final class CoachHandoffCoordinator: ObservableObject {
    @Published private(set) var pending: MobileCoachHandoff?

    func receive(_ url: URL) {
        guard url.scheme == "beckett",
              url.host == "coach",
              url.path == "/handoff",
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
              let rawID = components.queryItems?.first(where: { $0.name == "id" })?.value,
              let id = UUID(uuidString: rawID) else { return }
        pending = MobileCoachHandoffStore.consume(id: id)
    }

    func finish(_ id: UUID) {
        if pending?.id == id { pending = nil }
    }
}
