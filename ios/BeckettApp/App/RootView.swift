import SwiftUI
import UIKit

struct RootView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var handoff: CoachHandoffCoordinator
    @State private var selectedTab = 0
    @State private var practicePrefill: PracticePrefill?
    @AppStorage("beckett.mobile.context-mode") private var contextModeRaw = MobileContextMode.personal.rawValue

    init() {
        let appearance = UITabBarAppearance()
        appearance.configureWithOpaqueBackground()
        appearance.backgroundColor = UIColor { traits in
            traits.userInterfaceStyle == .dark
                ? UIColor(red: 0.10, green: 0.09, blue: 0.08, alpha: 1)
                : UIColor(red: 0.98, green: 0.96, blue: 0.93, alpha: 1)
        }
        UITabBar.appearance().standardAppearance = appearance
        UITabBar.appearance().scrollEdgeAppearance = appearance
    }

    private var contextMode: Binding<MobileContextMode> {
        Binding(
            get: { MobileContextMode(rawValue: contextModeRaw) ?? .personal },
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
        case .offline:
            OfflineSessionView()
        case .signedIn:
            if auth.profile?.user.onboardingComplete != true {
                AccountSetupView()
            } else if auth.profile?.privacy.aiProcessing.current == true {
                TabView(selection: $selectedTab) {
                    CoachView(contextMode: contextMode) { prefill in
                        practicePrefill = prefill
                        selectedTab = 1
                    }
                        .tag(0)
                        .tabItem { Label("Message Help", systemImage: "bubble.left.and.text.bubble.right") }
                    PracticeView(contextMode: contextMode, prefill: $practicePrefill)
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
                .toolbarBackground(BeckettColor.background, for: .tabBar)
                .onAppear {
                    if handoff.pending != nil { selectedTab = 0 }
                }
                .onChange(of: handoff.pending?.id) { _, newValue in
                    if newValue != nil { selectedTab = 0 }
                }
            } else {
                ConsentView()
            }
        }
    }
}

private struct OfflineSessionView: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            BeckettBrandHeader()
                .frame(maxWidth: .infinity)
            Spacer()
            Text("You’re offline")
                .font(.system(size: 34, weight: .regular, design: .serif))
            Text(auth.errorMessage ?? "Beckett could not connect. Check your connection and try again.")
                .foregroundStyle(BeckettColor.inkMid)
            Button("Try again") {
                Task { await auth.bootstrap() }
            }
            .buttonStyle(BeckettPrimaryButtonStyle())
            Button("Sign out", role: .cancel) { auth.signOut() }
                .frame(maxWidth: .infinity)
            Spacer()
        }
        .padding(24)
        .beckettPage()
    }
}
