# Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-04-30

### Added

- Compact dark utility popup design with a live hero status badge and clearer matched-page summary.
- Helper coverage for detecting sign-in and authentication redirect URLs during keepalive checks.

### Changed

- Reworked popup visual hierarchy, spacing, cards, controls, and matched-page list styling for a cleaner dashboard feel.
- Updated the popup hero copy to summarize live, paused, running, empty, and attention-needed states.
- Treat keepalive responses that resolve to sign-in or authentication URLs as attention-needed instead of successful checks.

## [1.1.0] - 2026-03-27

### Added

- Per-tab popup actions to jump directly to a matched Shawnigan tab or run a keepalive check for one selected tab.
- Shared helper coverage for normalization, tab ordering, badge state, and detail rendering logic.

### Changed

- Reworked keepalive execution to serialize overlapping runs, limit concurrent tab pings, and preserve cleaner last-run state.
- Upgraded badge behavior to reflect running, paused, healthy, and attention-needed states instead of only showing matched counts.
- Expanded popup accessibility with keyboard-focusable controls, live status announcements, disabled/loading states, and richer per-tab health badges.
- Introduced a shared helper module for settings normalization, badge rendering, and tab status annotations.

## [1.0.0] - 2026-03-20

### Added

- Initial public release of the Shawnigan Keepalive Chrome extension.
- Popup controls for enable/disable, refresh interval, and manual keepalive runs.
- Live status, matched tab list, and last-run diagnostics.
- Badge updates for matched Shawnigan tabs.
- Project documentation, copyright notice, and repository metadata.

### Changed

- Improved keepalive safety by targeting a stable Shawnigan URL instead of replaying arbitrary page URLs.
- Reduced popup and badge refresh overhead to lower resource usage.
- Added clearer diagnostics for failed keepalive runs.
