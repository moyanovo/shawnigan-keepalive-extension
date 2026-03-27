export const SAFE_KEEPALIVE_URL = 'https://shawnigan.myschoolapp.com/'
export const MIN_INTERVAL_MINUTES = 1
export const MAX_INTERVAL_MINUTES = 120
export const DEFAULT_INTERVAL_MINUTES = 15
export const MAX_DETAIL_ITEMS = 3
export const MAX_STORED_TAB_STATUSES = 20

const ALLOWED_STATES = new Set([
  'idle',
  'running',
  'healthy',
  'warning',
  'paused',
  'empty',
  'error',
])

const ALLOWED_SCOPES = new Set([
  'all-tabs',
  'single-tab',
])

export const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  intervalMinutes: DEFAULT_INTERVAL_MINUTES,
  isRunning: false,
  currentTrigger: null,
  lastRunAt: null,
  lastRunDurationMs: 0,
  lastMatchedCount: 0,
  lastSuccessCount: 0,
  lastFailureCount: 0,
  lastTrigger: null,
  lastScope: 'all-tabs',
  lastState: 'idle',
  lastResult: 'Idle',
  lastDetails: [],
  lastTargetUrl: SAFE_KEEPALIVE_URL,
  lastTabStatuses: [],
  lastErrorAt: null,
})

function normalizeDateString(value) {
  if (typeof value !== 'string' || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function normalizeCount(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < 0) return 0
  return Math.floor(number)
}

function normalizeLastDetails(value) {
  if (!Array.isArray(value)) return []
  return value
    .filter((detail) => typeof detail === 'string' && detail)
    .slice(0, MAX_DETAIL_ITEMS + 2)
}

function normalizeTabStatus(entry) {
  if (!entry || typeof entry !== 'object') return null

  const tabId = Number.isInteger(entry.tabId) ? entry.tabId : null
  const windowId = Number.isInteger(entry.windowId) ? entry.windowId : null
  const title = typeof entry.title === 'string' && entry.title
    ? entry.title
    : 'Untitled tab'
  const url = typeof entry.url === 'string' && entry.url
    ? entry.url
    : SAFE_KEEPALIVE_URL
  const summary = typeof entry.summary === 'string' && entry.summary
    ? entry.summary
    : 'No recent check'
  const checkedAt = normalizeDateString(entry.checkedAt)
  const trigger = normalizeTrigger(entry.trigger)
  const statusCode = normalizeCount(entry.statusCode)

  return {
    tabId,
    windowId,
    title,
    url,
    active: Boolean(entry.active),
    discarded: Boolean(entry.discarded),
    ok: Boolean(entry.ok),
    summary,
    checkedAt,
    trigger,
    statusCode,
  }
}

function normalizeLastTabStatuses(value) {
  if (!Array.isArray(value)) return []

  return value
    .map((entry) => normalizeTabStatus(entry))
    .filter(Boolean)
    .slice(0, MAX_STORED_TAB_STATUSES)
}

export function normalizeInterval(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return DEFAULT_INTERVAL_MINUTES
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(number)))
}

export function normalizeTrigger(value) {
  if (value === 'alarm' || value === 'manual') return value
  return null
}

export function normalizeScope(value) {
  return ALLOWED_SCOPES.has(value) ? value : DEFAULT_SETTINGS.lastScope
}

export function normalizeLastState(value) {
  return ALLOWED_STATES.has(value) ? value : DEFAULT_SETTINGS.lastState
}

export function normalizeSettings(storedSettings = {}) {
  const source = storedSettings && typeof storedSettings === 'object'
    ? storedSettings
    : {}

  const isRunning = Boolean(source.isRunning)

  return {
    enabled: source.enabled == null ? DEFAULT_SETTINGS.enabled : Boolean(source.enabled),
    intervalMinutes: normalizeInterval(source.intervalMinutes),
    isRunning,
    currentTrigger: isRunning ? normalizeTrigger(source.currentTrigger) : null,
    lastRunAt: normalizeDateString(source.lastRunAt),
    lastRunDurationMs: normalizeCount(source.lastRunDurationMs),
    lastMatchedCount: normalizeCount(source.lastMatchedCount),
    lastSuccessCount: normalizeCount(source.lastSuccessCount),
    lastFailureCount: normalizeCount(source.lastFailureCount),
    lastTrigger: normalizeTrigger(source.lastTrigger),
    lastScope: normalizeScope(source.lastScope),
    lastState: normalizeLastState(source.lastState),
    lastResult: typeof source.lastResult === 'string' && source.lastResult
      ? source.lastResult
      : DEFAULT_SETTINGS.lastResult,
    lastDetails: normalizeLastDetails(source.lastDetails),
    lastTargetUrl: typeof source.lastTargetUrl === 'string' && source.lastTargetUrl
      ? source.lastTargetUrl
      : SAFE_KEEPALIVE_URL,
    lastTabStatuses: normalizeLastTabStatuses(source.lastTabStatuses),
    lastErrorAt: normalizeDateString(source.lastErrorAt),
  }
}

export function formatTrigger(trigger) {
  return trigger === 'alarm' ? 'scheduled run' : 'manual run'
}

export function combineTriggers(currentTrigger, nextTrigger) {
  const current = normalizeTrigger(currentTrigger)
  const next = normalizeTrigger(nextTrigger)

  if (!current) return next || 'manual'
  if (!next) return current
  if (current === 'manual' || next === 'manual') return 'manual'
  return 'alarm'
}

export function summarizePingFailure(result) {
  if (result?.error) return result.error
  if (result?.status) return `HTTP ${result.status}`
  return 'Unknown failure'
}

