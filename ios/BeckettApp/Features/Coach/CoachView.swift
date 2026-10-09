import SwiftUI
import UIKit

struct CoachView: View {
    @Binding var contextMode: MobileContextMode
    let onPractice: (PracticePrefill) -> Void
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
                            VStack(alignment: .leading, spacing: 18) {
                                CoachResultView(
                                    response: response,
                                    originalMessage: coach.text,
                                    contextMode: contextMode,
                                    isLoading: coach.isLoading,
                                    onStartOver: coach.startOver,
                                    onDraftResponse: draftResponse
                                )
                                InboxFollowUpView(
                                    messages: coach.followUpMessages,
                                    draft: $coach.followUpDraft,
                                    suggestions: followUpSuggestions,
                                    isLoading: coach.isFollowingUp,
                                    onSend: sendFollowUp
                                )
                                if let safety = coach.safetyResponse {
                                    SafetyResultView(safety: safety, onStartOver: coach.startOver)
                                } else if let message = coach.errorMessage {
                                    CoachFailureView(
                                        message: message,
                                        isCreditLimit: coach.errorCode == "mobile_usage_limit_reached",
                                        onRetry: sendFollowUp
                                    )
                                }
                                PracticeResultButton(onPractice: practiceConversation)
                            }
                        } else {
                            composeView
                        }
                        Color.clear
                            .frame(height: 0)
                            .id("inbox-bottom")
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
                .onChange(of: coach.followUpMessages.count) { _, count in
                    if count > 0 { scrollToBottom(proxy) }
                }
                .onChange(of: handoff.pending) { _, pending in
                    guard let pending else { return }
                    apply(pending)
                }
                .onAppear {
                    guard let pending = handoff.pending else { return }
                    apply(pending)
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

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        DispatchQueue.main.async {
            withAnimation(.easeOut(duration: 0.25)) {
                proxy.scrollTo("inbox-bottom", anchor: .bottom)
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
            VStack(alignment: .leading, spacing: 4) {
                Text("Inbox")
                    .font(.system(size: 30, weight: .regular, design: .serif))
                Text("Start with a message, then keep talking with Beckett.")
                    .font(.subheadline)
                    .foregroundStyle(BeckettColor.inkMid)
            }

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
        requestCoaching()
    }

    private func requestCoaching(action: MobileCoachAction? = nil, source: String = "app") {
        guard let token = auth.session?.accessToken else { return }
        Task {
            let unauthorized = await coach.submit(
                accessToken: token,
                contextMode: contextMode,
                action: action,
                source: source
            )
            if unauthorized, let refreshed = await auth.refreshedAccessToken() {
                await coach.submit(
                    accessToken: refreshed,
                    contextMode: contextMode,
                    action: action,
                    source: source
                )
            }
        }
    }

    private func draftResponse() {
        requestCoaching(action: .respond)
    }

    private func sendFollowUp() {
        guard let token = auth.session?.accessToken else { return }
        Task {
            let unauthorized = await coach.sendFollowUp(accessToken: token, contextMode: contextMode)
            if unauthorized, let refreshed = await auth.refreshedAccessToken() {
                await coach.sendFollowUp(accessToken: refreshed, contextMode: contextMode)
            }
        }
    }

    private var followUpSuggestions: [String] {
        switch coach.selectedAction {
        case .decode:
            ["What should I say back?", "What might I be missing?", "Help me ask for clarity"]
        case .respond:
            ["Make it warmer", "Make it more direct", "What reaction should I expect?"]
        case .rewrite:
            ["Make it shorter", "Keep my boundary firm", "Make it sound more like me"]
        case .clarify, .toneCheck:
            ["Make it clearer", "What should I change?", "Help me practice this"]
        }
    }

    private func apply(_ pending: MobileCoachHandoff) {
        if let mode = pending.contextMode { contextMode = mode }
        coach.apply(pending)
        handoff.finish(pending.id)
        if pending.submitImmediately == true {
            requestCoaching(action: pending.action, source: pending.source ?? "app_intent")
        }
    }

    private func practiceConversation() {
        onPractice(PracticePrefill(
            originalMessage: coach.text,
            person: coach.person,
            goal: coach.goal,
            conversationContext: practiceContext
        ))
    }

    private var practiceContext: String {
        let followUps = coach.followUpMessages.map { message in
            "\(message.role == .user ? "You" : "Beckett"): \(message.content)"
        }.joined(separator: "\n")
        return [coach.conversationContext, followUps]
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .joined(separator: "\n\n")
    }
}

private extension MobileCoachAction {
    var inputPlaceholder: String {
        "Paste message here"
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
    let contextMode: MobileContextMode
    let isLoading: Bool
    let onStartOver: () -> Void
    let onDraftResponse: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 7) {
                    Text("BECKETT’S READ")
                        .font(.caption.weight(.bold))
                        .tracking(0.8)
                        .foregroundStyle(BeckettColor.primaryDark)
                    Text("\(contextMode.title) lens")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(BeckettColor.primaryDark)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(BeckettColor.primaryLight, in: Capsule())
                }
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
            case let .interpretation(result):
                InterpretationResultView(result: result)
                DecodeNextActions(
                    isLoading: isLoading,
                    onDraftResponse: onDraftResponse
                )
            case let .draftOptions(result):
                if let feedback = result.originalFeedback {
                    RewriteFeedbackView(feedback: feedback)
                }
                DraftOptionsResultView(result: result)
            case let .toneFeedback(result): ToneFeedbackResultView(result: result)
            }

            Label("Message and result were not saved", systemImage: "lock")
                .font(.footnote)
                .foregroundStyle(BeckettColor.inkLight)
        }
    }
}

