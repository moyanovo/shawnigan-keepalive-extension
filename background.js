import {
  SAFE_KEEPALIVE_URL,
  DEFAULT_SETTINGS,
  annotateTabsWithLastStatus,
  buildLastDetails,
  buildLastTabStatuses,
  buildRunResult,
  combineTriggers,
  formatTrigger,
  getBadgePresentation,
  mapWithConcurrency,
  normalizeSettings,
  normalizeTrigger,
  prioritizeTabsForPing,
} from './lib/keepalive-core.mjs'

const STORAGE_KEY = 'settings'
const ALARM_NAME = 'shawnigan-keepalive'
const SAFE_KEEPALIVE_PATH = '/'
const KEEPALIVE_TIMEOUT_MS = 15000
const BADGE_REFRESH_DELAY_MS = 250
const MAX_CONCURRENT_PINGS = 3

let lastBadgePresentation = {
  text: null,
  color: null,
  title: null,
}
let badgeRefreshTimer = null
let keepaliveQueue = []
let keepaliveQueueInProgress = false

function isMatchingUrl(url = '') {
  return url.startsWith(SAFE_KEEPALIVE_URL)
}

function haveSchedulingSettingsChanged(current, next) {
  return current.enabled !== next.enabled || current.intervalMinutes !== next.intervalMinutes
}

function getRunState(matchedCount, failureCount) {
  if (!matchedCount) return 'empty'
  if (!failureCount) return 'healthy'
  return 'warning'
}

function sanitizePatch(patch) {
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  )
}

async function setBadgePresentation(presentation) {
  const next = {
    text: presentation?.text || '',
    color: presentation?.color || '#0d7a5f',
    title: presentation?.title || 'Shawnigan Keepalive',
  }

  const updates = []

  if (next.color !== lastBadgePresentation.color) {
    updates.push(chrome.action.setBadgeBackgroundColor({ color: next.color }))
  }

  if (next.title !== lastBadgePresentation.title) {
    updates.push(chrome.action.setTitle({ title: next.title }))
  }

  if (next.text !== lastBadgePresentation.text) {
    updates.push(chrome.action.setBadgeText({ text: next.text }))
  }

  if (!updates.length) return

  await Promise.all(updates)
  lastBadgePresentation = next
}

