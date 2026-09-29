# Security

Report vulnerabilities privately: **Security → Report a vulnerability** on this repository. Do not open a public issue.

Expect a reply within 7 days.

Scope: the extension code in this repository. The extension sends requests only to `graph.facebook.com` and stores nothing beyond the browser session (plus the language and Graph API version in `chrome.storage.local`, and the last open tab and spend period in the popup's `localStorage`). Anything that breaks that is a vulnerability.