export function buildLastDetails(trigger, matchedCount, pingResults, options = {}) {
  const failureResults = pingResults.filter((result) => !result.ok)
  const targetUrl = typeof options.targetUrl === 'string' && options.targetUrl
    ? options.targetUrl
    : SAFE_KEEPALIVE_URL

  if (!matchedCount) {
    return [
      'No Shawnigan tabs were open during the last check.',
      `Target URL: ${targetUrl}`,
    ]
  }

  if (!failureResults.length) {
    return [
      `All ${matchedCount} matched tab${matchedCount === 1 ? '' : 's'} responded on the ${formatTrigger(trigger)}.`,
      `Target URL: ${targetUrl}`,
    ]
  }

  const details = failureResults.slice(0, MAX_DETAIL_ITEMS).map((result) => {
    const title = result.title || result.tab?.title || 'Untitled tab'
    return `${title}: ${summarizePingFailure(result)}`
  })

  if (failureResults.length > MAX_DETAIL_ITEMS) {
    const remaining = failureResults.length - MAX_DETAIL_ITEMS
    details.push(`Plus ${remaining} more failed tab${remaining === 1 ? '' : 's'}.`)
  }

  details.push(`Target URL: ${targetUrl}`)
  return details
}

export function buildRunResult({ matchedCount, successCount, failureCount, scope = 'all-tabs' }) {
  if (!matchedCount) {
    return scope === 'single-tab'
      ? 'Selected tab was not available'
      : 'No Shawnigan tabs found'
  }

  if (!failureCount) {
    return scope === 'single-tab'
      ? 'Selected tab responded'
      : `All ${successCount} tabs responded`
  }

  if (!successCount) {
    return scope === 'single-tab'
      ? 'Selected tab needs attention'
      : `All ${matchedCount} tabs need attention`
  }

  return `${failureCount} of ${matchedCount} tabs need attention`
}

export function prioritizeTabsForPing(tabs) {
  return [...tabs].sort((left, right) => {
    if (Boolean(left.active) !== Boolean(right.active)) {
      return left.active ? -1 : 1
    }

    if (Boolean(left.discarded) !== Boolean(right.discarded)) {
      return left.discarded ? 1 : -1
    }

    return (left.id || 0) - (right.id || 0)
  })
}

export async function mapWithConcurrency(items, limit, mapper) {
  const concurrency = Math.max(1, Math.floor(Number(limit) || 1))
  const results = new Array(items.length)
  let index = 0

  async function worker() {
    while (true) {
      const currentIndex = index
      index += 1

      if (currentIndex >= items.length) {
        return
      }

      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  const workerCount = Math.min(concurrency, items.length || 1)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

export function buildLastTabStatuses(trigger, pingResults, checkedAt) {
  const normalizedCheckedAt = normalizeDateString(checkedAt)

  return pingResults
    .slice(0, MAX_STORED_TAB_STATUSES)
    .map((result) => ({
      tabId: Number.isInteger(result.tab?.id) ? result.tab.id : null,
      windowId: Number.isInteger(result.tab?.windowId) ? result.tab.windowId : null,
      title: result.title || result.tab?.title || 'Untitled tab',
      url: result.tab?.url || result.url || SAFE_KEEPALIVE_URL,
      active: Boolean(result.tab?.active),
      discarded: Boolean(result.tab?.discarded),
      ok: Boolean(result.ok),
      summary: result.ok
        ? `Responded${result.status ? ` (HTTP ${result.status})` : ''}`
        : summarizePingFailure(result),
      checkedAt: normalizedCheckedAt,
      trigger: normalizeTrigger(trigger),
      statusCode: normalizeCount(result.status),
    }))
}

export function annotateTabsWithLastStatus(tabs, lastTabStatuses) {
  const lastStatusByTabId = new Map()

  lastTabStatuses.forEach((status) => {
    if (status.tabId == null || lastStatusByTabId.has(status.tabId)) return
    lastStatusByTabId.set(status.tabId, status)
  })

  return tabs.map((tab) => {
    const lastStatus = lastStatusByTabId.get(tab.id) || null

    return {
      ...tab,
      lastCheckStatus: lastStatus
        ? (lastStatus.ok ? 'ok' : 'failed')
        : 'idle',
      lastCheckSummary: lastStatus?.summary || 'No recent check for this tab',
      lastCheckedAt: lastStatus?.checkedAt || null,
      lastCheckTrigger: lastStatus?.trigger || null,
      lastCheckStatusCode: lastStatus?.statusCode || 0,
    }
  })
}

export function getBadgePresentation(settings, matchedCount) {
  const count = normalizeCount(matchedCount)

  if (!settings.enabled) {
    return {
      text: '',
      color: '#7a7f87',
      title: 'Shawnigan Keepalive is paused.',
    }
  }

  if (settings.isRunning) {
    return {
      text: '...',
      color: '#2563eb',
      title: count
        ? `Shawnigan Keepalive is checking ${count} tab${count === 1 ? '' : 's'}.`
        : 'Shawnigan Keepalive is checking for matching tabs.',
    }
  }

  if (!count) {
    return {
      text: '',
      color: '#0d7a5f',
      title: 'Shawnigan Keepalive is on. No matching tabs are open.',
    }
  }

  if (settings.lastState === 'error' || (settings.lastState === 'warning' && settings.lastFailureCount > 0)) {
    return {
      text: '!',
      color: '#c2410c',
      title: `Shawnigan Keepalive needs attention: ${settings.lastFailureCount} of ${settings.lastMatchedCount} tab${settings.lastMatchedCount === 1 ? '' : 's'} failed on the last check.`,
    }
  }

  return {
    text: String(count),
    color: '#0d7a5f',
    title: `Shawnigan Keepalive is watching ${count} tab${count === 1 ? '' : 's'}.`,
  }
}
