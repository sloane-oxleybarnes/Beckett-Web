import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var handoff: CoachHandoffCoordinator
    @State private var selectedTab = 0
    @AppStorage("beckett.mobile.context-mode") private var contextModeRaw = MobileContextMode.professional.rawValue

    private var contextMode: Binding<MobileContextMode> {
        Binding(
            get: { MobileContextMode(rawValue: contextModeRaw) ?? .professional },
            set: { contextModeRaw = $0.rawValue }
        )
    }

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
                    CoachView(contextMode: contextMode)
                        .tag(0)
                        .tabItem { Label("Coach", systemImage: "bubble.left.and.text.bubble.right") }
                    PracticeView(contextMode: contextMode)
                        .tag(1)
                        .tabItem { Label("Practice", systemImage: "person.2.wave.2") }
                    CoursesView(contextMode: contextMode)
                        .tag(2)
                        .tabItem { Label("Courses", systemImage: "book.closed") }
                    ProfileView()
                        .tag(3)
                        .tabItem { Label("You", systemImage: "person.crop.circle") }
                }
                .tint(BeckettColor.primary)
                .toolbar(.visible, for: .tabBar)
                .toolbarBackground(.visible, for: .tabBar)
                .toolbarBackground(BeckettColor.card, for: .tabBar)
                .onChange(of: handoff.pending?.id) { _, newValue in
                    if newValue != nil { selectedTab = 0 }
                }
            } else {
                ConsentView()
            }
        }
    }
}