async function updateBadge(settings = null, matchedCount) {
  const resolvedSettings = settings || await getSettings()
  const count = typeof matchedCount === 'number'
    ? matchedCount
    : (await findMatchingTabs()).length

  await setBadgePresentation(getBadgePresentation(resolvedSettings, count))
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

async function getSettings() {
  const stored = await chrome.storage.local.get(STORAGE_KEY)
  return normalizeSettings(stored[STORAGE_KEY] || DEFAULT_SETTINGS)
}

async function saveSettings(patch, options = {}) {
  const current = options.currentSettings || await getSettings()
  const next = normalizeSettings({ ...current, ...sanitizePatch(patch) })

  await chrome.storage.local.set({ [STORAGE_KEY]: next })

  const shouldSyncAlarm = options.syncAlarm ?? haveSchedulingSettingsChanged(current, next)
  if (shouldSyncAlarm) {
    await syncAlarm(next)
  }

  if (typeof options.badgeCount === 'number') {
    await updateBadge(next, options.badgeCount)
  } else if (!options.skipBadgeRefresh) {
    await updateBadge(next)
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

  tabs.forEach((tab) => {
    if (tab.id == null || !isMatchingUrl(tab.url || '')) return
    if (uniqueTabs.has(tab.id)) return
    uniqueTabs.set(tab.id, tab)
  })

  return prioritizeTabsForPing([...uniqueTabs.values()])
}

async function findMatchingTabById(tabId) {
  const normalizedTabId = Number(tabId)
  if (!Number.isInteger(normalizedTabId)) return null

  try {
    const tab = await chrome.tabs.get(normalizedTabId)
    if (tab.id == null || !isMatchingUrl(tab.url || '')) return null
    return tab
  } catch {
    return null
  }
}

async function requireMatchingTabById(tabId) {
  const tab = await findMatchingTabById(tabId)
  if (!tab || tab.id == null) {
    throw new Error('That Shawnigan tab is no longer available.')
  }

  return tab
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

async function savePausedState(trigger, scope) {
  return saveSettings({
    isRunning: false,
    currentTrigger: null,
    lastRunAt: new Date().toISOString(),
    lastRunDurationMs: 0,
    lastMatchedCount: 0,
    lastSuccessCount: 0,
    lastFailureCount: 0,
    lastTrigger: normalizeTrigger(trigger),
    lastScope: scope,
    lastState: 'paused',
    lastResult: 'Paused',
    lastDetails: ['Keepalive is paused. Turn it back on to resume checks.'],
    lastTargetUrl: SAFE_KEEPALIVE_URL,
    lastTabStatuses: [],
    lastErrorAt: null,
  }, {
    syncAlarm: false,
  })
}

async function recordExtensionError(summary, error, options = {}) {
  const detail = error?.message || 'Unexpected error'

  try {
    return await saveSettings({
      isRunning: false,
      currentTrigger: null,
      lastRunAt: options.updateRunMetadata ? new Date().toISOString() : undefined,
      lastRunDurationMs: options.updateRunMetadata ? 0 : undefined,
      lastMatchedCount: options.updateRunMetadata ? 0 : undefined,
      lastSuccessCount: options.updateRunMetadata ? 0 : undefined,
      lastFailureCount: options.updateRunMetadata ? 0 : undefined,
      lastTrigger: options.updateRunMetadata ? normalizeTrigger(options.trigger) : undefined,
      lastScope: options.updateRunMetadata ? options.scope || 'all-tabs' : undefined,
      lastState: 'error',
      lastResult: summary,
      lastDetails: [detail, `Target URL: ${SAFE_KEEPALIVE_URL}`],
      lastTargetUrl: SAFE_KEEPALIVE_URL,
      lastTabStatuses: options.updateRunMetadata ? [] : undefined,
      lastErrorAt: new Date().toISOString(),
    }, {
      syncAlarm: false,
    })
  } catch (storageError) {
    console.error('Shawnigan Keepalive failed to persist an error state', storageError)
    throw error
  }
}

async function resolveTabsForRun(scope, tabId) {
  if (scope === 'single-tab') {
    const tab = await findMatchingTabById(tabId)
    return tab ? [tab] : []
  }

  return findMatchingTabs()
}

function getRunningCopy(scope, trigger) {
  return scope === 'single-tab'
    ? [`Running a ${formatTrigger(trigger)} for the selected tab.`]
    : ['Running a keepalive check across matching Shawnigan tabs.']
}

function getNoMatchDetails(scope) {
  return scope === 'single-tab'
    ? [
        'The selected tab is no longer available or no longer matches Shawnigan.',
        `Target URL: ${SAFE_KEEPALIVE_URL}`,
      ]
    : [
        'No Shawnigan tabs were open during the last check.',
        `Target URL: ${SAFE_KEEPALIVE_URL}`,
      ]
}

async function performKeepalive(trigger = 'manual', options = {}) {
  const normalizedTrigger = normalizeTrigger(trigger) || 'manual'
  const scope = options.scope === 'single-tab' ? 'single-tab' : 'all-tabs'
  const initialSettings = await getSettings()

  if (!initialSettings.enabled) {
    return savePausedState(normalizedTrigger, scope)
  }

  await saveSettings({
    isRunning: true,
    currentTrigger: normalizedTrigger,
    lastScope: scope,
    lastState: 'running',
    lastResult: scope === 'single-tab'
      ? 'Checking selected tab...'
      : 'Checking Shawnigan tabs...',
    lastDetails: getRunningCopy(scope, normalizedTrigger),
    lastErrorAt: null,
  }, {
    syncAlarm: false,
  })

  const startedAt = Date.now()

  try {
    const matchedTabs = await resolveTabsForRun(scope, options.tabId)

    if (!matchedTabs.length) {
      return saveSettings({
        isRunning: false,
        currentTrigger: null,
        lastRunAt: new Date().toISOString(),
        lastRunDurationMs: Date.now() - startedAt,
        lastMatchedCount: 0,
        lastSuccessCount: 0,
        lastFailureCount: 0,
        lastTrigger: normalizedTrigger,
        lastScope: scope,
        lastState: 'empty',
        lastResult: buildRunResult({
          matchedCount: 0,
          successCount: 0,
          failureCount: 0,
          scope,
        }),
        lastDetails: getNoMatchDetails(scope),
        lastTargetUrl: SAFE_KEEPALIVE_URL,
        lastTabStatuses: [],
        lastErrorAt: null,
      }, {
        syncAlarm: false,
      })
    }

    const pingResults = await mapWithConcurrency(matchedTabs, MAX_CONCURRENT_PINGS, pingTab)
    const successCount = pingResults.filter((result) => result.ok).length
    const failureCount = pingResults.length - successCount
    const finishedAt = new Date().toISOString()

    return saveSettings({
      isRunning: false,
      currentTrigger: null,
      lastRunAt: finishedAt,
      lastRunDurationMs: Date.now() - startedAt,
      lastMatchedCount: matchedTabs.length,
      lastSuccessCount: successCount,
      lastFailureCount: failureCount,
      lastTrigger: normalizedTrigger,
      lastScope: scope,
      lastState: getRunState(matchedTabs.length, failureCount),
      lastResult: buildRunResult({
        matchedCount: matchedTabs.length,
        successCount,
        failureCount,
        scope,
      }),
      lastDetails: buildLastDetails(normalizedTrigger, matchedTabs.length, pingResults),
      lastTargetUrl: SAFE_KEEPALIVE_URL,
      lastTabStatuses: buildLastTabStatuses(normalizedTrigger, pingResults, finishedAt),
      lastErrorAt: null,
    }, {
      syncAlarm: false,
      badgeCount: matchedTabs.length,
    })
  } catch (error) {
    return recordExtensionError('Keepalive check failed.', error, {
      trigger: normalizedTrigger,
      scope,
      updateRunMetadata: true,
    })
  }
}

function enqueueKeepaliveJob(job) {
  return new Promise((resolve, reject) => {
    if (job.scope === 'all-tabs') {
      const existingAllTabsJob = keepaliveQueue.find((queuedJob) => queuedJob.scope === 'all-tabs')
      if (existingAllTabsJob) {
        existingAllTabsJob.trigger = combineTriggers(existingAllTabsJob.trigger, job.trigger)
        existingAllTabsJob.waiters.push({ resolve, reject })
        return
      }
    }

    keepaliveQueue.push({
      ...job,
      waiters: [{ resolve, reject }],
    })

    processKeepaliveQueue().catch((error) => {
      console.error('Shawnigan Keepalive queue failed', error)
    })
  })
}

async function processKeepaliveQueue() {
  if (keepaliveQueueInProgress) return

  keepaliveQueueInProgress = true

  try {
    while (keepaliveQueue.length) {
      const job = keepaliveQueue.shift()

      try {
        const result = await performKeepalive(job.trigger, job)
        job.waiters.forEach((waiter) => waiter.resolve(result))
      } catch (error) {
        job.waiters.forEach((waiter) => waiter.reject(error))
      }
    }
  } finally {
    keepaliveQueueInProgress = false
  }
}

async function runKeepalive(trigger = 'manual') {
  return enqueueKeepaliveJob({
    trigger: normalizeTrigger(trigger) || 'manual',
    scope: 'all-tabs',
  })
}

async function runKeepaliveForTab(tabId) {
  return enqueueKeepaliveJob({
    trigger: 'manual',
    scope: 'single-tab',
    tabId,
  })
}

async function focusTab(tabId) {
  const tab = await requireMatchingTabById(tabId)

  if (tab.windowId != null) {
    await chrome.windows.update(tab.windowId, { focused: true })
  }

  await chrome.tabs.update(tab.id, { active: true })
}

async function getStatus() {
  const settings = await getSettings()
  const matchedTabs = annotateTabsWithLastStatus(
    (await findMatchingTabs()).map((tab) => ({
      id: tab.id,
      windowId: tab.windowId,
      title: tab.title || 'Untitled tab',
      url: tab.url || '',
      active: Boolean(tab.active),
      discarded: Boolean(tab.discarded),
    })),
    settings.lastTabStatuses,
  )
  const activeMatchedTab = matchedTabs.find((tab) => tab.active) || null

  return {
    ...settings,
    matchedCount: matchedTabs.length,
    matchedTabs,
    activeMatchedTabId: activeMatchedTab?.id || null,
    queuedRunCount: keepaliveQueue.length,
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

  if (message?.type === 'run-tab') {
    await runKeepaliveForTab(message.payload?.tabId)
    return getStatus()
  }

  if (message?.type === 'focus-tab') {
    await focusTab(message.payload?.tabId)
    return getStatus()
  }

  throw new Error(`Unknown message type: ${message?.type || 'unknown'}`)
}

function runListenerTask(summary, task, options = {}) {
  task().catch(async (error) => {
    console.error(summary, error)

    try {
      await recordExtensionError(summary, error, options)
    } catch (recordError) {
      console.error('Shawnigan Keepalive listener error handling failed', recordError)
    }
  })
}

chrome.runtime.onInstalled.addListener(() => {
  runListenerTask('Shawnigan Keepalive install setup failed.', async () => {
    await saveSettings({}, { syncAlarm: true })
  })
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return

  runListenerTask('Scheduled keepalive run failed.', async () => {
    await runKeepalive('alarm')
  }, {
    trigger: 'alarm',
    scope: 'all-tabs',
    updateRunMetadata: true,
  })
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
  await syncAlarm(await getSettings())
  await updateBadge()
}

init().catch(async (error) => {
  console.error('Shawnigan Keepalive init failed', error)

  try {
    await recordExtensionError('Shawnigan Keepalive failed to initialize.', error)
  } catch (recordError) {
    console.error('Shawnigan Keepalive init error handling failed', recordError)
  }
})
