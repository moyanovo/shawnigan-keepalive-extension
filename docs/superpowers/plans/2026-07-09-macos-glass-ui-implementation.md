# macOS Glass UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** Deliver a macOS glass-effect popup that presents existing keepalive controls and status more clearly, then publish it as v1.4.0.

**Architecture:** Move deterministic popup presentation choices into a small ES module that Node tests can import. Keep Chrome messaging and DOM ownership in \`popup.js\`; rebuild the popup HTML/CSS around a glass hero, segmented interval controls, compact metrics, and collapsed diagnostics/page lists.

**Tech Stack:** Chrome Manifest V3, browser ES modules, vanilla HTML/CSS/JavaScript, Node built-in test runner, GitHub CLI.

## Global Constraints

- Preserve manifest permissions, host permissions, keepalive request contract, and supported Shawnigan URL pattern.
- Add no dependencies, telemetry, account handling, settings page, or website automation.
- Use a light macOS-style translucent UI with an opaque fallback, visible keyboard focus, screen-reader announcements, and reduced-motion support.
- Publish this user-visible redesign as version \`1.4.0\` and tag \`v1.4.0\`.

---

### Task 1: Testable popup presentation helpers

**Files:**
- Create: \`lib/popup-presentation.mjs\`
- Create: \`tests/popup-presentation.test.mjs\`

**Interfaces:**
- Consumes: popup status objects returned by \`background.js:getStatus()\`.
- Produces: \`getHeroPresentation(status)\`, \`getIntervalSelection(status)\`, and \`getStatusTone(status)\` for \`popup.js\`.

- [ ] **Step 1: Write the failing test**

\`\`\`js
test('presentation prioritizes running, paused, empty, warning, and healthy states', () => {
  assert.equal(getHeroPresentation({ isRunning: true, enabled: true }).label, 'Checking now')
  assert.equal(getHeroPresentation({ enabled: false }).label, 'Paused')
  assert.equal(getHeroPresentation({ enabled: true, matchedCount: 0 }).label, 'No pages open')
  assert.equal(getHeroPresentation({ enabled: true, matchedCount: 1, lastState: 'warning' }).label, 'Needs attention')
  assert.equal(getIntervalSelection({ smartIntervalEnabled: true, intervalMinutes: 15 }), 'smart')
  assert.equal(getIntervalSelection({ smartIntervalEnabled: false, intervalMinutes: 5 }), '5')
  assert.equal(getIntervalSelection({ smartIntervalEnabled: false, intervalMinutes: 12 }), 'custom')
})
\`\`\`

- [ ] **Step 2: Verify the test is red**

Run: \`node --test tests/popup-presentation.test.mjs\`  
Expected: \`ERR_MODULE_NOT_FOUND\` for \`lib/popup-presentation.mjs\`.

- [ ] **Step 3: Implement the minimum helpers**

\`\`\`js
export function getStatusTone(status = {}) {
  if (status.isRunning) return 'running'
  if (!status.enabled) return 'muted'
  if (!status.matchedCount) return 'neutral'
  return status.lastState === 'warning' || status.lastState === 'error' ? 'warning' : 'healthy'
}

export function getHeroPresentation(status = {}) {
  const tone = getStatusTone(status)
  const label = { running: 'Checking now', muted: 'Paused', neutral: 'No pages open', warning: 'Needs attention', healthy: 'Protected' }[tone]
  return { label, tone }
}

export function getIntervalSelection(status = {}) {
  if (status.smartIntervalEnabled) return 'smart'
  return ['5', '15', '30'].includes(String(status.intervalMinutes)) ? String(status.intervalMinutes) : 'custom'
}
\`\`\`

- [ ] **Step 4: Verify green and commit**

Run: \`node --test tests/popup-presentation.test.mjs tests/keepalive-core.test.mjs\`  
Expected: 10 passing tests and 0 failures.

\`\`\`bash
git add lib/popup-presentation.mjs tests/popup-presentation.test.mjs
git commit -m "Add popup presentation helpers"
\`\`\`

### Task 2: Build the macOS glass popup and serialize commands

**Files:**
- Modify: \`popup.html\`
- Modify: \`popup.css\`
- Modify: \`popup.js\`

**Interfaces:**
- Consumes: \`getHeroPresentation\`, \`getIntervalSelection\`, and \`getStatusTone\` from \`lib/popup-presentation.mjs\`.
- Consumes: existing \`get-status\`, \`save-settings\`, \`run-now\`, \`run-tab\`, and \`focus-tab\` runtime messages.
- Produces: an accessible light glass UI without changing background message payloads.

- [ ] **Step 1: Lock custom fixed-interval behavior with a test**

\`\`\`js
test('fixed intervals outside the segmented options stay custom', () => {
  assert.equal(getIntervalSelection({ smartIntervalEnabled: false, intervalMinutes: 120 }), 'custom')
})
\`\`\`

Run: \`node --test tests/popup-presentation.test.mjs\`  
Expected: PASS before DOM rendering consumes the value.

- [ ] **Step 2: Replace popup markup**

Use a hero containing \`#heroStatusBadge\`, \`#heroSummary\`, and \`#enabled\`; a
single \`#runNow\` primary action; a \`#intervalControl\` button group with
\`data-interval="smart|5|15|30"\`; and metrics retaining the IDs \`#matchCount\`,
\`#lastRun\`, and \`#lastResult\`. Place \`#detailsList\` and \`#matchList\` inside
collapsed \`<details>\` sections. Retain \`#screenReaderStatus\`. Change the
script tag to \`type="module"\`.

- [ ] **Step 3: Replace CSS with the glass system**

Use a pale blue-green page background, translucent white 20–24px cards,
\`backdrop-filter: blur(22px) saturate(140%)\`, and concise shadows. Use
\`[data-tone]\` to color the hero. Include this fallback and motion rule:

\`\`\`css
@supports not (backdrop-filter: blur(1px)) { .hero, .command-card, .metric, details { background: rgba(248, 250, 252, .96); } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: .01ms !important; } }
\`\`\`

- [ ] **Step 4: Use helpers and a command gate in \`popup.js\`**

\`\`\`js
import { getHeroPresentation, getIntervalSelection, getStatusTone } from './lib/popup-presentation.mjs'

let activeCommand = null
async function runCommand(label, task) {
  if (activeCommand) return activeCommand
  activeCommand = withBusy(label, task)
  try { return await activeCommand } finally { activeCommand = null }
}
\`\`\`

Route each toggle, interval, page action, and manual run through \`runCommand\`.
Selecting Smart sends \`{ smartIntervalEnabled: true }\`; a fixed segment sends
\`{ smartIntervalEnabled: false, intervalMinutes: Number(value) }\`. In
\`renderStatus\`, set hero label/tone and the selected interval button via the
helpers. For \`custom\`, show a read-only \`Custom: N min\` hint rather than
silently changing the saved setting.

- [ ] **Step 5: Verify and commit**

Run:

\`\`\`bash
node --check popup.js
node --check lib/popup-presentation.mjs
git diff --check
\`\`\`

Expected: each command exits 0.

\`\`\`bash
git add popup.html popup.css popup.js
git commit -m "Redesign popup with macOS glass UI"
\`\`\`

### Task 3: Version, package, and publish v1.4.0

**Files:**
- Modify: \`manifest.json\`
- Modify: \`CHANGELOG.md\`
- Modify: \`README.md\`
- Create: \`dist/shawnigan-keepalive-extension-v1.4.0.zip\`
- Create: \`dist/release-v1.4.0.md\`

**Interfaces:**
- Consumes: tested extension source and authenticated \`gh\` CLI.
- Produces: tag \`v1.4.0\` and a GitHub release containing the ZIP asset.

- [ ] **Step 1: Version and document the release**

Set manifest version to \`1.4.0\`. Add a dated \`1.4.0\` entry above \`1.3.2\` that
documents: the glass popup, Smart/5/15/30 interval controls with custom-value
visibility, and serialized popup commands. Replace all README references to
\`v1.3.2\` and its ZIP filename with \`v1.4.0\`.

- [ ] **Step 2: Run the full validation suite**

\`\`\`bash
node --test tests/keepalive-core.test.mjs tests/popup-presentation.test.mjs
node --check background.js
node --check popup.js
node --check lib/keepalive-core.mjs
node --check lib/popup-presentation.mjs
python3 -m json.tool manifest.json >/dev/null
git diff --check
\`\`\`

Expected: all tests pass and every command exits 0.

- [ ] **Step 3: Build and inspect the ZIP**

\`\`\`bash
rm -rf dist && mkdir dist
zip -r dist/shawnigan-keepalive-extension-v1.4.0.zip manifest.json background.js popup.html popup.css popup.js lib icons LICENSE NOTICE README.md CHANGELOG.md CONTRIBUTING.md -x '*/.DS_Store'
unzip -p dist/shawnigan-keepalive-extension-v1.4.0.zip manifest.json | python3 -m json.tool
unzip -l dist/shawnigan-keepalive-extension-v1.4.0.zip
shasum -a 256 dist/shawnigan-keepalive-extension-v1.4.0.zip
\`\`\`

Expected: manifest version \`1.4.0\`; no \`.git\`, \`tests\`, \`docs\`, or old
\`dist\` artifacts in the archive.

- [ ] **Step 4: Commit, push, tag, and release**

Create \`dist/release-v1.4.0.md\` from the three changelog bullets, then run:

\`\`\`bash
git add manifest.json CHANGELOG.md README.md
git commit -m "Release v1.4.0"
git push -u origin codex/macos-glass-ui
git tag -a v1.4.0 -m "Release v1.4.0"
git push origin v1.4.0
gh release create v1.4.0 dist/shawnigan-keepalive-extension-v1.4.0.zip --title "v1.4.0" --notes-file dist/release-v1.4.0.md
gh release view v1.4.0 --json url,tagName,assets
\`\`\`

