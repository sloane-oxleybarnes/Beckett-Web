import SwiftUI

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore

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
                TabView {
                    CoachView()
                        .tabItem { Label("Coach", systemImage: "bubble.left.and.text.bubble.right") }
                    ProfileView()
                        .tabItem { Label("You", systemImage: "person.crop.circle") }
                }
                .tint(BeckettColor.primary)
            } else {
                ConsentView()
            }
        }
    }
}
