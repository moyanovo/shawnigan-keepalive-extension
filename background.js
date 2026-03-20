const STORAGE_KEY = 'settings'
const ALARM_NAME = 'shawnigan-keepalive'
const SAFE_KEEPALIVE_PATH = '/'
const SAFE_KEEPALIVE_URL = 'https://shawnigan.myschoolapp.com/'
const KEEPALIVE_TIMEOUT_MS = 15000
const BADGE_COLOR = '#0d7a5f'
const BADGE_REFRESH_DELAY_MS = 250
const MAX_DETAIL_ITEMS = 3
const DEFAULTS = {
  enabled: true,
  intervalMinutes: 15,
  lastRunAt: null,
  lastMatchCount: 0,
  lastMatchedCount: 0,
  lastSuccessCount: 0,
  lastFailureCount: 0,
  lastTrigger: null,
  lastResult: 'Idle',
  lastDetails: [],
  lastTargetUrl: SAFE_KEEPALIVE_URL,
}

let lastBadgeText = null
let badgeRefreshTimer = null

async function setBadgeText(text) {
  if (text === lastBadgeText) return
  await chrome.action.setBadgeText({ text })
  lastBadgeText = text
}

async function updateBadge(matchedCount) {
  const count = typeof matchedCount === 'number'
    ? matchedCount
    : (await findMatchingTabs()).length

  await setBadgeText(count ? String(count) : '')
}

function scheduleBadgeRefresh() {
  if (badgeRefreshTimer) return

  badgeRefreshTimer = setTimeout(() => {
    badgeRefreshTimer = null
    updateBadge().catch((error) => {
      console.error('Shawnigan Keepalive badge update failed', error)
    })
  }, BADGE_REFRESH_DELAY_MS)
}

function normalizeInterval(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULTS.intervalMinutes
  return Math.min(120, Math.max(1, Math.round(number)))
}

function isMatchingUrl(url = '') {
  return url.startsWith('https://shawnigan.myschoolapp.com/')
}

function haveSchedulingSettingsChanged(current, next) {
  return current.enabled !== next.enabled || current.intervalMinutes !== next.intervalMinutes
}

function formatTrigger(trigger) {
  return trigger === 'alarm' ? 'scheduled run' : 'manual run'
}

function summarizePingFailure(result) {
  if (result.error) return result.error
  if (result.status) return `HTTP ${result.status}`
  return 'Unknown failure'
}

function buildLastDetails(trigger, matchedCount, pingResults) {
  const failureResults = pingResults.filter((result) => !result.ok)

  if (!matchedCount) {
    return [
      'No Shawnigan tabs were open during the last check.',
      `Target URL: ${SAFE_KEEPALIVE_URL}`,
    ]
  }

  if (!failureResults.length) {
    return [
      `All ${matchedCount} matched tab${matchedCount === 1 ? '' : 's'} responded on the ${formatTrigger(trigger)}.`,
      `Target URL: ${SAFE_KEEPALIVE_URL}`,
    ]
  }

  const details = failureResults.slice(0, MAX_DETAIL_ITEMS).map((result) => {
    const title = result.title || result.tab?.title || 'Untitled tab'
    return `${title}: ${summarizePingFailure(result)}`
  })

  if (failureResults.length > MAX_DETAIL_ITEMS) {
    details.push(`Plus ${failureResults.length - MAX_DETAIL_ITEMS} more failed tab${failureResults.length - MAX_DETAIL_ITEMS === 1 ? '' : 's'}.`)
  }

  details.push(`Target URL: ${SAFE_KEEPALIVE_URL}`)
  return details
}

