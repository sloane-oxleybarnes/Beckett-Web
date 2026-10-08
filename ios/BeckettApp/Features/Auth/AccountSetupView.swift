import SwiftUI

struct AccountSetupView: View {
    @EnvironmentObject private var auth: AuthStore

    @State private var step = 0
    @State private var firstName = ""
    @State private var lastName = ""
    @State private var displayName = ""
    @State private var adultEligibilityConfirmed = false
    @State private var termsAndPrivacyConfirmed = false
    @State private var coachingDisclaimerConfirmed = false
    @State private var strengthRatings: [String: String] = [:]
    @State private var effortRatings: [String: String] = [:]
    @State private var priorityRatings: [String: String] = [:]
    @State private var styleRatings: [String: String] = [:]
    @State private var context: Set<String> = []
    @State private var contextOther = ""

    private let stepTitles = ["Agreements", "Name", "Strengths", "Effort", "Coaching", "Context"]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                        .id("setup-top")
                    stepContent

                    if let message = auth.errorMessage {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.red)
                            .accessibilityLabel("Setup error: \(message)")
                    }

                    HStack(spacing: 12) {
                        if step > 0 {
                            Button("Back") { step -= 1 }
                                .buttonStyle(.bordered)
                                .disabled(auth.isWorking)
                        }
                        Button(step == stepTitles.count - 1 ? "Finish setup" : "Continue") {
                            if step == stepTitles.count - 1 {
                                Task { await finish() }
                            } else {
                                step += 1
                            }
                        }
                        .buttonStyle(BeckettPrimaryButtonStyle())
                        .disabled(!canContinue || auth.isWorking)
                    }

                    if auth.isWorking {
                        HStack(spacing: 8) {
                            ProgressView()
                            Text("Saving your setup…").font(.footnote)
                        }
                    }

                    Button("Sign out", role: .cancel) { auth.signOut() }
                        .frame(maxWidth: .infinity)
                        .disabled(auth.isWorking)
                }
                .padding(24)
            }
            .onChange(of: step) { _, _ in
                withAnimation(.easeOut(duration: 0.25)) {
                    proxy.scrollTo("setup-top", anchor: .top)
                }
            }
        }
        .beckettPage()
        .interactiveDismissDisabled(auth.isWorking)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: "person.crop.circle.badge.checkmark")
                .font(.system(size: 38))
                .foregroundStyle(BeckettColor.primary)
            Text("Set up your Beckett coach")
                .font(.system(size: 34, weight: .regular, design: .serif))
            Text("Step \(step + 1) of \(stepTitles.count) · \(stepTitles[step])")
                .font(.subheadline.bold())
                .foregroundStyle(BeckettColor.primaryDark)
            ProgressView(value: Double(step + 1), total: Double(stepTitles.count))
                .tint(BeckettColor.primary)
        }
    }

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 0: agreementsStep
        case 1: nameStep
        case 2:
            ratingsStep(
                title: "What are your communication strengths?",
                explanation: "Rate how true each statement usually feels. Not sure is always okay.",
                questions: MobileOnboardingOptions.strengths,
                choices: MobileOnboardingOptions.strengthChoices,
                ratings: $strengthRatings
            )
        case 3:
            ratingsStep(
                title: "What makes work communication harder?",
                explanation: "Rate how much extra effort each situation usually creates.",
                questions: MobileOnboardingOptions.effort,
                choices: MobileOnboardingOptions.effortChoices,
                ratings: $effortRatings
            )
        case 4: coachingStep
        default: contextStep
        }
    }

    private var agreementsStep: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 16) {
                Text("Before we begin").font(.title2.bold())
                Text("Beckett’s beta is currently available to adults in the United States.")
                    .foregroundStyle(BeckettColor.inkMid)
                Toggle("I confirm that I am at least 18 and currently located in the United States.", isOn: $adultEligibilityConfirmed)
                VStack(alignment: .leading, spacing: 6) {
                    Toggle("I agree to the Terms of Use and acknowledge the Privacy Policy.", isOn: $termsAndPrivacyConfirmed)
                    HStack {
                        Link("Terms", destination: URL(string: "https://meetbeckett.co/terms")!)
                        Text("·")
                        Link("Privacy", destination: URL(string: "https://meetbeckett.co/privacy")!)
                    }
                    .font(.footnote)
                }
                Toggle("I understand that Beckett provides communication coaching, not medical, mental-health, legal, or employment advice.", isOn: $coachingDisclaimerConfirmed)
            }
            .tint(BeckettColor.primary)
        }
    }

    private var nameStep: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("What should Beckett call you?").font(.title2.bold())
                Text("These details personalize your coaching and are not shown publicly.")
                    .foregroundStyle(BeckettColor.inkMid)
                TextField("First name", text: $firstName)
                    .textContentType(.givenName)
                    .textFieldStyle(.roundedBorder)
                    .onChange(of: firstName) { _, value in
                        if displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                            displayName = value
                        }
                    }
                TextField("Last name", text: $lastName)
                    .textContentType(.familyName)
                    .textFieldStyle(.roundedBorder)
                TextField("What Beckett should call you", text: $displayName)
                    .textContentType(.nickname)
                    .textFieldStyle(.roundedBorder)
            }
        }
    }

    private func ratingsStep(
        title: String,
        explanation: String,
        questions: [String],
        choices: [RatingChoice],
        ratings: Binding<[String: String]>
    ) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(title).font(.title2.bold())
            Text(explanation).foregroundStyle(BeckettColor.inkMid)
            ForEach(questions, id: \.self) { question in
                RatingPicker(question: question, choices: choices, ratings: ratings)
            }
            Text("\(ratings.wrappedValue.count) of \(questions.count) rated")
                .font(.footnote)
                .foregroundStyle(BeckettColor.inkLight)
        }
    }

    private var coachingStep: some View {
        VStack(alignment: .leading, spacing: 20) {
            ratingsStep(
                title: "How should Beckett coach you?",
                explanation: "First, rate how useful each kind of support would be.",
                questions: MobileOnboardingOptions.priorities,
                choices: MobileOnboardingOptions.priorityChoices,
                ratings: $priorityRatings
            )
            ratingsStep(
                title: "Coaching style",
                explanation: "Choose how much of each quality you want Beckett to use.",
                questions: MobileOnboardingOptions.styleQuestions.map { $0.label },
                choices: MobileOnboardingOptions.styleChoices,
                ratings: Binding(
                    get: {
                        Dictionary(uniqueKeysWithValues: MobileOnboardingOptions.styleQuestions.compactMap { item in
                            styleRatings[item.id].map { (item.label, $0) }
                        })
                    },
                    set: { displayRatings in
                        styleRatings = Dictionary(uniqueKeysWithValues: MobileOnboardingOptions.styleQuestions.compactMap { item in
                            displayRatings[item.label].map { (item.id, $0) }
                        })
                    }
                )
            )
        }
    }

    private var contextStep: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 14) {
                Text("Optional context").font(.title2.bold())
                Text("Is there any neurodivergent context you want Beckett to consider? You can skip this step.")
                    .foregroundStyle(BeckettColor.inkMid)
                ForEach(MobileOnboardingOptions.context, id: \.self) { option in
                    Toggle(option, isOn: Binding(
                        get: { context.contains(option) },
                        set: { selected in
                            if selected { context.insert(option) } else { context.remove(option) }
                        }
                    ))
                    .tint(BeckettColor.primary)
                }
                TextField("Anything else (optional)", text: $contextOther, axis: .vertical)
                    .lineLimit(2...4)
                    .textFieldStyle(.roundedBorder)
            }
        }
    }

    private var canContinue: Bool {
        switch step {
        case 0:
            adultEligibilityConfirmed && termsAndPrivacyConfirmed && coachingDisclaimerConfirmed
        case 1:
            !firstName.trimmed.isEmpty && !lastName.trimmed.isEmpty && !displayName.trimmed.isEmpty
        case 2:
            MobileOnboardingOptions.strengths.allSatisfy { strengthRatings[$0] != nil }
        case 3:
            MobileOnboardingOptions.effort.allSatisfy { effortRatings[$0] != nil }
        case 4:
            MobileOnboardingOptions.priorities.allSatisfy { priorityRatings[$0] != nil }
                && MobileOnboardingOptions.styleQuestions.allSatisfy { styleRatings[$0.id] != nil }
        default:
            true
        }
    }

    private func finish() async {
        await auth.completeOnboarding(MobileOnboardingSubmission(
            firstName: firstName.trimmed,
            lastName: lastName.trimmed,
            displayName: displayName.trimmed,
            communicationStrengthRatings: strengthRatings,
            workplaceEffortRatings: effortRatings,
            coachingPriorityRatings: priorityRatings,
            coachingStyleRatings: styleRatings,
            neurodivergentContext: context.sorted(),
            neurodivergentContextOther: contextOther.trimmed.isEmpty ? nil : contextOther.trimmed,
            adultUsEligibilityConfirmed: adultEligibilityConfirmed,
            termsAccepted: termsAndPrivacyConfirmed,
            privacyAcknowledged: termsAndPrivacyConfirmed,
            coachingDisclaimerAcknowledged: coachingDisclaimerConfirmed
        ))
    }
}

