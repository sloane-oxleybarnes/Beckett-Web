import Foundation

struct BeckettUser: Codable, Equatable {
    let id: String
    let email: String?
}

struct BeckettSession: Codable, Equatable {
    let accessToken: String
    let refreshToken: String
    let expiresAt: Int?
    let tokenType: String
    let user: BeckettUser

    var expiresSoon: Bool {
        guard let expiresAt else { return false }
        return Date(timeIntervalSince1970: TimeInterval(expiresAt)).timeIntervalSinceNow < 120
    }
}

struct SessionEnvelope: Decodable {
    let session: BeckettSession
}

struct SessionProfile: Decodable {
    struct User: Decodable {
        let id: String
        let email: String?
        let displayName: String?
        let plan: String
        let onboardingComplete: Bool
    }

    let user: User
    let privacy: PrivacyPreferences
}

struct PrivacyPreferences: Codable, Equatable {
    struct AIProcessing: Codable, Equatable {
        let allowed: Bool
        let current: Bool
        let consentVersion: String?
        let requiredVersion: String
        let consentedAt: String?
        let disclosure: String
    }

    struct Retention: Codable, Equatable {
        let mode: String
        let disclosure: String
    }

    let aiProcessing: AIProcessing
    let retention: Retention
    let updatedAt: String?
}

struct PrivacyEnvelope: Decodable {
    let privacy: PrivacyPreferences
}
