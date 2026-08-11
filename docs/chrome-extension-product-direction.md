# Chrome extension product direction

## Decision to make

The native Slack app owns coaching inside Slack. The Chrome extension is limited to Gmail while the native Gmail experience matures.

## Immediate policy

- Freeze new Slack feature development in the Chrome extension.
- Continue only critical security, compatibility, and migration fixes while the native apps reach public availability.
- Do not broaden host permissions or add automatic page analysis.
- Keep existing users informed before removing any working feature.

## Evidence window

During Gmail Marketplace review, measure:

- Weekly active Chrome extension users.
- Gmail versus any non-native use.
- Analyses, reply drafts, meeting briefs, and debriefs initiated from Chrome.
- Users who also use a native app.
- Support burden caused by Gmail DOM changes.
- Requests for coaching in LinkedIn, Jira, Confluence, Teams web, support tools, or internal tools.

Use metadata-only product events. Do not record page contents, message contents, or browsing history for this decision.

## Preferred future: Beckett for the Web

If evidence shows meaningful cross-web demand, version 4 should have one narrow purpose:

> User-invoked coaching for selected workplace communication on websites without a native Beckett integration.

Product boundaries:

- The user selects text or invokes Beckett on the active tab.
- Beckett opens in the side panel and offers analysis, rewrite, or a reply draft.
- No automatic background analysis.
- No Slack content scripts or Slack host permissions.
- No mailbox, workspace, or browsing-history access.
- Prefer `activeTab`, `scripting`, `storage`, `sidePanel`, and identity permissions; remove `tabs` or host permissions unless a tested feature proves they are necessary.
- Copying/inserting a result remains an explicit user action.

Potential supported surfaces include LinkedIn messages, Jira, Confluence, customer-support tools, Teams web, community platforms, and internal company tools.

## Retirement alternative

If the evidence does not support a browser-wide product:

1. Announce deprecation inside the extension and on Beckett's integrations page.
2. Link Slack users to the native Slack installation path while the Gmail extension remains functional.
3. Stop accepting new Chrome installs after the migration window.
4. Maintain a security-only period.
5. Unpublish the extension after active use reaches the agreed threshold.

Do not convert the extension into a link-only launcher; Chrome Web Store policy requires real extension functionality.

## Decision gate

Make the v4-versus-retire decision after the Gmail Marketplace review period, using usage evidence plus 5–10 interviews with active extension users. Until then, the extension is maintained but strategically frozen.
