import AppIntents
import Foundation

enum BeckettShortcutContext: String, AppEnum {
    case professional
    case personal

    static let typeDisplayRepresentation = TypeDisplayRepresentation(name: "Conversation Context")
    static let caseDisplayRepresentations: [Self: DisplayRepresentation] = [
        .professional: "Professional",
        .personal: "Personal",
    ]

    var mobileContextMode: MobileContextMode {
        switch self {
        case .professional: .professional
        case .personal: .personal
        }
    }
}

struct DecodeWithBeckettIntent: AppIntent {
    static let title: LocalizedStringResource = "Decode with Beckett"
    static let description = IntentDescription("Understand what a message may mean and how it may be landing.")
    static var openAppWhenRun: Bool { true }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }

    @Parameter(
        title: "Message",
        description: "The message you want Beckett to decode.",
        requestValueDialog: "What message would you like Beckett to decode?",
        inputConnectionBehavior: .connectToPreviousIntentResult
    )
    var message: String

    @Parameter(title: "Context", default: .professional)
    var context: BeckettShortcutContext

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try prepareBeckettHandoff(message: message, action: .decode, context: context)
        return .result(dialog: "Opening Beckett to decode the message.")
    }
}

struct RespondWithBeckettIntent: AppIntent {
    static let title: LocalizedStringResource = "Respond with Beckett"
    static let description = IntentDescription("Create concise response options for a message.")
    static var openAppWhenRun: Bool { true }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }

    @Parameter(
        title: "Message",
        description: "The message you want to respond to.",
        requestValueDialog: "What message would you like help responding to?",
        inputConnectionBehavior: .connectToPreviousIntentResult
    )
    var message: String

    @Parameter(title: "Context", default: .professional)
    var context: BeckettShortcutContext

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try prepareBeckettHandoff(message: message, action: .respond, context: context)
        return .result(dialog: "Opening Beckett with response options.")
    }
}

struct RewriteWithBeckettIntent: AppIntent {
    static let title: LocalizedStringResource = "Rewrite with Beckett"
    static let description = IntentDescription("Get feedback and clearer alternatives for a draft message.")
    static var openAppWhenRun: Bool { true }
    static var authenticationPolicy: IntentAuthenticationPolicy { .requiresAuthentication }

    @Parameter(
        title: "Draft",
        description: "The draft message you want Beckett to rewrite.",
        requestValueDialog: "What draft would you like Beckett to rewrite?",
        inputConnectionBehavior: .connectToPreviousIntentResult
    )
    var message: String

    @Parameter(title: "Context", default: .professional)
    var context: BeckettShortcutContext

    func perform() async throws -> some IntentResult & ProvidesDialog {
        try prepareBeckettHandoff(message: message, action: .rewrite, context: context)
        return .result(dialog: "Opening Beckett to rewrite the draft.")
    }
}

struct BeckettShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: DecodeWithBeckettIntent(),
            phrases: [
                "Decode a message with \(.applicationName)",
                "Ask \(.applicationName) to decode a message",
            ],
            shortTitle: "Decode Message",
            systemImageName: "text.magnifyingglass"
        )
        AppShortcut(
            intent: RespondWithBeckettIntent(),
            phrases: [
                "Respond with \(.applicationName)",
                "Draft a response with \(.applicationName)",
            ],
            shortTitle: "Draft Response",
            systemImageName: "bubble.left.and.bubble.right"
        )
        AppShortcut(
            intent: RewriteWithBeckettIntent(),
            phrases: [
                "Rewrite with \(.applicationName)",
                "Improve my message with \(.applicationName)",
            ],
            shortTitle: "Rewrite Message",
            systemImageName: "pencil.line"
        )
    }

    static var shortcutTileColor: ShortcutTileColor { .orange }
}

private func prepareBeckettHandoff(
    message: String,
    action: MobileCoachAction,
    context: BeckettShortcutContext
) throws {
    let trimmed = message.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { throw BeckettShortcutError.emptyMessage }
    let handoff = MobileCoachHandoff(
        action: action,
        text: String(trimmed.prefix(12_000)),
        contextMode: context.mobileContextMode,
        submitImmediately: true,
        source: "app_intent"
    )
    try MobileCoachHandoffStore.save(handoff)
}

private enum BeckettShortcutError: Error, CustomLocalizedStringResourceConvertible {
    case emptyMessage

    var localizedStringResource: LocalizedStringResource {
        "Add a message before asking Beckett for help."
    }
}
