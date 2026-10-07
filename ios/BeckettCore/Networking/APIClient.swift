import Foundation

enum APIError: LocalizedError {
    case invalidResponse
    case server(status: Int, message: String, code: String?, safety: SafetyResponse?, usage: UsageSummary?)
    case decoding(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse: "Beckett received an invalid response."
        case let .server(_, message, _, _, _): message
        case .decoding: "Beckett could not read the server response."
        }
    }
}

struct APIErrorBody: Decodable {
    let error: String?
    let code: String?
    let safety: SafetyResponse?
    let usage: UsageSummary?
}

struct APIClient {
    private let session: URLSession
    private let baseURL: URL

    init(session: URLSession = .shared, baseURL: URL = AppConfiguration.apiBaseURL) {
        self.session = session
        self.baseURL = baseURL
    }

    func send<Response: Decodable, Body: Encodable>(
        _ path: String,
        method: String = "POST",
        body: Body,
        accessToken: String? = nil
    ) async throws -> Response {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        if let accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(body)
        return try await perform(request)
    }

    func get<Response: Decodable>(_ path: String, accessToken: String) async throws -> Response {
        var request = URLRequest(url: baseURL.appending(path: path))
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.cachePolicy = .reloadIgnoringLocalCacheData
        return try await perform(request)
    }

    private func perform<Response: Decodable>(_ request: URLRequest) async throws -> Response {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let body = try? JSONDecoder().decode(APIErrorBody.self, from: data)
            throw APIError.server(
                status: http.statusCode,
                message: body?.error ?? "Beckett could not complete that request.",
                code: body?.code,
                safety: body?.safety,
                usage: body?.usage
            )
        }
        do {
            return try JSONDecoder().decode(Response.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}

private struct EmptyBody: Encodable {}
