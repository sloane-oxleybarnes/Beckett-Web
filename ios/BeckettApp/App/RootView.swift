import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var handoff: CoachHandoffCoordinator
    @State private var selectedTab = 0

    var body: some View {
        switch auth.state {
        case .loading:
            ProgressView("Opening Beckett…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .beckettPage()
        case .signedOut, .codeSent:
            SignInView()
        case .signedIn:
            if auth.profile?.user.onboardingComplete != true {
                AccountSetupView()
            } else if auth.profile?.privacy.aiProcessing.current == true {
                TabView(selection: $selectedTab) {
                    CoachView()
                        .tag(0)
                        .tabItem { Label("Coach", systemImage: "bubble.left.and.text.bubble.right") }
                    ProfileView()
                        .tag(1)
                        .tabItem { Label("You", systemImage: "person.crop.circle") }
                }
                .tint(BeckettColor.primary)
                .onChange(of: handoff.pending?.id) { _, newValue in
                    if newValue != nil { selectedTab = 0 }
                }
            } else {
                ConsentView()
            }
        }
    }
}
