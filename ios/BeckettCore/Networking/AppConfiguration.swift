import Foundation

enum AppConfiguration {
    static var apiBaseURL: URL {
        guard
            let rawValue = Bundle.main.object(forInfoDictionaryKey: "BECKETT_API_BASE_URL") as? String,
            let url = URL(string: rawValue)
        else {
            preconditionFailure("BECKETT_API_BASE_URL is missing or invalid")
        }
        return url
    }

    static var keychainAccessGroup: String? {
        Bundle.main.object(forInfoDictionaryKey: "KEYCHAIN_GROUP_IDENTIFIER") as? String
    }
}
