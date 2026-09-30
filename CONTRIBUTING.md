# Contributing

- Bugs and ideas: open an issue. Questions: Discussions.
- Pull requests: one change per PR, plain JS/CSS, no build step, no new dependencies.
- The extension stays read-only. PRs that create or change anything in Facebook are declined.
- Every UI string goes through `fb-helper/js/i18n.js` in both `ru` and `en`.
- Keep the version at what `fb-helper/manifest.json` says; maintainers bump it.
- Run `node --test test/*.test.mjs` before a PR; UI or Graph-flow changes also get a case in `test/e2e.mjs` (see README → Tests).
