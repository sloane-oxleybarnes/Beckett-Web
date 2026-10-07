import SwiftUI

struct AccountSetupView: View {
    @EnvironmentObject private var auth: AuthStore
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Spacer()
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 44))
                .foregroundStyle(BeckettColor.primary)
            Text("Finish setting up your coach")
                .font(.system(size: 34, weight: .regular, design: .serif))
            Text("Beckett needs your current account agreements and coaching preferences before the mobile app can process workplace messages.")
                .font(.title3)
                .foregroundStyle(BeckettColor.inkMid)
            Button("Continue setup on meetbeckett.co") {
                openURL(URL(string: "https://meetbeckett.co/auth/signin?next=/auth/profile-setup")!)
            }
            .buttonStyle(BeckettPrimaryButtonStyle())
            Button("I finished setup — check again") {
                Task { await auth.refreshProfile() }
            }
            .frame(maxWidth: .infinity)
            .disabled(auth.isWorking)
            if let message = auth.errorMessage {
                Text(message).font(.footnote).foregroundStyle(.red)
            }
            Spacer()
            Button("Sign out", role: .cancel) { auth.signOut() }
                .frame(maxWidth: .infinity)
        }
        .padding(24)
        .beckettPage()
    }
}
