# Beckett for iOS

Native SwiftUI client for Beckett's versioned mobile API.

## Targets

- `BeckettApp`: the main iPhone application.
- `BeckettShare`: the focused Share Extension foundation.
- `BeckettTests`: contract and design-system tests.

The app intentionally keeps AI prompts, provider credentials, safety logic, and
metering on the Beckett server. It stores only the short-lived Beckett session
in a shared Keychain access group. Raw coaching content and generated results
are transient in mobile v1 and are not added to Beckett history.

The Share Extension accepts selected text or up to five images/screenshots. It
uses Apple's Vision framework for on-device OCR, lets the user narrow the text
before sending it, and can show a compact coaching result without leaving the
source app. “Save for Beckett” writes a file-protected handoff into the shared
App Group. iOS does not allow Share Extensions to launch their containing app,
so Beckett routes the saved request into Inbox the next time the app becomes
active. The app deletes the handoff as soon as it consumes it, and unconsumed
handoffs expire after 15 minutes.

Beckett also publishes Decode, Respond, and Rewrite App Shortcuts. They can be
run from Siri, Spotlight, the Shortcuts app, or assigned to the iPhone Action
button. Each shortcut accepts text from a previous shortcut action or prompts
for a message, then opens Beckett and runs coaching with a configurable
Professional or Personal lens. Shortcut handoffs use the same file-protected,
15-minute App Group storage as the Share Extension.

The Inbox keeps follow-up coaching conversational after Decode, Respond, or
Rewrite. Its thread exists only in app memory and is sent back with each
follow-up so Beckett can retain context; the API does not save the conversation
to Beckett history. Every thread can hand its scenario directly into Practice.

## Local setup

1. Open `Beckett.xcodeproj` in Xcode 16 or newer.
2. Set the development team for the app and extension targets.
3. Change `BECKETT_API_BASE_URL` in `Configuration/Debug.xcconfig` when using a
   local or staging backend.
4. Ensure the associated Supabase project has Apple auth enabled before testing
   Sign in with Apple.

Full Xcode is required for simulator and device builds. The repository machine
may have only the Apple command-line tools selected, in which case
`xcodebuild` cannot run iOS targets.
