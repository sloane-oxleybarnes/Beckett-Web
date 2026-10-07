import SwiftUI

struct ProfileView: View {
    @EnvironmentObject private var auth: AuthStore

    var body: some View {
        NavigationStack {
            List {
                Section("Account") {
                    LabeledContent("Email", value: auth.profile?.user.email ?? "")
                    LabeledContent("Plan", value: auth.profile?.user.plan.capitalized ?? "Free")
                }
                Section("Privacy") {
                    LabeledContent(
                        "AI processing",
                        value: auth.profile?.privacy.aiProcessing.current == true ? "Allowed" : "Review needed"
                    )
                    LabeledContent(
                        "Message retention",
                        value: auth.profile?.privacy.retention.mode == "transient" ? "Do not save" : "Save only when asked"
                    )
                }
                Section {
                    Button("Sign out", role: .destructive) { auth.signOut() }
                }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("You")
            .beckettPage()
        }
    }
}
