# macOS Glass UI redesign

## Goal

Replace the existing dense dark popup with a macOS-inspired glass control
surface while preserving the extension's current MV3 permissions, actions,
and keepalive scope.

## Scope

- Keep the current enable toggle, manual run, smart interval, fixed interval,
  status, diagnostics, and matched-tab actions.
- Rebuild the popup markup and CSS around a compact, glass-effect hierarchy.
- Simplify popup state rendering and prevent overlapping popup commands from
  presenting stale status.
- Update focused tests, version metadata, changelog, README release references,
  release ZIP, and GitHub release.

## UI

The popup uses a light macOS-inspired background with layered translucent
cards, backdrop blur, soft blue-green highlights, and restrained shadows.

1. **Status hero** — health dot, current state, short summary, and the primary
   enable switch.
2. **Controls** — a single `Run now` primary action and a segmented interval
   selector (`Smart`, `5`, `15`, `30 min`). Selecting a fixed option disables
   smart timing; selecting Smart restores the saved smart setting.
3. **Overview** — matched pages, last run, and last result in compact cards.
4. **Details** — diagnostics and matched tabs are collapsible sections, closed
   by default so the operational controls remain visible at a glance.

The popup retains screen-reader announcements, keyboard-visible focus states,
and a reduced-motion mode. The background blur has an opaque fallback for
browsers that do not support `backdrop-filter`.

## Logic

- Extract popup presentation into small pure helpers for status labels,
  intervals, and rendering decisions.
- Serialize user-initiated popup commands. A control is disabled while a
  command is pending, preventing rapid toggles or manual runs from causing
  stale UI state.
- Refresh settings and matched tabs only after the active command completes;
  status messages therefore represent the latest saved background state.
- Preserve the current background scheduling and keepalive behavior unless a
  focused test exposes a directly related defect.

## Verification

- Add tests for the new pure popup helpers and any corrected scheduling logic.
- Confirm each new test fails before its implementation and then passes.
- Run the existing Node test suite, syntax checks for all modified JavaScript,
  `python3 -m json.tool manifest.json`, and `git diff --check`.
- Package the release without development files, inspect the ZIP manifest and
  list, then publish a new semantic patch release with notes and the ZIP asset.

## Non-goals

- No new browser permissions, host permissions, site automation, telemetry,
  account handling, or settings page.
- No change to the supported Shawnigan URL pattern or the background keepalive
  request contract.
