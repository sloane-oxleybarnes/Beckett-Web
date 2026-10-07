import SwiftUI
import UIKit
import UniformTypeIdentifiers
import Vision

final class ShareViewController: UIViewController {
    private let model = ShareCoachModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: ShareCoachView(
            model: model,
            onClose: { [weak self] in self?.extensionContext?.completeRequest(returningItems: nil) }
        ))
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: view.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: view.bottomAnchor),
        ])
        host.didMove(toParent: self)
        Task { await model.load(from: extensionContext) }
    }
}

@MainActor
final class ShareCoachModel: ObservableObject {
    @Published var text = ""
    @Published var action: MobileCoachAction = .decode
    @Published var response: CoachResponse?
    @Published var isLoading = true
    @Published var errorMessage: String?

    private let api = APIClient()
    private let keychain = KeychainSessionStore()

    func load(from context: NSExtensionContext?) async {
        defer { isLoading = false }
        guard let providers = context?.inputItems
            .compactMap({ $0 as? NSExtensionItem })
            .flatMap({ $0.attachments ?? [] }) else { return }

        for provider in providers {
            if provider.hasItemConformingToTypeIdentifier(UTType.plainText.identifier),
               let value = try? await provider.loadItem(forTypeIdentifier: UTType.plainText.identifier),
               let sharedText = value as? String {
                text = sharedText
                return
            }
            if provider.hasItemConformingToTypeIdentifier(UTType.image.identifier),
               let value = try? await provider.loadItem(forTypeIdentifier: UTType.image.identifier),
               let image = Self.image(from: value),
               let recognized = try? await Self.recognizeText(in: image) {
                text = recognized
                return
            }
        }
    }

    func submit() async {
        guard let token = keychain.load()?.accessToken else {
            errorMessage = "Open Beckett and sign in before using the Share Extension."
            return
        }
        isLoading = true
        errorMessage = nil
        defer { isLoading = false }
        do {
            response = try await api.send(
                "api/mobile/v1/coach",
                body: CoachRequest(
                    action: action,
                    text: text,
                    conversationContext: "",
                    person: "",
                    goal: "",
                    source: "share_extension"
                ),
                accessToken: token
            )
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private static func image(from value: NSSecureCoding) -> UIImage? {
        if let image = value as? UIImage { return image }
        if let url = value as? URL, let data = try? Data(contentsOf: url) { return UIImage(data: data) }
        if let data = value as? Data { return UIImage(data: data) }
        return nil
    }

    private static func recognizeText(in image: UIImage) async throws -> String {
        guard let cgImage = image.cgImage else { return "" }
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
            let request = VNRecognizeTextRequest { request, error in
                if let error { continuation.resume(throwing: error); return }
                let text = (request.results as? [VNRecognizedTextObservation])?
                    .compactMap { $0.topCandidates(1).first?.string }
                    .joined(separator: "\n") ?? ""
                continuation.resume(returning: text)
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            DispatchQueue.global(qos: .userInitiated).async {
                do { try VNImageRequestHandler(cgImage: cgImage).perform([request]) }
                catch { continuation.resume(throwing: error) }
            }
        }
    }
}

private struct ShareCoachView: View {
    @ObservedObject var model: ShareCoachModel
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 14) {
                Picker("Coaching action", selection: $model.action) {
                    Text("Decode").tag(MobileCoachAction.decode)
                    Text("Respond").tag(MobileCoachAction.respond)
                    Text("Check tone").tag(MobileCoachAction.toneCheck)
                }
                .pickerStyle(.segmented)

                if model.isLoading && model.text.isEmpty {
                    Spacer()
                    ProgressView("Reading selected content…")
                    Spacer()
                } else if let response = model.response {
                    ScrollView { CompactShareResult(result: response.result) }
                } else {
                    TextEditor(text: $model.text)
                        .padding(8)
                        .background(.white, in: RoundedRectangle(cornerRadius: 12))
                        .overlay { RoundedRectangle(cornerRadius: 12).stroke(BeckettColor.ink.opacity(0.1)) }
                    Button("Ask Beckett") { Task { await model.submit() } }
                        .buttonStyle(BeckettPrimaryButtonStyle())
                        .disabled(model.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isLoading)
                }

                if let error = model.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }
            }
            .padding()
            .navigationTitle("Beckett")
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close", action: onClose) } }
            .beckettPage()
        }
    }
}

private struct CompactShareResult: View {
    let result: MobileCoachResult

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch result {
            case let .interpretation(value):
                Text(value.summary).font(.title3)
                ForEach(value.clearSignals, id: \.self) { Text("• \($0)") }
                if !value.uncertainties.isEmpty {
                    Text("What remains uncertain").font(.headline)
                    ForEach(value.uncertainties, id: \.self) { Text("• \($0)") }
                }
            case let .draftOptions(value):
                ForEach(value.options) { option in
                    BeckettCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(option.label).bold()
                            Text(option.text)
                            Button("Copy") { UIPasteboard.general.string = option.text }
                        }
                    }
                }
            case let .toneFeedback(value):
                Text(value.likelyLanding).font(.title3)
                ForEach(value.watchFor, id: \.self) { Text("• \($0)") }
                if let revision = value.revision {
                    BeckettCard {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Optional revision").bold()
                            Text(revision.text)
                            Button("Copy") { UIPasteboard.general.string = revision.text }
                        }
                    }
                }
            }
        }
    }
}
