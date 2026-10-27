# Curriculum navigation — 20 October 2026

Local, uncommitted, free-only. No commit/push/PR/deployment or production data change.

The public ecosystem adapter now mounts canonical `mount(target, 'curriculum', 'Curriculum')` in the header, with eight Spaces, All services, language/theme and an icon palette control. Legacy duplicate launcher/text selectors were removed. Relevant static pages load the generated navigation JS/CSS; favicon now uses the flat Site source. Curriculum data files, KBM/calendar content and admin Auth logic were not edited by this session.

Canonical source and detailed evidence: `C:/Users/T6N0CV02S35823C/Github/irsyads/docs/Project Web Irsyads/2026-10-20_CBT_NAVIGATION_ID_HANDOFF.md`. Re-export from monorepo with `node scripts/export-s3-navigation.mjs curriculum`; do not hand-edit generated copies.

Browser inspected header/panel in light/dark at 1366/390 on a static local preview with external network blocked. Calendar and KBM views render; the admin entry still renders. End-to-end admin login remains pending and was not tested against production. Existing Curriculum Auth regressions passed within the 74-test monorepo run. `node --check assets/ecosystem.js` and diff check passed. Earlier unrelated local changes remain intact. No release permission inferred.
