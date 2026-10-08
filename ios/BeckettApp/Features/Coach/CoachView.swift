import SwiftUI
import UIKit

struct CoachView: View {
    @Binding var contextMode: MobileContextMode
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var handoff: CoachHandoffCoordinator
    @StateObject private var coach = CoachStore()

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        Color.clear
                            .frame(height: 0)
                            .id("coach-top")
                        if let response = coach.response {
                            CoachResultView(
                                response: response,
                                originalMessage: coach.text,
                                onStartOver: coach.startOver
                            )
                        } else {
                            composeView
                        }
                    }
                    .padding(20)
                }
                .scrollDismissesKeyboard(.interactively)
                .beckettBrandNavigation()
                .toolbar(.visible, for: .tabBar)
                .beckettPage()
                .onChange(of: coach.response?.requestId) { _, _ in
                    scrollToTop(proxy)
                }
                .onChange(of: coach.safetyResponse) { _, _ in
                    scrollToTop(proxy)
                }
                .onChange(of: handoff.pending) { _, pending in
                    guard let pending else { return }
                    coach.apply(pending)
                    handoff.finish(pending.id)
                }
                .onAppear {
                    guard let pending = handoff.pending else { return }
                    coach.apply(pending)
                    handoff.finish(pending.id)
                }
            }
        }
    }

    private func scrollToTop(_ proxy: ScrollViewProxy) {
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.25)) {
                proxy.scrollTo("coach-top", anchor: .top)
            }
        }
    }

    @ViewBuilder
    private var creditsView: some View {
        if let usage = coach.usage ?? auth.profile?.usage {
            HStack(spacing: 8) {
                Image(systemName: usage.unlimited ? "infinity" : "sparkles")
                Text(usage.unlimited ? "Unlimited coaching" : "\(usage.remaining) of \(usage.limit) coaching credits left today")
                    .font(.footnote.weight(.semibold))
            }
            .foregroundStyle(BeckettColor.primaryDark)
            .accessibilityElement(children: .combine)
        }
    }

    private var composeView: some View {
        Group {
            ContextModePicker(selection: $contextMode)

            HStack(alignment: .top, spacing: 12) {
                ForEach(MobileCoachAction.visibleCases) { action in
                    Button {
                        coach.selectedAction = action
                    } label: {
                        VStack(spacing: 8) {
                            Image(systemName: action.systemImage)
                                .font(.title2)
                                .frame(width: 64, height: 64)
                                .foregroundStyle(
                                    coach.selectedAction == action ? Color.white : BeckettColor.primaryDark
                                )
                                .background(
                                    coach.selectedAction == action ? BeckettColor.primary : BeckettColor.card,
                                    in: Circle()
                                )
                                .overlay {
                                    Circle()
                                        .stroke(
                                            coach.selectedAction == action ? BeckettColor.primaryDark : BeckettColor.ink.opacity(0.12),
                                            lineWidth: coach.selectedAction == action ? 2 : 1
                                        )
                                }
                            Text(action.shortTitle)
                                .font(.subheadline.bold())
                                .lineLimit(1)
                                .minimumScaleFactor(0.8)
                                .foregroundStyle(BeckettColor.ink)
                        }
                        .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.plain)
                    .disabled(coach.isLoading)
                    .accessibilityLabel(action.shortTitle)
                    .accessibilityAddTraits(coach.selectedAction == action ? .isSelected : [])
                }
            }

            BeckettCard {
                VStack(alignment: .leading, spacing: 10) {
                    ZStack(alignment: .topLeading) {
                        if coach.text.isEmpty {
                            Text(coach.selectedAction.inputPlaceholder)
                                .foregroundStyle(BeckettColor.inkLight)
                                .padding(.horizontal, 5)
                                .padding(.vertical, 8)
                                .allowsHitTesting(false)
                        }
                        TextEditor(text: $coach.text)
                            .frame(minHeight: 150)
                            .scrollContentBackground(.hidden)
                            .accessibilityLabel(coach.selectedAction.inputPlaceholder)
                    }
                    Divider()
                    TextField("Person or relationship (optional)", text: $coach.person)
                        .textContentType(.name)
                    TextField("What do you want to happen? (optional)", text: $coach.goal, axis: .vertical)
                    DisclosureGroup("Add surrounding context") {
                        TextField("Earlier messages or relevant context", text: $coach.conversationContext, axis: .vertical)
                            .padding(.top, 8)
                    }
                    .font(.subheadline)
                }
            }
            .disabled(coach.isLoading)

            creditsView

            Button(action: submit) {
                HStack {
                    if coach.isLoading { ProgressView().tint(.white) }
                    Text(coach.isLoading ? "Preparing coaching…" : "Ask Beckett")
                }
            }
            .buttonStyle(BeckettPrimaryButtonStyle())
            .disabled(coach.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || coach.isLoading)

            if coach.isLoading {
                CoachLoadingView(action: coach.selectedAction)
            }

            if let safety = coach.safetyResponse {
                SafetyResultView(safety: safety, onStartOver: coach.startOver)
            } else if let message = coach.errorMessage {
                CoachFailureView(
                    message: message,
                    isCreditLimit: coach.errorCode == "mobile_usage_limit_reached",
                    onRetry: submit
                )
            }

            Label("Beckett will not send or save this message.", systemImage: "lock")
                .font(.footnote)
                .foregroundStyle(BeckettColor.inkLight)
        }
    }

    private func submit() {
        guard let token = auth.session?.accessToken else { return }
        Task {
            let unauthorized = await coach.submit(accessToken: token, contextMode: contextMode)
            if unauthorized, let refreshed = await auth.refreshedAccessToken() {
                await coach.submit(accessToken: refreshed, contextMode: contextMode)
            }
        }
    }
}

