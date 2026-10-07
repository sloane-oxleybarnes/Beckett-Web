import SwiftUI
import UIKit

struct CoachView: View {
    @EnvironmentObject private var auth: AuthStore
    @EnvironmentObject private var handoff: CoachHandoffCoordinator
    @StateObject private var coach = CoachStore()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    creditsView
                    if let response = coach.response {
                        CoachResultView(response: response, onStartOver: coach.startOver)
                    } else {
                        composeView
                    }
                }
                .padding(20)
            }
            .scrollDismissesKeyboard(.interactively)
            .navigationTitle("Coach")
            .beckettPage()
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
            Text("What would help right now?")
                .font(.system(size: 28, weight: .regular, design: .serif))

            LazyVGrid(columns: [.init(.flexible()), .init(.flexible())], spacing: 10) {
                ForEach(MobileCoachAction.allCases) { action in
                    Button {
                        coach.selectedAction = action
                    } label: {
                        VStack(alignment: .leading, spacing: 10) {
                            Image(systemName: action.systemImage)
                                .font(.title2)
                            Text(action.title)
                                .font(.subheadline.bold())
                                .multilineTextAlignment(.leading)
                        }
                        .frame(maxWidth: .infinity, minHeight: 82, alignment: .leading)
                        .padding(14)
                        .background(
                            coach.selectedAction == action ? BeckettColor.primaryLight : BeckettColor.card,
                            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(coach.selectedAction == action ? BeckettColor.primary : BeckettColor.ink.opacity(0.08))
                        }
                    }
                    .buttonStyle(.plain)
                    .disabled(coach.isLoading)
                    .accessibilityLabel(action.title)
                    .accessibilityAddTraits(coach.selectedAction == action ? .isSelected : [])
                }
            }

            BeckettCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text(coach.selectedAction.inputTitle).font(.headline)
                    TextEditor(text: $coach.text)
                        .frame(minHeight: 150)
                        .scrollContentBackground(.hidden)
                        .accessibilityLabel(coach.selectedAction.inputTitle)
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
            let unauthorized = await coach.submit(accessToken: token)
            if unauthorized, let refreshed = await auth.refreshedAccessToken() {
                await coach.submit(accessToken: refreshed)
            }
        }
    }
}

private extension MobileCoachAction {
    var inputTitle: String {
        switch self {
        case .decode, .respond, .clarify: "Paste the message"
        case .rewrite, .toneCheck: "Paste your draft"
        }
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
    let onStartOver: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                Text("Beckett’s read")
                    .font(.system(size: 28, weight: .regular, design: .serif))
                Spacer()
                Button("Start over", action: onStartOver).font(.subheadline)
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
                Text(result.summary).font(.title3)
                ResultActions(text: shareText)
                ResultList(title: "What is clear", values: result.clearSignals)
                if !result.possibleReadings.isEmpty {
                    Text("Possible readings").font(.headline)
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
                ResultList(title: "Questions you could ask", values: result.usefulQuestions)
            }
        }
    }

    private var shareText: String {
        ([result.summary] + result.clearSignals + result.usefulQuestions).joined(separator: "\n\n")
    }
}

private struct DraftOptionsResultView: View {
    let result: DraftOptionsResult

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(result.contextSummary).foregroundStyle(BeckettColor.inkMid)
            ResultList(title: "Intent kept", values: result.preservedIntent)
            ForEach(result.options) { option in
                DraftOptionCard(option: option)
            }
            if let uncertainty = result.uncertaintyNote {
                Label(uncertainty, systemImage: "questionmark.circle")
                    .font(.footnote)
                    .foregroundStyle(BeckettColor.inkMid)
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
                Text(option.label).font(.headline)
                TextEditor(text: $text)
                    .frame(minHeight: 90)
                    .scrollContentBackground(.hidden)
                    .accessibilityLabel("\(option.label) draft")
                Text(option.rationale)
                    .font(.footnote)
                    .foregroundStyle(BeckettColor.inkMid)
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
                Text(title).font(.headline)
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
