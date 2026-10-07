import SwiftUI

struct ConsentView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var aiProcessingAllowed = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text("You choose what Beckett sees")
                    .font(.system(size: 34, weight: .regular, design: .serif))

                Text("Before your first coaching request, review how selected content is processed and saved.")
                    .font(.title3)
                    .foregroundStyle(BeckettColor.inkMid)

                BeckettCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("AI processing", systemImage: "sparkles")
                            .font(.headline)
                        Text("When you ask for coaching, the text or screenshot content you select is sent securely to Beckett and its approved AI processor to create that response.")
                        Text("It is not used for advertising or model training.")
                            .font(.subheadline.bold())
                        Toggle("I agree to this processing", isOn: $aiProcessingAllowed)
                            .tint(BeckettColor.primary)
                    }
                }

                BeckettCard {
                    VStack(alignment: .leading, spacing: 12) {
                        Label("Content retention", systemImage: "lock.shield")
                            .font(.headline)
                        Label("Do not save message content", systemImage: "checkmark.circle.fill")
                            .foregroundStyle(BeckettColor.primaryDark)
                        Text("Beckett processes each request and does not add its message content or result to your history.")
                            .font(.footnote)
                            .foregroundStyle(BeckettColor.inkMid)
                    }
                }

                Button("Save and continue") {
                    Task {
                        await auth.updatePrivacy(
                            aiProcessingAllowed: aiProcessingAllowed,
                            retentionMode: "transient"
                        )
                    }
                }
                .buttonStyle(BeckettPrimaryButtonStyle())
                .disabled(!aiProcessingAllowed || auth.isWorking)

                if let message = auth.errorMessage {
                    Text(message).font(.footnote).foregroundStyle(.red)
                }

                Button("Sign out", role: .cancel) { auth.signOut() }
                    .frame(maxWidth: .infinity)
            }
            .padding(24)
        }
        .beckettPage()
        .interactiveDismissDisabled(auth.isWorking)
    }
}