private struct RatingPicker: View {
    let question: String
    let choices: [RatingChoice]
    @Binding var ratings: [String: String]

    var body: some View {
        BeckettCard {
            VStack(alignment: .leading, spacing: 10) {
                Text(question).font(.subheadline.bold())
                Picker("Rating for \(question)", selection: Binding(
                    get: { ratings[question] ?? "" },
                    set: { ratings[question] = $0 }
                )) {
                    Text("Choose a rating").tag("")
                    ForEach(choices) { choice in
                        Text(choice.label).tag(choice.value)
                    }
                }
                .pickerStyle(.menu)
                .tint(BeckettColor.primaryDark)
            }
        }
    }
}

private struct RatingChoice: Identifiable {
    let value: String
    let label: String
    var id: String { value }
}

private enum MobileOnboardingOptions {
    static let strengths = [
        "I am direct and honest", "I am a good listener", "I think before I speak",
        "I notice patterns others miss", "I am deeply empathetic",
        "I am creative in how I express myself", "I am loyal and consistent",
        "I bring focus and intensity when I care",
    ]
    static let effort = [
        "Vague or unclear feedback", "Feeling interrupted or talked over",
        "Unexpected changes to plans", "Passive aggression or indirect communication",
        "Feeling like I am being criticized", "Conflict or raised voices",
        "Not knowing what is expected of me", "Feeling like I have to mask or perform",
        "Slack messages that feel urgent or ambiguous", "Long email threads with unclear ownership",
    ]
    static let priorities = [
        "Being more direct", "Advocating for my needs", "Understanding the social context",
        "Understanding what to do next", "Being warmer in my responses", "Being more concise",
    ]
    static let styleQuestions = [
        (id: "directness", label: "Directness"),
        (id: "emotional_reassurance", label: "Emotional reassurance"),
        (id: "social_context_explanation", label: "Explanation of social context"),
        (id: "action_focused_next_steps", label: "Action-focused next steps"),
        (id: "concise_wording", label: "Concise wording"),
    ]
    static let context = [
        "ADHD", "Autism", "Dyslexia", "Sensory processing differences",
        "Social processing differences", "Anxiety affects my communication", "Something else",
    ]
    static let strengthChoices = choices([
        ("not_usually", "Not usually"), ("sometimes", "Sometimes"), ("often", "Often"),
        ("core_strength", "A core strength"), ("unsure", "Not sure yet"),
    ])
    static let effortChoices = choices([
        ("little_or_none", "Little or none"), ("some", "Some"), ("moderate", "Moderate"),
        ("a_lot", "A lot"), ("unsure", "Not sure yet"),
    ])
    static let priorityChoices = choices([
        ("not_priority", "Not a priority"), ("occasionally_useful", "Occasionally useful"),
        ("important", "Important"), ("top_priority", "A top priority"), ("unsure", "Not sure yet"),
    ])
    static let styleChoices = choices([
        ("less", "Less"), ("a_little", "A little"), ("moderate", "A moderate amount"),
        ("more", "More"), ("unsure", "Not sure yet"),
    ])

    private static func choices(_ values: [(String, String)]) -> [RatingChoice] {
        values.map { RatingChoice(value: $0.0, label: $0.1) }
    }
}

private extension String {
    var trimmed: String { trimmingCharacters(in: .whitespacesAndNewlines) }
}