private struct PracticeResultButton: View {
    let onPractice: () -> Void

    var body: some View {
        Button(action: onPractice) {
            Label("Practice conversation", systemImage: "person.2.wave.2")
        }
        .buttonStyle(BeckettPrimaryButtonStyle())
    }
}

private struct DecodeNextActions: View {
    let isLoading: Bool
    let onDraftResponse: () -> Void

    var body: some View {
        Button(action: onDraftResponse) {
            HStack {
                if isLoading { ProgressView().tint(.white) }
                Label("Draft response", systemImage: "arrowshape.turn.up.left")
            }
        }
        .buttonStyle(BeckettPrimaryButtonStyle())
        .disabled(isLoading)
    }
}

private struct InboxFollowUpView: View {
    let messages: [InboxMessage]
    @Binding var draft: String
    let suggestions: [String]
    let isLoading: Bool
    let onSend: () -> Void

    var body: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Keep talking with Beckett")
                        .font(.system(size: 23, weight: .regular, design: .serif))
                    Text("Ask a follow-up without starting over or repeating the context.")
                        .font(.subheadline)
                        .foregroundStyle(BeckettColor.inkMid)
                }

                if messages.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(suggestions, id: \.self) { suggestion in
                                Button(suggestion) { draft = suggestion }
                                    .buttonStyle(.bordered)
                                    .buttonBorderShape(.capsule)
                                    .tint(BeckettColor.primaryDark)
                            }
                        }
                    }
                } else {
                    ForEach(messages) { message in
                        InboxMessageBubble(message: message)
                    }
                }

                HStack(alignment: .bottom, spacing: 10) {
                    TextField("Ask a follow-up…", text: $draft, axis: .vertical)
                        .lineLimit(1...5)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(BeckettColor.background, in: RoundedRectangle(cornerRadius: 16))
                    Button(action: onSend) {
                        if isLoading {
                            ProgressView().tint(.white)
                        } else {
                            Image(systemName: "arrow.up")
                                .font(.headline)
                        }
                    }
                    .frame(width: 42, height: 42)
                    .background(BeckettColor.primary, in: Circle())
                    .foregroundStyle(.white)
                    .buttonStyle(.plain)
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
                    .accessibilityLabel(isLoading ? "Beckett is responding" : "Send follow-up")
                }

                Label("This conversation is not saved to your Beckett history.", systemImage: "lock")
                    .font(.caption)
                    .foregroundStyle(BeckettColor.inkLight)
            }
        }
    }
}

private struct InboxMessageBubble: View {
    let message: InboxMessage

    var body: some View {
        HStack {
            if message.role == .user { Spacer(minLength: 34) }
            VStack(alignment: .leading, spacing: 4) {
                Text(message.role == .user ? "You" : "Beckett")
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(message.role == .user ? Color.white.opacity(0.8) : BeckettColor.inkLight)
                Text(message.content)
                    .textSelection(.enabled)
            }
            .padding(12)
            .background(
                message.role == .user ? BeckettColor.primary : BeckettColor.primaryLight,
                in: RoundedRectangle(cornerRadius: 15, style: .continuous)
            )
            .foregroundStyle(message.role == .user ? Color.white : BeckettColor.ink)
            if message.role == .assistant { Spacer(minLength: 34) }
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
                    ForEach(Array(result.possibleReadings.prefix(3))) { reading in
                        VStack(alignment: .leading, spacing: 5) {
                            HStack {
                                Text(reading.label).bold()
                                Spacer()
                                Text(reading.evidenceStrengthLabel)
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

private struct RewriteFeedbackView: View {
    let feedback: DraftOptionsResult.OriginalFeedback

    var body: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("Feedback on your original message")
                    .font(.system(size: 22, weight: .regular, design: .serif))
                feedbackRow(title: "Tone", value: feedback.tone)
                Divider()
                feedbackRow(title: "Clarity", value: feedback.clarity)
                ResultList(title: "What works", values: feedback.strengths)
                ResultList(title: "Worth noticing", values: feedback.watchFor)
            }
        }
    }

    private func feedbackRow(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(value)
                .foregroundStyle(BeckettColor.inkMid)
        }
    }
}

private struct DraftOptionCard: View {
    let option: DraftOptionsResult.Option

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
                Text(option.text)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                    .accessibilityLabel("\(option.label) draft")
                ResultActions(text: option.text)
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
