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
                        value: "Do not save"
                    )
                    NavigationLink("Review privacy choices") {
                        PrivacySettingsView()
                    }
                }
                Section {
                    Button("Sign out", role: .destructive) { auth.signOut() }
                }
            }
            .scrollContentBackground(.hidden)
            .navigationTitle("You")
            .toolbar(.visible, for: .tabBar)
            .beckettPage()
        }
    }
}

private struct PrivacySettingsView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var aiProcessingAllowed = true

    var body: some View {
        Form {
            Section("AI processing") {
                Toggle("Allow AI processing", isOn: $aiProcessingAllowed)
                    .tint(BeckettColor.primary)
                Text("When enabled, only content you submit is sent to Beckett and its approved AI processor. It is not used for advertising or model training.")
                    .font(.footnote)
                    .foregroundStyle(BeckettColor.inkMid)
            }

            Section("Content retention") {
                Label("Messages and results are not saved", systemImage: "lock.shield")
                Text("Coaching content is processed for the current request and is not added to your Beckett history.")
                    .font(.footnote)
                    .foregroundStyle(BeckettColor.inkMid)
            }

            Section {
                Button(aiProcessingAllowed ? "Save privacy choices" : "Revoke consent") {
                    Task {
                        await auth.updatePrivacy(
                            aiProcessingAllowed: aiProcessingAllowed,
                            retentionMode: "transient"
                        )
                    }
                }
                .disabled(auth.isWorking)
            } footer: {
                if !aiProcessingAllowed {
                    Text("Revoking consent disables coaching until you consent again. Your account remains available.")
                }
            }

            if let message = auth.errorMessage {
                Section { Text(message).foregroundStyle(.red) }
            }
        }
        .navigationTitle("Privacy")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            aiProcessingAllowed = auth.profile?.privacy.aiProcessing.allowed == true
        }
    }
}
