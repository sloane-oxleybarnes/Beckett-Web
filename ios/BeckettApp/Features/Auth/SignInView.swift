import AuthenticationServices
import SwiftUI

struct SignInView: View {
    @EnvironmentObject private var auth: AuthStore
    @State private var email = ""
    @State private var code = ""

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Beckett")
                        .font(.system(size: 42, weight: .regular, design: .serif))
                    Text("A private communication coach for the moments that are hard to read or hard to answer.")
                        .font(.title3)
                        .foregroundStyle(BeckettColor.inkMid)
                }

                BeckettCard {
                    VStack(alignment: .leading, spacing: 16) {
                        switch auth.state {
                        case let .codeSent(sentEmail):
                            Text("Check your email")
                                .font(.title2.bold())
                            Text("Enter the code sent to \(sentEmail).")
                                .foregroundStyle(BeckettColor.inkMid)
                            TextField("Verification code", text: $code)
                                .textContentType(.oneTimeCode)
                                .keyboardType(.numberPad)
                                .textFieldStyle(.roundedBorder)
                            Button("Continue") { Task { await auth.verifyCode(code) } }
                                .buttonStyle(BeckettPrimaryButtonStyle())
                                .disabled(code.isEmpty || auth.isWorking)
                            HStack {
                                Button("Send another code") { Task { await auth.requestCode(email: sentEmail) } }
                                Spacer()
                                Button("Change email") {
                                    code = ""
                                    auth.changeEmail()
                                }
                            }
                            .font(.subheadline)
                            .disabled(auth.isWorking)
                        default:
                            Text("Sign in")
                                .font(.title2.bold())
                            TextField("Work or personal email", text: $email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .textFieldStyle(.roundedBorder)
                            Button("Email me a code") { Task { await auth.requestCode(email: email) } }
                                .buttonStyle(BeckettPrimaryButtonStyle())
                                .disabled(!email.contains("@") || auth.isWorking)

                            HStack {
                                Rectangle().fill(BeckettColor.ink.opacity(0.1)).frame(height: 1)
                                Text("or").font(.footnote).foregroundStyle(BeckettColor.inkLight)
                                Rectangle().fill(BeckettColor.ink.opacity(0.1)).frame(height: 1)
                            }

                            SignInWithAppleButton(.continue) { request in
                                auth.configureAppleRequest(request)
                            } onCompletion: { result in
                                Task { await auth.completeAppleAuthorization(result) }
                            }
                            .signInWithAppleButtonStyle(.black)
                            .frame(height: 50)
                            .clipShape(Capsule())
                        }

                        if let message = auth.errorMessage {
                            Text(message)
                                .font(.footnote)
                                .foregroundStyle(.red)
                                .accessibilityLabel("Sign-in error: \(message)")
                        }

                        if auth.isWorking {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Working…").font(.footnote)
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }

                Text("Beckett sends only the content you choose for coaching. It never sends a message for you.")
                    .font(.footnote)
                    .foregroundStyle(BeckettColor.inkLight)
            }
            .padding(24)
        }
        .beckettPage()
    }
}