private extension MobileCoachAction {
    var inputPlaceholder: String {
        "Paste message here"
    }
}

private struct CoachLoadingView: View {
    let action: MobileCoachAction

    var body: some View {
        BeckettCard {
            HStack(spacing: 14) {
                ProgressView().tint(BeckettColor.primary)
                VStack(alignment: .leading, spacing: 4) {
                    Text("Looking at the words and context").font(.headline)
                    Text("Your \(action.title.lowercased()) result usually takes a few seconds.")
                        .font(.footnote)
                        .foregroundStyle(BeckettColor.inkMid)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Preparing coaching")
    }
}

private struct CoachFailureView: View {
    let message: String
    let isCreditLimit: Bool
    let onRetry: () -> Void

    var body: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 10) {
                Label(isCreditLimit ? "No credits left today" : "That didn’t work", systemImage: isCreditLimit ? "clock" : "exclamationmark.triangle")
                    .font(.headline)
                Text(message).foregroundStyle(BeckettColor.inkMid)
                if !isCreditLimit {
                    Button("Try again", action: onRetry)
                        .buttonStyle(.bordered)
                        .tint(BeckettColor.primary)
                }
            }
        }
        .accessibilityElement(children: .contain)
    }
}

private struct SafetyResultView: View {
    let safety: SafetyResponse
    let onStartOver: () -> Void

    var body: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 12) {
                Label(safety.title, systemImage: "heart.text.square")
                    .font(.title3.bold())
                Text(safety.message)
                Text("Resources for \(safety.regionLabel)")
                    .font(.headline)
                ForEach(safety.resources) { resource in
                    Link(destination: resource.href) {
                        Label(resource.label, systemImage: "arrow.up.right.square")
                    }
                }
                Button("Start a different request", action: onStartOver)
                    .buttonStyle(.bordered)
                    .tint(BeckettColor.primary)
            }
        }
    }
}

private struct CoachResultView: View {
    let response: CoachResponse
    let originalMessage: String
    let onStartOver: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("BECKETT’S READ")
                    .font(.caption.weight(.bold))
                    .tracking(0.8)
                    .foregroundStyle(BeckettColor.primaryDark)
                Spacer()
                Button("Start over", action: onStartOver).font(.subheadline)
            }

            BeckettCard {
                VStack(alignment: .leading, spacing: 8) {
                    Text("ORIGINAL MESSAGE")
                        .font(.caption.weight(.bold))
                        .tracking(0.8)
                        .foregroundStyle(BeckettColor.primaryDark)
                    Text(originalMessage)
                        .font(.body)
                        .foregroundStyle(BeckettColor.inkMid)
                        .textSelection(.enabled)
                }
            }

            switch response.result {
            case let .interpretation(result): InterpretationResultView(result: result)
            case let .draftOptions(result): DraftOptionsResultView(result: result)
            case let .toneFeedback(result): ToneFeedbackResultView(result: result)
            }

            Label("Message and result were not saved", systemImage: "lock")
                .font(.footnote)
                .foregroundStyle(BeckettColor.inkLight)
        }
    }
}

