# Shawnigan Keepalive Extension

Lightweight Chrome extension for keeping Shawnigan tabs active with a simple,
low-noise keepalive workflow.

Author: Sam, Moyan Huang

Repository: [moyanovo/shawnigan-keepalive-extension](https://github.com/moyanovo/shawnigan-keepalive-extension)

Current stable release: [`v1.3.0`](https://github.com/moyanovo/shawnigan-keepalive-extension/releases/tag/v1.3.0)

## Overview

Shawnigan Keepalive is a Manifest V3 Chrome extension designed to help keep
open Shawnigan sessions active without forcing visible page reloads. It runs a
silent background keepalive request against matched Shawnigan tabs and gives you
clear status feedback in the popup.

## Features

- On/off toggle for the keepalive worker
- Adjustable refresh interval from 1 to 120 minutes
- Manual `Run now` action for immediate checks
- Per-tab `Run tab` and `Jump to tab` actions from the popup
- Live matched-tab list and badge count
- State-aware badge behavior for running, paused, and attention-needed states
- Last-run diagnostics with failure details and per-tab outcomes
- Lightweight background behavior optimized to reduce unnecessary work

## Supported Match

- `https://shawnigan.myschoolapp.com/*`

## Installation

You can install the extension from the latest packaged release or from a local
source checkout. Historical versions remain available on the Releases page.

### Option 1: Download the current release package (Recommended)

1. Open the [Releases page](https://github.com/moyanovo/shawnigan-keepalive-extension/releases).
2. Download `shawnigan-keepalive-extension-v1.3.0.zip` from the latest release.
3. Extract the ZIP to any folder on your computer.

### Option 2: Clone the source repository

```bash
git clone https://github.com/moyanovo/shawnigan-keepalive-extension.git
cd shawnigan-keepalive-extension
```

## Load in Chrome

1. Open `chrome://extensions`
2. Turn on `Developer mode`
3. Click `Load unpacked`
4. Select the extracted repository folder

Once loaded, pin the extension if you want quick access to the popup.

## How to Use

1. Open one or more Shawnigan pages in Chrome.
2. Click the extension icon to open the popup.
3. Turn keepalive on.
4. Set your preferred refresh interval.
5. Use `Run now` any time you want an immediate check across all matching tabs.
6. Use `Run tab` when you want to test a single matched page without waiting for the next scheduled run.
7. Use `Jump to tab` to switch straight to a matched Shawnigan page from the popup.
8. Review `Last result`, `Last check`, and `Last details` for diagnostics.

## Permissions

The extension requests only the permissions it needs:

- `alarms`: schedules keepalive runs
- `scripting`: performs the in-tab keepalive request
- `storage`: saves user settings and last-run diagnostics
- `tabs`: finds matching Shawnigan tabs and updates badge state

## Project Structure

- `manifest.json`: Chrome extension manifest
- `background.js`: background service worker and keepalive logic
- `lib/keepalive-core.mjs`: shared normalization and status helpers
- `popup.html`: popup markup
- `popup.css`: popup styling
- `popup.js`: popup UI behavior
- `icons/`: extension icon assets
- `tests/`: lightweight logic coverage for shared helpers

## Development Notes

- After editing the source, reload the extension from `chrome://extensions`.
- If the popup is open while you reload the extension, close and reopen it.
- This project currently targets Chromium-based browsers with Manifest V3
  support.

## Repository Files

- [CHANGELOG.md](CHANGELOG.md): release history
- [CONTRIBUTING.md](CONTRIBUTING.md): contribution guidance
- [LICENSE](LICENSE): licensing terms
- [NOTICE](NOTICE): author and attribution notice

## Releases

- Latest release: [`v1.3.0`](https://github.com/moyanovo/shawnigan-keepalive-extension/releases/tag/v1.3.0)
- Historical releases: [all releases](https://github.com/moyanovo/shawnigan-keepalive-extension/releases)

## Copyright

Copyright (c) 2026 Sam, Moyan Huang. All rights reserved.

This repository is public, but the project remains proprietary. Author
attribution, copyright notices, project name, and branding may not be removed,
altered, or replaced without prior written permission from Sam, Moyan Huang.
