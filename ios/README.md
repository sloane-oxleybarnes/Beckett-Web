# Beckett for iOS

Native SwiftUI client for Beckett's versioned mobile API.

## Targets

- `BeckettApp`: the main iPhone application.
- `BeckettShare`: the focused Share Extension foundation.
- `BeckettTests`: contract and design-system tests.

The app intentionally keeps AI prompts, provider credentials, safety logic, and
metering on the Beckett server. It stores only the short-lived Beckett session
in a shared Keychain access group. Raw coaching content is transient unless the
user explicitly saves an individual result in a future release.

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
