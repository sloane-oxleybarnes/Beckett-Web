import SwiftUI
import UIKit

struct CoachView: View {
    @EnvironmentObject private var auth: AuthStore
    @StateObject private var coach = CoachStore()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    if let response = coach.response {
                        CoachResultView(response: response, onStartOver: coach.startOver)
                    } else {
                        composeView
                    }
                }
                .padding(20)
            }
            .navigationTitle("Coach")
            .beckettPage()
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
                            coach.selectedAction == action ? BeckettColor.primaryLight : .white,
                            in: RoundedRectangle(cornerRadius: 14, style: .continuous)
                        )
                        .overlay {
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(coach.selectedAction == action ? BeckettColor.primary : BeckettColor.ink.opacity(0.08))
                        }
                    }
                    .buttonStyle(.plain)
                }
            }

            BeckettCard {
                VStack(alignment: .leading, spacing: 10) {
                    Text(coach.selectedAction == .respond || coach.selectedAction == .decode
                         ? "Paste the message"
                         : "Paste your draft")
                        .font(.headline)
                    TextEditor(text: $coach.text)
                        .frame(minHeight: 150)
                        .scrollContentBackground(.hidden)
                        .accessibilityLabel("Message or draft")
                    Divider()
                    TextField("Person or relationship (optional)", text: $coach.person)
                    TextField("What do you want to happen? (optional)", text: $coach.goal, axis: .vertical)
                }
            }

            Button {
                guard let token = auth.session?.accessToken else { return }
                Task { await coach.submit(accessToken: token) }
            } label: {
                if coach.isLoading {
                    ProgressView().tint(.white)
                } else {
                    Text("Ask Beckett")
                }
            }
            .buttonStyle(BeckettPrimaryButtonStyle())
            .disabled(coach.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || coach.isLoading)

            if let message = coach.errorMessage {
                Text(message).font(.footnote).foregroundStyle(.red)
            }

            Label("Beckett will not send or save this message.", systemImage: "lock")
                .font(.footnote)
                .foregroundStyle(BeckettColor.inkLight)
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
                Button("Start over", action: onStartOver)
                    .font(.subheadline)
            }

            switch response.result {
            case let .interpretation(result): InterpretationResultView(result: result)
            case let .draftOptions(result): DraftOptionsResultView(result: result)
            case let .toneFeedback(result): ToneFeedbackResultView(result: result)
            }

            Label(
                response.retention.contentSaved ? "Saved to your Beckett history" : "Message content was not saved",
                systemImage: response.retention.contentSaved ? "checkmark.shield" : "lock"
            )
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
}

private struct DraftOptionsResultView: View {
    let result: DraftOptionsResult

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(result.contextSummary).foregroundStyle(BeckettColor.inkMid)
            ForEach(result.options) { option in
                BeckettCard {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(option.label).font(.headline)
                        Text(option.text).textSelection(.enabled)
                        Text(option.rationale)
                            .font(.footnote)
                            .foregroundStyle(BeckettColor.inkMid)
                        Button {
                            UIPasteboard.general.string = option.text
                        } label: {
                            Label("Copy", systemImage: "doc.on.doc")
                        }
                    }
                }
            }
            if let uncertainty = result.uncertaintyNote {
                Label(uncertainty, systemImage: "questionmark.circle")
                    .font(.footnote)
                    .foregroundStyle(BeckettColor.inkMid)
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
                        Button {
                            UIPasteboard.general.string = revision.text
                        } label: {
                            Label("Copy revision", systemImage: "doc.on.doc")
                        }
                    }
                }
            }
        }
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