async function pingTab(tab) {
  if (tab.id == null) {
    return {
      tab,
      ok: false,
      status: 0,
      error: 'Missing tab id',
      title: tab.title || 'Untitled tab',
      url: SAFE_KEEPALIVE_URL,
    }
  }

  try {
    const [{ result: response }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [SAFE_KEEPALIVE_PATH, KEEPALIVE_TIMEOUT_MS],
      func: async (keepalivePath, timeoutMs) => {
        const url = new URL(keepalivePath, window.location.origin)
        const controller = new AbortController()
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

        try {
          const response = await fetch(url.toString(), {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
            redirect: 'follow',
            signal: controller.signal,
            headers: {
              'cache-control': 'no-cache',
              pragma: 'no-cache',
            },
          })

          return {
            ok: response.ok,
            status: response.status,
            url: url.toString(),
            title: document.title,
          }
        } catch (error) {
          return {
            ok: false,
            status: 0,
            error: error?.name === 'AbortError'
              ? 'Ping timed out'
              : (error?.message || 'Ping failed'),
            url: url.toString(),
            title: document.title,
          }
        } finally {
          window.clearTimeout(timeoutId)
        }
      },
    })

    return {
      tab,
      ok: Boolean(response?.ok),
      status: response?.status || 0,
      error: response?.error || null,
      title: response?.title || tab.title || 'Untitled tab',
      url: response?.url || SAFE_KEEPALIVE_URL,
    }
  } catch (error) {
    return {
      tab,
      ok: false,
      status: 0,
      error: error?.message || 'No response',
      title: tab.title || 'Untitled tab',
      url: SAFE_KEEPALIVE_URL,
    }
  }
}

async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  const settings = { ...DEFAULTS, ...(stored[STORAGE_KEY] || {}) }
  settings.intervalMinutes = normalizeInterval(settings.intervalMinutes)
  settings.enabled = Boolean(settings.enabled)
  settings.lastDetails = Array.isArray(settings.lastDetails)
    ? settings.lastDetails.filter((detail) => typeof detail === 'string').slice(0, MAX_DETAIL_ITEMS + 2)
    : []
  settings.lastTrigger = settings.lastTrigger === 'alarm' || settings.lastTrigger === 'manual'
    ? settings.lastTrigger
    : null
  settings.lastTargetUrl = typeof settings.lastTargetUrl === 'string' && settings.lastTargetUrl
    ? settings.lastTargetUrl
    : SAFE_KEEPALIVE_URL
  return settings
}

async function saveSettings(patch, options = {}) {
  const current = options.currentSettings || await getSettings()
  const next = { ...current, ...patch }

  next.intervalMinutes = normalizeInterval(next.intervalMinutes)
  next.enabled = Boolean(next.enabled)

  await chrome.storage.local.set({ [STORAGE_KEY]: next })

  const shouldSyncAlarm = options.syncAlarm ?? haveSchedulingSettingsChanged(current, next)
  if (shouldSyncAlarm) {
    await syncAlarm(next)
  }

  if (typeof options.badgeCount === 'number') {
    await updateBadge(options.badgeCount)
  } else if (!options.skipBadgeRefresh) {
    await updateBadge()
  }

  return next
}

async function syncAlarm(settings) {
  const existingAlarm = await chrome.alarms.get(ALARM_NAME)

  if (!settings.enabled) {
    if (existingAlarm) {
      await chrome.alarms.clear(ALARM_NAME)
    }
    return
  }

  if (existingAlarm?.periodInMinutes === settings.intervalMinutes) {
    return
  }

  if (existingAlarm) {
    await chrome.alarms.clear(ALARM_NAME)
  }

  chrome.alarms.create(ALARM_NAME, {
    delayInMinutes: settings.intervalMinutes,
    periodInMinutes: settings.intervalMinutes,
  })
}

async function findMatchingTabs() {
  const tabs = await chrome.tabs.query({ url: ['https://shawnigan.myschoolapp.com/*'] })
  const uniqueTabs = new Map()

  for (const tab of tabs) {
    if (tab.id == null || !isMatchingUrl(tab.url || '')) continue
    if (uniqueTabs.has(tab.id)) continue
    uniqueTabs.set(tab.id, tab)
  }

  return [...uniqueTabs.values()]
}

