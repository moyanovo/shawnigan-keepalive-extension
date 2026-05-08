<a id="english"></a>

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Shawnigan Keepalive icon">
</p>

<h1 align="center">Shawnigan Keepalive Extension</h1>

<p align="center">
  A small Chrome extension that helps Shawnigan tabs stay active without noisy page reloads.
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#中文">中文</a> ·
  <a href="https://github.com/moyanovo/shawnigan-keepalive-extension/releases/tag/v1.3.1">Latest release</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-v1.3.1-2563eb?style=flat-square">
  <img alt="Chrome Manifest V3" src="https://img.shields.io/badge/Chrome-Manifest%20V3-16a34a?style=flat-square">
  <img alt="JavaScript" src="https://img.shields.io/badge/JavaScript-ES%20Modules-f7df1e?style=flat-square&labelColor=111827&color=facc15">
  <img alt="License" src="https://img.shields.io/badge/license-proprietary-64748b?style=flat-square">
</p>

---

## At a glance

<table>
  <tr>
    <td><strong>Purpose</strong></td>
    <td>Keeps active Shawnigan sessions from going idle while you are already using the site.</td>
  </tr>
  <tr>
    <td><strong>Target page</strong></td>
    <td><code>https://shawnigan.myschoolapp.com/*</code></td>
  </tr>
  <tr>
    <td><strong>Current release</strong></td>
    <td><a href="https://github.com/moyanovo/shawnigan-keepalive-extension/releases/tag/v1.3.1"><code>v1.3.1</code></a></td>
  </tr>
  <tr>
    <td><strong>Author</strong></td>
    <td>Sam, Moyan Huang</td>
  </tr>
</table>

Shawnigan Keepalive is built for one narrow job: help keep `shawnigan.myschoolapp.com` sessions alive in Chrome. It sends a quiet keepalive request in the background, shows the result in the popup, and stays out of the way when there are no matching Shawnigan pages open.

It does not try to automate the site, bypass login, or collect personal data. The extension looks for matching Shawnigan tabs, runs a safe check, and tells you plainly whether the session still looks healthy.

## Highlights

<table>
  <tr>
    <td width="50%">
      <strong>Quiet background checks</strong><br>
      Runs keepalive checks without forcing visible page reloads.
    </td>
    <td width="50%">
      <strong>Smart timing</strong><br>
      Reads the session status endpoint and checks more often only when the session is close to timing out.
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>Clear popup controls</strong><br>
      Toggle keepalive, set a fixed interval, run all matched tabs, or test one tab manually.
    </td>
    <td width="50%">
      <strong>Useful diagnostics</strong><br>
      Shows the last result, failed tabs, check details, and badge state.
    </td>
  </tr>
</table>

## Install

### Download the packaged release

