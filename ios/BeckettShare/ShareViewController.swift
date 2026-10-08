import ImageIO
import SwiftUI
import UIKit
import UniformTypeIdentifiers
@preconcurrency import Vision

final class ShareViewController: UIViewController {
    private let model = ShareCoachModel()

    override func viewDidLoad() {
        super.viewDidLoad()
        let host = UIHostingController(rootView: ShareCoachView(
            model: model,
            onClose: { [weak self] in self?.finish() },
            onContinueInApp: { [weak self] in self?.continueInApp() }
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

    private func continueInApp() {
        do {
            let url = try model.makeHandoffURL()
            extensionContext?.open(url) { [weak self] opened in
                Task { @MainActor in
                    if opened {
                        self?.finish()
                    } else {
                        self?.model.errorMessage = "Beckett could not open. Try opening the app directly."
                    }
                }
            }
        } catch {
            model.errorMessage = "Beckett could not prepare the handoff."
        }
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}

@MainActor
final class ShareCoachModel: ObservableObject {
    enum SourceKind: Equatable {
        case text
        case image(count: Int)

        var label: String {
            switch self {
            case .text: "Shared text"
            case let .image(count): count == 1 ? "Text recognized on device" : "Text from \(count) images recognized on device"
            }
        }
    }

    @Published var text = ""
    @Published var action: MobileCoachAction = .decode
    @Published var response: CoachResponse?
    @Published var safetyResponse: SafetyResponse?
    @Published var isLoading = true
    @Published var errorMessage: String?
    @Published private(set) var sourceKind: SourceKind?
    @Published private(set) var usedSelection = false

    private let api = APIClient()
    private let keychain = KeychainSessionStore()

    func load(from context: NSExtensionContext?) async {
        defer { isLoading = false }
        guard let providers = context?.inputItems
            .compactMap({ $0 as? NSExtensionItem })
            .flatMap({ $0.attachments ?? [] }),
              !providers.isEmpty else {
            errorMessage = "No text or image was shared with Beckett."
            return
        }

        var textParts: [String] = []
        var recognizedImageCount = 0

        for provider in providers {
            if let sharedText = await Self.loadText(from: provider), !sharedText.isEmpty {
                textParts.append(sharedText)
                continue
            }
            if let image = await Self.loadImage(from: provider) {
                do {
                    let recognized = try await Self.recognizeText(in: image)
                    if !recognized.isEmpty {
                        textParts.append(recognized)
                        recognizedImageCount += 1
                    }
                } catch {
                    errorMessage = "Beckett could not read text from that image. You can type or paste the relevant text instead."
                }
            }
        }

        text = textParts.joined(separator: "\n\n").trimmingCharacters(in: .whitespacesAndNewlines)
        if text.count > 12_000 {
            text = String(text.prefix(12_000))
            errorMessage = "The shared content was shortened to the first 12,000 characters. Select the relevant passage before continuing."
        }
        sourceKind = recognizedImageCount > 0 ? .image(count: recognizedImageCount) : .text
        if text.isEmpty && errorMessage == nil {
            errorMessage = "No readable text was found. You can type or paste the relevant text below."
        }
    }

    func useSelection(_ range: NSRange) {
        guard range.length > 0,
              let swiftRange = Range(range, in: text) else { return }
        let selection = String(text[swiftRange]).trimmingCharacters(in: .whitespacesAndNewlines)
        guard !selection.isEmpty else { return }
        text = selection
        usedSelection = true
        response = nil
        safetyResponse = nil
        errorMessage = nil
    }

    func submit() async {
        guard var session = keychain.load() else {
            errorMessage = "Open Beckett and sign in before using the Share Extension."
            return
        }
        isLoading = true
        errorMessage = nil
        safetyResponse = nil
        defer { isLoading = false }

        do {
            if session.expiresSoon { session = try await refresh(session) }
            response = try await coach(using: session.accessToken)
        } catch let APIError.server(status, _, _, _, _) where status == 401 {
            do {
                session = try await refresh(session)
                response = try await coach(using: session.accessToken)
            } catch {
                errorMessage = "Your Beckett session expired. Open the app and sign in again."
            }
        } catch let APIError.server(_, message, _, safety, _) {
            safetyResponse = safety
            if safety == nil { errorMessage = message }
        } catch let error as URLError where error.code == .notConnectedToInternet {
            errorMessage = "You appear to be offline. Your text has not been sent."
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func startOver() {
        response = nil
        safetyResponse = nil
        errorMessage = nil
    }

    func makeHandoffURL() throws -> URL {
        let selected = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !selected.isEmpty else { throw HandoffError.emptyText }
        let handoff = MobileCoachHandoff(action: action, text: selected)
        try MobileCoachHandoffStore.save(handoff)
        guard let url = handoff.deepLink else { throw HandoffError.invalidURL }
        return url
    }

    private func coach(using accessToken: String) async throws -> CoachResponse {
        try await api.send(
            "api/mobile/v1/coach",
            body: CoachRequest(
                action: action,
                text: text,
                conversationContext: "",
                person: "",
                goal: "",
                source: "share_extension"
            ),
            accessToken: accessToken
        )
    }

    private func refresh(_ session: BeckettSession) async throws -> BeckettSession {
        let envelope: SessionEnvelope = try await api.send(
            "api/mobile/v1/auth/refresh",
            body: ShareRefreshRequest(refreshToken: session.refreshToken)
        )
        try keychain.save(envelope.session)
        return envelope.session
    }

    private static func loadText(from provider: NSItemProvider) async -> String? {
        let identifiers = [UTType.plainText.identifier, UTType.text.identifier]
        for identifier in identifiers where provider.hasItemConformingToTypeIdentifier(identifier) {
            guard let value = try? await provider.loadItem(forTypeIdentifier: identifier) else { continue }
            if let string = value as? String { return string }
            if let attributed = value as? NSAttributedString { return attributed.string }
            if let url = value as? URL { return url.absoluteString }
        }
        return nil
    }

    private static func loadImage(from provider: NSItemProvider) async -> UIImage? {
        guard provider.hasItemConformingToTypeIdentifier(UTType.image.identifier),
              let value = try? await provider.loadItem(forTypeIdentifier: UTType.image.identifier) else { return nil }
        if let image = value as? UIImage { return image }
        if let url = value as? URL, let data = try? Data(contentsOf: url) { return UIImage(data: data) }
        if let data = value as? Data { return UIImage(data: data) }
        return nil
    }

    private static func recognizeText(in image: UIImage) async throws -> String {
        guard let cgImage = image.cgImage else { return "" }
        let orientation = CGImagePropertyOrientation(image.imageOrientation)
        return try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
            let request = VNRecognizeTextRequest { request, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let text = (request.results as? [VNRecognizedTextObservation])?
                    .compactMap { $0.topCandidates(1).first?.string }
                    .joined(separator: "\n") ?? ""
                continuation.resume(returning: text)
            }
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            request.automaticallyDetectsLanguage = true
            request.minimumTextHeight = 0.012
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    try VNImageRequestHandler(cgImage: cgImage, orientation: orientation).perform([request])
                } catch {
                    continuation.resume(throwing: error)
                }
            }
        }
    }

    private enum HandoffError: Error {
        case emptyText
        case invalidURL
    }
}

private struct ShareRefreshRequest: Encodable {
    let refreshToken: String
}

private extension CGImagePropertyOrientation {
    init(_ orientation: UIImage.Orientation) {
        switch orientation {
        case .up: self = .up
        case .upMirrored: self = .upMirrored
        case .down: self = .down
        case .downMirrored: self = .downMirrored
        case .left: self = .left
        case .leftMirrored: self = .leftMirrored
        case .right: self = .right
        case .rightMirrored: self = .rightMirrored
        @unknown default: self = .up
        }
    }
}

private struct ShareCoachView: View {
    @ObservedObject var model: ShareCoachModel
    let onClose: () -> Void
    let onContinueInApp: () -> Void
    @State private var selectedRange = NSRange(location: 0, length: 0)

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Picker("Coaching action", selection: $model.action) {
                    ForEach(MobileCoachAction.visibleCases) { action in
                        Text(action.shortTitle).tag(action)
                    }
                }
                .pickerStyle(.menu)
                .frame(maxWidth: .infinity, alignment: .leading)

                if model.isLoading && model.text.isEmpty {
                    Spacer()
                    ProgressView("Reading selected content on device…")
                    Spacer()
                } else if let safety = model.safetyResponse {
                    ScrollView { CompactSafetyResult(safety: safety) }
                    Button("Continue in Beckett", action: onContinueInApp)
                        .buttonStyle(BeckettPrimaryButtonStyle())
                } else if let response = model.response {
                    ScrollView { CompactShareResult(result: response.result) }
                    HStack {
                        Button("Edit request") { model.startOver() }
                            .buttonStyle(.bordered)
                        Button("Continue in app", action: onContinueInApp)
                            .buttonStyle(.borderedProminent)
                            .tint(BeckettColor.primary)
                    }
                } else {
                    sourceStatus
                    SelectableTextEditor(text: $model.text, selectedRange: $selectedRange)
                        .frame(minHeight: 180)
                        .background(BeckettColor.card, in: RoundedRectangle(cornerRadius: 12))
                        .overlay { RoundedRectangle(cornerRadius: 12).stroke(BeckettColor.ink.opacity(0.1)) }

                    HStack {
                        Button("Use selection") { model.useSelection(selectedRange) }
                            .disabled(selectedRange.length == 0)
                        Spacer()
                        Text(selectedRange.length > 0 ? "\(selectedRange.length) characters selected" : "Select text to narrow it")
                            .font(.caption)
                            .foregroundStyle(BeckettColor.inkLight)
                    }

                    Button {
                        Task { await model.submit() }
                    } label: {
                        HStack {
                            if model.isLoading { ProgressView().tint(.white) }
                            Text(model.isLoading ? "Preparing…" : "Ask Beckett")
                        }
                    }
                    .buttonStyle(BeckettPrimaryButtonStyle())
                    .disabled(model.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || model.isLoading)

                    Button("Continue in the full app", action: onContinueInApp)
                        .font(.subheadline.weight(.semibold))
                        .disabled(model.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }

                if let error = model.errorMessage {
                    Label(error, systemImage: "exclamationmark.triangle")
                        .font(.footnote)
                        .foregroundStyle(.red)
                        .accessibilityLabel("Error: \(error)")
                }

                Label("Content stays on this device until you tap Ask Beckett.", systemImage: "lock")
                    .font(.caption)
                    .foregroundStyle(BeckettColor.inkLight)
            }
            .padding()
            .navigationTitle("Beckett")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Close", action: onClose) } }
            .beckettPage()
        }
    }

    @ViewBuilder
    private var sourceStatus: some View {
        if let source = model.sourceKind {
            Label(source.label, systemImage: source == .text ? "text.quote" : "viewfinder")
                .font(.caption.weight(.semibold))
                .foregroundStyle(BeckettColor.primaryDark)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        if model.usedSelection {
            Label("Using only the passage you selected", systemImage: "selection.pin.in.out")
                .font(.caption)
                .foregroundStyle(BeckettColor.inkMid)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct SelectableTextEditor: UIViewRepresentable {
    @Binding var text: String
    @Binding var selectedRange: NSRange

    func makeCoordinator() -> Coordinator { Coordinator(parent: self) }

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.delegate = context.coordinator
        view.font = .preferredFont(forTextStyle: .body)
        view.adjustsFontForContentSizeCategory = true
        view.backgroundColor = .clear
        view.textContainerInset = UIEdgeInsets(top: 12, left: 8, bottom: 12, right: 8)
        view.accessibilityLabel = "Shared text. Select the relevant passage or edit the text."
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        if view.text != text { view.text = text }
    }

    final class Coordinator: NSObject, UITextViewDelegate {
        var parent: SelectableTextEditor
        init(parent: SelectableTextEditor) { self.parent = parent }

        func textViewDidChange(_ textView: UITextView) {
            parent.text = textView.text
        }

        func textViewDidChangeSelection(_ textView: UITextView) {
            parent.selectedRange = textView.selectedRange
        }
    }
}

private struct CompactSafetyResult: View {
    let safety: SafetyResponse

    var body: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 10) {
                Label(safety.title, systemImage: "heart.text.square").font(.headline)
                Text(safety.message)
                ForEach(safety.resources) { resource in
                    Link(resource.label, destination: resource.href)
                }
            }
        }
    }
}

private struct CompactShareResult: View {
    let result: MobileCoachResult

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            switch result {
            case let .interpretation(value):
                BeckettCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text(value.summary).font(.title3)
                        ForEach(value.clearSignals.prefix(2), id: \.self) { Text("• \($0)") }
                        if let uncertainty = value.uncertainties.first {
                            Text("Still uncertain").font(.headline)
                            Text(uncertainty)
                        }
                    }
                }
            case let .draftOptions(value):
                ForEach(value.options.prefix(2)) { option in
                    CompactDraftCard(label: option.label, text: option.text)
                }
            case let .toneFeedback(value):
                BeckettCard {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("How it may land").font(.headline)
                        Text(value.likelyLanding).font(.title3)
                        if let watch = value.watchFor.first { Text("• \(watch)") }
                    }
                }
                if let revision = value.revision {
                    CompactDraftCard(label: "Optional revision", text: revision.text)
                }
            }
        }
    }
}

private struct CompactDraftCard: View {
    let label: String
    let text: String
    @State private var copied = false

    var body: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 8) {
                Text(label).bold()
                Text(text).textSelection(.enabled)
                HStack {
                    Button {
                        UIPasteboard.general.string = text
                        copied = true
                    } label: {
                        Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
                    }
                    ShareLink(item: text) { Label("Share", systemImage: "square.and.arrow.up") }
                }
            }
        }
    }
}