async function runKeepalive(trigger = 'manual') {
  const settings = await getSettings()
  if (!settings.enabled) {
    return saveSettings({
      lastRunAt: new Date().toISOString(),
      lastMatchCount: 0,
      lastMatchedCount: 0,
      lastSuccessCount: 0,
      lastFailureCount: 0,
      lastTrigger: trigger,
      lastResult: 'Paused',
      lastDetails: ['Keepalive is paused. Turn it back on to resume checks.'],
      lastTargetUrl: SAFE_KEEPALIVE_URL,
    }, {
      currentSettings: settings,
      syncAlarm: false,
      skipBadgeRefresh: true,
    })
  }

  const matchedTabs = await findMatchingTabs()
  const pingResults = await Promise.all(matchedTabs.map((tab) => pingTab(tab)))
  const successCount = pingResults.filter((result) => result.ok).length
  const failureCount = pingResults.length - successCount

  let result = 'No Shawnigan tabs found'
  if (matchedTabs.length) {
    result = successCount === matchedTabs.length
      ? `Pinged ${successCount} tab${successCount === 1 ? '' : 's'} (${trigger})`
      : `Pinged ${successCount}/${matchedTabs.length} tab${matchedTabs.length === 1 ? '' : 's'} (${trigger})`
  }

  return saveSettings({
    lastRunAt: new Date().toISOString(),
    lastMatchCount: successCount,
    lastMatchedCount: matchedTabs.length,
    lastSuccessCount: successCount,
    lastFailureCount: failureCount,
    lastTrigger: trigger,
    lastResult: result,
    lastDetails: buildLastDetails(trigger, matchedTabs.length, pingResults),
    lastTargetUrl: SAFE_KEEPALIVE_URL,
  }, {
    currentSettings: settings,
    syncAlarm: false,
    badgeCount: matchedTabs.length,
  })
}

async function getStatus() {
  const settings = await getSettings()
  const matchedTabs = await findMatchingTabs()

  return {
    ...settings,
    matchedCount: matchedTabs.length,
    matchedTabs: matchedTabs.map((tab) => ({
      id: tab.id,
      windowId: tab.windowId,
      title: tab.title || 'Untitled tab',
      url: tab.url || '',
      active: Boolean(tab.active),
      discarded: Boolean(tab.discarded),
    })),
  }
}

async function handleMessage(message) {
  if (message?.type === 'get-status') {
    return getStatus()
  }

  if (message?.type === 'save-settings') {
    await saveSettings(message.payload || {})
    return getStatus()
  }

  if (message?.type === 'run-now') {
    await runKeepalive('manual')
    return getStatus()
  }

  throw new Error(`Unknown message type: ${message?.type || 'unknown'}`)
}

chrome.runtime.onInstalled.addListener(async () => {
  await saveSettings({})
})

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return
  await runKeepalive('alarm')
})

chrome.tabs.onCreated.addListener(() => {
  scheduleBadgeRefresh()
})

chrome.tabs.onRemoved.addListener(() => {
  scheduleBadgeRefresh()
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (!Object.prototype.hasOwnProperty.call(changeInfo, 'url')
    && !Object.prototype.hasOwnProperty.call(changeInfo, 'discarded')) {
    return
  }

  scheduleBadgeRefresh()
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  ;(async () => {
    try {
      const data = await handleMessage(message)
      sendResponse({ ok: true, data })
    } catch (error) {
      console.error('Shawnigan Keepalive request failed', error)
      sendResponse({
        ok: false,
        error: error?.message || 'Unexpected error',
      })
    }
  })()

  return true
})

async function init() {
  await chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR })
  await syncAlarm(await getSettings())
  await updateBadge()
}

init().catch((error) => {
  console.error('Shawnigan Keepalive init failed', error)
})
