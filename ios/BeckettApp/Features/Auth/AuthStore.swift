import AuthenticationServices
import CryptoKit
import Foundation
import Security

@MainActor
final class AuthStore: ObservableObject {
    enum State: Equatable {
        case loading
        case signedOut
        case codeSent(email: String)
        case signedIn
    }

    @Published private(set) var state: State = .loading
    @Published private(set) var session: BeckettSession?
    @Published private(set) var profile: SessionProfile?
    @Published var errorMessage: String?
    @Published var isWorking = false

    private let api: APIClient
    private let keychain: KeychainSessionStore
    private var appleNonce: String?

    init(api: APIClient = APIClient(), keychain: KeychainSessionStore = KeychainSessionStore()) {
        self.api = api
        self.keychain = keychain
    }

    func bootstrap() async {
        guard var stored = keychain.load() else {
            state = .signedOut
            return
        }
        do {
            if stored.expiresSoon { stored = try await refresh(stored) }
            session = stored
            profile = try await api.get("api/mobile/v1/session", accessToken: stored.accessToken)
            state = .signedIn
        } catch {
            keychain.clear()
            session = nil
            profile = nil
            state = .signedOut
        }
    }

    func requestCode(email: String) async {
        await work {
            let normalized = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            let _: OkayResponse = try await api.send(
                "api/mobile/v1/auth/email/request",
                body: EmailRequest(email: normalized)
            )
            state = .codeSent(email: normalized)
        }
    }

    func verifyCode(_ code: String) async {
        guard case let .codeSent(email) = state else { return }
        await work {
            let response: SessionEnvelope = try await api.send(
                "api/mobile/v1/auth/email/verify",
                body: EmailVerification(email: email, code: code)
            )
            try await accept(response.session)
        }
    }

    func configureAppleRequest(_ request: ASAuthorizationAppleIDRequest) {
        let nonce = Self.randomNonce()
        appleNonce = nonce
        request.requestedScopes = [.email, .fullName]
        request.nonce = Self.sha256(nonce)
    }

    func completeAppleAuthorization(_ result: Result<ASAuthorization, Error>) async {
        await work {
            let authorization = try result.get()
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let tokenData = credential.identityToken,
                  let identityToken = String(data: tokenData, encoding: .utf8),
                  let nonce = appleNonce else {
                throw SignInError.invalidAppleCredential
            }
            let response: SessionEnvelope = try await api.send(
                "api/mobile/v1/auth/apple",
                body: AppleRequest(identityToken: identityToken, nonce: nonce)
            )
            appleNonce = nil
            try await accept(response.session)
        }
    }

    func updatePrivacy(aiProcessingAllowed: Bool, retentionMode: String) async {
        guard let session else { return }
        await work {
            let envelope: PrivacyEnvelope = try await api.send(
                "api/mobile/v1/privacy",
                method: "PUT",
                body: PrivacyUpdate(
                    aiProcessingAllowed: aiProcessingAllowed,
                    retentionMode: retentionMode
                ),
                accessToken: session.accessToken
            )
            if let profile {
                self.profile = SessionProfile(user: profile.user, privacy: envelope.privacy)
            }
        }
    }

    func refreshProfile() async {
        guard let session else { return }
        await work {
            profile = try await api.get("api/mobile/v1/session", accessToken: session.accessToken)
        }
    }

    func signOut() {
        keychain.clear()
        session = nil
        profile = nil
        errorMessage = nil
        state = .signedOut
    }

    private func accept(_ newSession: BeckettSession) async throws {
        try keychain.save(newSession)
        session = newSession
        profile = try await api.get("api/mobile/v1/session", accessToken: newSession.accessToken)
        state = .signedIn
    }

    private func refresh(_ current: BeckettSession) async throws -> BeckettSession {
        let response: SessionEnvelope = try await api.send(
            "api/mobile/v1/auth/refresh",
            body: RefreshRequest(refreshToken: current.refreshToken)
        )
        try keychain.save(response.session)
        return response.session
    }

    private func work(_ operation: () async throws -> Void) async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do { try await operation() }
        catch { errorMessage = error.localizedDescription }
    }

    private static func sha256(_ value: String) -> String {
        SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
    }

    private static func randomNonce(length: Int = 32) -> String {
        let characters = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var bytes = [UInt8](repeating: 0, count: 16)
            guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
                preconditionFailure("Could not create a secure nonce")
            }
            for byte in bytes where remaining > 0 && Int(byte) < characters.count {
                result.append(characters[Int(byte)])
                remaining -= 1
            }
        }
        return result
    }
}

private struct OkayResponse: Decodable { let ok: Bool }
private struct EmailRequest: Encodable { let email: String }
private struct EmailVerification: Encodable { let email: String; let code: String }
private struct AppleRequest: Encodable { let identityToken: String; let nonce: String }
private struct RefreshRequest: Encodable { let refreshToken: String }
private struct PrivacyUpdate: Encodable { let aiProcessingAllowed: Bool; let retentionMode: String }

private enum SignInError: LocalizedError {
    case invalidAppleCredential
    var errorDescription: String? { "Apple did not return a usable sign-in credential." }
}