private struct InterpretationResultView: View {
    let result: InterpretationResult

    var body: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 16) {
                Text(result.summary)
                    .font(.body.weight(.medium))
                ResultActions(text: shareText)
                ResultList(title: "What is clear", values: result.clearSignals)
                if !result.possibleReadings.isEmpty {
                    ResultSectionLabel("Possible readings")
                    ForEach(result.possibleReadings) { reading in
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(reading.label).bold()
                                Spacer()
                                Text(reading.confidence.capitalized)
                                    .font(.caption)
                                    .foregroundStyle(BeckettColor.inkLight)
                            }
                            Text(reading.explanation)
                            Text("Signal: \(reading.evidence)")
                                .font(.footnote)
                                .foregroundStyle(BeckettColor.inkMid)
                        }
                        .padding(.vertical, 5)
                    }
                }
                ResultList(title: "What remains uncertain", values: result.uncertainties)
            }
        }
    }

    private var shareText: String {
        ([result.summary] + result.clearSignals + result.uncertainties).joined(separator: "\n\n")
    }
}

private struct DraftOptionsResultView: View {
    let result: DraftOptionsResult

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(result.options) { option in
                DraftOptionCard(option: option)
            }
        }
    }
}

private struct DraftOptionCard: View {
    let option: DraftOptionsResult.Option
    @State private var text: String

    init(option: DraftOptionsResult.Option) {
        self.option = option
        _text = State(initialValue: option.text)
    }

    var body: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 10) {
                Text(option.label.uppercased())
                    .font(.caption.weight(.bold))
                    .tracking(0.7)
                    .foregroundStyle(BeckettColor.primaryDark)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(BeckettColor.primaryLight, in: Capsule())
                TextEditor(text: $text)
                    .frame(minHeight: 90)
                    .scrollContentBackground(.hidden)
                    .accessibilityLabel("\(option.label) draft")
                ResultActions(text: text)
            }
        }
    }
}

private struct ToneFeedbackResultView: View {
    let result: ToneFeedbackResult

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            BeckettCard {
                VStack(alignment: .leading, spacing: 14) {
                    Text("How it may land").font(.headline)
                    Text(result.likelyLanding).font(.title3)
                    ResultActions(text: result.likelyLanding)
                    ResultList(title: "What works", values: result.strengths)
                    ResultList(title: "Worth noticing", values: result.watchFor)
                }
            }
            if let revision = result.revision {
                BeckettCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Optional revision").font(.headline)
                        Text(revision.text).textSelection(.enabled)
                        ResultList(title: "What changed", values: revision.changes)
                        ResultActions(text: revision.text)
                    }
                }
            }
        }
    }
}

private struct ResultActions: View {
    let text: String
    @State private var copied = false

    var body: some View {
        HStack(spacing: 14) {
            Button {
                UIPasteboard.general.string = text
                copied = true
            } label: {
                Label(copied ? "Copied" : "Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
            }
            ShareLink(item: text) {
                Label("Share", systemImage: "square.and.arrow.up")
            }
        }
        .font(.subheadline.weight(.semibold))
        .tint(BeckettColor.primaryDark)
    }
}

private struct ResultList: View {
    let title: String
    let values: [String]

    var body: some View {
        if !values.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                ResultSectionLabel(title)
                ForEach(values, id: \.self) { value in
                    HStack(alignment: .top, spacing: 8) {
                        Circle().fill(BeckettColor.primary).frame(width: 5, height: 5).padding(.top, 7)
                        Text(value)
                    }
                }
            }
        }
    }
}

private struct ResultSectionLabel: View {
    let title: String

    init(_ title: String) {
        self.title = title
    }

    var body: some View {
        Text(title.uppercased())
            .font(.caption.weight(.bold))
            .tracking(0.7)
            .foregroundStyle(BeckettColor.primaryDark)
    }
}