1. Open the [Releases page](https://github.com/moyanovo/shawnigan-keepalive-extension/releases).
2. Download `shawnigan-keepalive-extension-v1.3.1.zip` from the latest release.
3. Extract the ZIP somewhere you can find it again.

### Or clone the repository

```bash
git clone https://github.com/moyanovo/shawnigan-keepalive-extension.git
cd shawnigan-keepalive-extension
```

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select the extracted folder or the cloned repository folder.
5. Pin the extension if you want quick access to the popup.

## Use it

1. Open one or more Shawnigan pages in Chrome.
2. Click the extension icon.
3. Turn keepalive on.
4. Choose a fixed interval, or leave Smart mode enabled.
5. Use **Run now** when you want an immediate check.
6. Use **Run tab** for one page, or **Jump to tab** to switch to it.
7. Check **Last result**, **Last check**, and **Last details** if something needs attention.

## Permissions

| Permission | Why it is needed |
| --- | --- |
| `alarms` | Schedules keepalive runs. |
| `scripting` | Runs the in-tab keepalive request on matched Shawnigan pages. |
| `storage` | Saves settings and last-run diagnostics. |
| `tabs` | Finds matching Shawnigan tabs and updates the badge. |
| `https://shawnigan.myschoolapp.com/*` | Limits the extension to Shawnigan pages. |

## Project layout

```text
.
├── background.js              # Manifest V3 service worker
├── lib/keepalive-core.mjs     # Shared normalization and status helpers
├── popup.html                 # Popup markup
├── popup.css                  # Popup styling
├── popup.js                   # Popup behavior
├── manifest.json              # Chrome extension manifest
├── icons/                     # Extension icon assets
├── tests/                     # Node test coverage for shared helpers
├── CHANGELOG.md               # Release history
├── CONTRIBUTING.md            # Contribution notes
├── LICENSE                    # Proprietary license terms
└── NOTICE                     # Copyright and attribution notice
```

## Development checks

After editing the source, reload the extension from `chrome://extensions`. If the popup is open during reload, close and reopen it.

Run these checks before packaging or publishing:

```bash
node --test tests/keepalive-core.test.mjs
node --check background.js
node --check popup.js
node --check lib/keepalive-core.mjs
git diff --check
```

## Disclaimer

> This project is independent and is not affiliated with, endorsed by, sponsored by, or maintained by Shawnigan Lake School.
>
> The icon and logo assets used by this project are Shawnigan Lake School icon/logo materials. They are included only for identification and compatibility with the school-related pages this extension supports. I have not modified those assets, and I do not use them commercially. All trademarks, logos, names, and related brand materials remain the property of their respective owners.
>
> If Shawnigan Lake School or an authorized rights holder asks for the icon/logo assets to be changed or removed, I will replace or remove them from this project.

## Copyright

Copyright (c) 2026 Sam, Moyan Huang. All rights reserved.

This repository is public for transparency and distribution, but the project remains proprietary. Author attribution, copyright notices, the project name, and repository notices may not be removed, altered, or replaced without prior written permission from Sam, Moyan Huang.

---

<a id="中文"></a>

<p align="center">
  <img src="icons/icon128.png" width="96" height="96" alt="Shawnigan Keepalive icon">
</p>

<h1 align="center">Shawnigan Keepalive Extension</h1>

<p align="center">
  一个轻量的 Chrome Extension，用来帮助 Shawnigan 页面保持在线，同时避免频繁刷新页面。
</p>

<p align="center">
  <a href="#english">English</a> · <a href="#中文">中文</a> ·
  <a href="https://github.com/moyanovo/shawnigan-keepalive-extension/releases/tag/v1.3.1">Latest release</a> ·
  <a href="CHANGELOG.md">Changelog</a>
</p>

## 快速了解

<table>
  <tr>
    <td><strong>用途</strong></td>
    <td>当你已经在使用 Shawnigan 网站时，帮助当前 session 不要太快进入 idle 状态。</td>
  </tr>
  <tr>
    <td><strong>支持页面</strong></td>
    <td><code>https://shawnigan.myschoolapp.com/*</code></td>
  </tr>
  <tr>
    <td><strong>当前版本</strong></td>
    <td><a href="https://github.com/moyanovo/shawnigan-keepalive-extension/releases/tag/v1.3.1"><code>v1.3.1</code></a></td>
  </tr>
  <tr>
    <td><strong>作者</strong></td>
    <td>Sam, Moyan Huang</td>
  </tr>
</table>

Shawnigan Keepalive 只解决一个很具体的问题：当你已经在 Chrome 里使用 `shawnigan.myschoolapp.com` 时，帮助这些 session 保持在线。它会在后台发送安静的 keepalive 请求，在 popup 里显示检查结果；如果没有打开匹配的 Shawnigan 页面，它就不会做多余的事。

它不会自动操作网站，不会绕过登录，也不会收集个人数据。Extension 只会查找匹配的 Shawnigan tabs，执行安全检查，然后清楚地告诉你当前 session 是否正常。

## 亮点

<table>
  <tr>
    <td width="50%">
      <strong>安静的后台检查</strong><br>
      执行 keepalive 检查时，不强制可见页面刷新。
    </td>
    <td width="50%">
      <strong>Smart timing</strong><br>
      读取 session status endpoint，只在 session 接近超时时更频繁检查。
    </td>
  </tr>
  <tr>
    <td width="50%">
      <strong>清楚的 popup 控制</strong><br>
      可以开启/关闭 keepalive、设置固定间隔、检查全部匹配 tabs，或手动检查单个 tab。
    </td>
    <td width="50%">
      <strong>有用的 diagnostics</strong><br>
      显示 Last result、失败 tabs、检查细节和 badge 状态。
    </td>
  </tr>
</table>

## 安装

### 下载打包好的版本

1. 打开 [Releases page](https://github.com/moyanovo/shawnigan-keepalive-extension/releases)。
2. 下载最新 release 里的 `shawnigan-keepalive-extension-v1.3.1.zip`。
3. 解压 ZIP 到一个你之后能找到的位置。

### 或者克隆仓库

```bash
git clone https://github.com/moyanovo/shawnigan-keepalive-extension.git
cd shawnigan-keepalive-extension
```

## 在 Chrome 中加载

1. 打开 `chrome://extensions`。
2. 开启 **Developer mode**。
3. 点击 **Load unpacked**。
4. 选择解压后的文件夹，或选择克隆下来的 repository 文件夹。
5. 如果想快速打开 popup，可以把 extension pin 到工具栏。

## 使用方法

1. 在 Chrome 里打开一个或多个 Shawnigan 页面。
2. 点击 extension icon。
3. 打开 keepalive 开关。
4. 设置固定检查间隔，或者保持 Smart mode 开启。
5. 需要立即检查时，点击 **Run now**。
6. 只想检查某个页面时，用 **Run tab**；想切换到对应页面时，用 **Jump to tab**。
7. 如果出现问题，可以查看 **Last result**、**Last check** 和 **Last details**。

## 权限说明

| 权限 | 用途 |
| --- | --- |
| `alarms` | 定时执行 keepalive 检查。 |
| `scripting` | 在匹配的 Shawnigan 页面里执行 keepalive 请求。 |
| `storage` | 保存设置和 last-run diagnostics。 |
| `tabs` | 查找匹配的 Shawnigan tabs，并更新 badge。 |
| `https://shawnigan.myschoolapp.com/*` | 将 extension 限制在 Shawnigan 页面范围内。 |

## 项目结构

```text
.
├── background.js              # Manifest V3 service worker
├── lib/keepalive-core.mjs     # 共享的 normalization 和 status helpers
├── popup.html                 # popup markup
├── popup.css                  # popup styling
├── popup.js                   # popup behavior
├── manifest.json              # Chrome extension manifest
├── icons/                     # extension icon assets
├── tests/                     # shared helpers 的 Node 测试
├── CHANGELOG.md               # release history
├── CONTRIBUTING.md            # contribution notes
├── LICENSE                    # proprietary license terms
└── NOTICE                     # copyright 和 attribution notice
```

## 开发检查

修改源码后，需要在 `chrome://extensions` 里 reload extension。如果 reload 时 popup 正开着，关掉再重新打开。

打包或发布前，建议运行这些轻量检查：

```bash
node --test tests/keepalive-core.test.mjs
node --check background.js
node --check popup.js
node --check lib/keepalive-core.mjs
git diff --check
```

## 免责声明

> 本项目是独立项目，与 Shawnigan Lake School 无任何隶属、授权、赞助、背书或维护关系。
>
> 本项目使用的 icon 和 logo 资产属于 Shawnigan Lake School 的 icon/logo materials，仅用于识别本 extension 所支持的 school-related pages。我没有对这些资产进行修改，也没有将其用于商业用途。所有 trademarks、logos、names 以及相关 brand materials 均归其各自权利人所有。
>
> 如果 Shawnigan Lake School 或授权权利人要求替换或移除相关 icon/logo 资产，我会从本项目中替换或移除它们。

## 版权

Copyright (c) 2026 Sam, Moyan Huang. All rights reserved.

本仓库公开是为了透明展示和分发项目，但项目本身仍然是 proprietary。未经 Sam, Moyan Huang 事先书面许可，不得移除、修改或替换作者署名、copyright notices、project name 或 repository notices。
