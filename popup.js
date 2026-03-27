const enabledInput = document.getElementById('enabled')
const intervalInput = document.getElementById('interval')
const stateText = document.getElementById('stateText')
const matchCount = document.getElementById('matchCount')
const lastRun = document.getElementById('lastRun')
const lastResult = document.getElementById('lastResult')
const lastStats = document.getElementById('lastStats')
const detailsList = document.getElementById('detailsList')
const matchList = document.getElementById('matchList')
const matchHint = document.getElementById('matchHint')
const runNowButton = document.getElementById('runNow')
const screenReaderStatus = document.getElementById('screenReaderStatus')
const panel = document.querySelector('.panel')

let lastStatus = null
let scheduledRefresh = null
let refreshInFlight = null
let refreshQueued = false
let controlsLocked = false
let busyLabel = ''
let lastAnnouncement = ''

function formatDate(value) {
  if (!value) return 'Never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Never'
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function normalizeTitle(title) {
  return title && typeof title === 'string' ? title : 'Untitled tab'
}

function formatTrigger(trigger) {
  return trigger === 'alarm' ? 'scheduled run' : 'manual run'
}

function announce(message) {
  if (!screenReaderStatus || !message || message === lastAnnouncement) return
  lastAnnouncement = message
  screenReaderStatus.textContent = message
}

function updateUiState() {
  const extensionRunning = Boolean(lastStatus?.isRunning)
  const isBusy = Boolean(refreshInFlight) || controlsLocked || extensionRunning

  panel?.setAttribute('aria-busy', String(isBusy))

  enabledInput.disabled = controlsLocked
  intervalInput.disabled = controlsLocked

  runNowButton.disabled = controlsLocked || extensionRunning || !lastStatus?.enabled
  runNowButton.textContent = controlsLocked && busyLabel
    ? busyLabel
    : (extensionRunning ? 'Running...' : 'Run now')

  matchList.querySelectorAll('.tab-card__button').forEach((button) => {
    const requiresEnabled = button.dataset.requiresEnabled === 'true'
    button.disabled = controlsLocked
      || extensionRunning
      || (requiresEnabled && !lastStatus?.enabled)
  })
}

function describeTabState(tab) {
  if (tab.lastCheckStatus === 'ok') {
    return {
      label: tab.lastCheckedAt
        ? `Responded ${formatDate(tab.lastCheckedAt)}`
        : (tab.lastCheckSummary || 'Responded'),
      state: 'checked-ok',
    }
  }

  if (tab.lastCheckStatus === 'failed') {
    return {
      label: tab.lastCheckSummary || 'Needs attention',
      state: 'checked-failed',
    }
  }

  if (tab.active) return { label: 'Current tab', state: 'current' }
  if (tab.discarded) return { label: 'Discarded tab', state: 'discarded' }
  return { label: 'Matched tab', state: 'matched' }
}

function renderMatches(tabs) {
  matchList.innerHTML = ''
  matchHint.textContent = `${tabs.length} page${tabs.length === 1 ? '' : 's'}`

  if (!tabs.length) {
    const item = document.createElement('li')
    item.className = 'empty'
    item.textContent = 'No matching Shawnigan pages open'
    matchList.appendChild(item)
    updateUiState()
    return
  }

  tabs.forEach((tab) => {
    const item = document.createElement('li')
    item.className = 'tab-card'

    const body = document.createElement('div')
    body.className = 'tab-card__body'

    const title = document.createElement('strong')
    title.className = 'tab-card__title'
    title.textContent = normalizeTitle(tab.title)

    const url = document.createElement('span')
    url.className = 'tab-card__url'
    url.textContent = tab.url

    const meta = document.createElement('span')
    meta.className = 'tab-card__meta'
    meta.textContent = `tab ${tab.id} · window ${tab.windowId}${tab.lastCheckTrigger ? ` · ${formatTrigger(tab.lastCheckTrigger)}` : ''}`

    const badge = document.createElement('span')
    badge.className = 'tab-card__badge'

    const actions = document.createElement('div')
    actions.className = 'tab-card__actions'

    const focusButton = document.createElement('button')
    focusButton.type = 'button'
    focusButton.className = 'tab-card__button tab-card__button--secondary'
    focusButton.dataset.requiresEnabled = 'false'
    focusButton.textContent = 'Jump to tab'
    focusButton.addEventListener('click', async () => {
      try {
        await withBusy('Opening tab...', async () => {
          await request('focus-tab', { tabId: tab.id })
        })
        announce(`Focused ${normalizeTitle(tab.title)}.`)
      } catch (error) {
        renderError(error)
      }
    })

    const runButton = document.createElement('button')
    runButton.type = 'button'
    runButton.className = 'tab-card__button'
    runButton.dataset.requiresEnabled = 'true'
    runButton.textContent = tab.id === lastStatus?.activeMatchedTabId
      ? 'Run current tab'
      : 'Run tab'
    runButton.addEventListener('click', async () => {
      try {
        const status = await withBusy('Running tab...', () =>
          request('run-tab', { tabId: tab.id }))
        renderStatus(status, { announceStatus: true })
        announce(`${normalizeTitle(tab.title)} checked. ${status.lastResult}.`)
      } catch (error) {
        renderError(error)
      }
    })

    body.append(title, url, meta)
    actions.append(focusButton, runButton)

    const tabState = describeTabState(tab)
    badge.textContent = tabState.label
    item.dataset.state = tabState.state
    item.append(body, badge, actions)
    matchList.appendChild(item)
  })

  updateUiState()
}

function formatLastStats(status) {
  if (status.isRunning) {
    const scopeText = status.lastScope === 'single-tab'
      ? 'Checking the selected tab'
      : 'Checking matching tabs'
    const triggerText = status.currentTrigger
      ? ` via ${formatTrigger(status.currentTrigger)}`
      : ''
    const queuedText = status.queuedRunCount
      ? ` · ${status.queuedRunCount} queued`
      : ''
    return `${scopeText}${triggerText}${queuedText}`
  }

  if (!status.lastRunAt) return 'No checks yet'
  if (status.lastState === 'paused') return 'Paused'

  const matched = Number(status.lastMatchedCount || 0)
  const success = Number(status.lastSuccessCount || 0)
  const failure = Number(status.lastFailureCount || 0)
  const trigger = status.lastTrigger ? ` via ${formatTrigger(status.lastTrigger)}` : ''

  if (status.lastScope === 'single-tab') {
    return `${success} ok · ${failure} failed · selected tab${trigger}`
  }

  if (!matched) return `0 tabs checked${trigger}`
  return `${success} ok · ${failure} failed · ${matched} checked${trigger}`
}

function renderDetails(details) {
  const normalizedDetails = Array.isArray(details)
    ? details.filter((detail) => typeof detail === 'string')
    : []

  detailsList.innerHTML = ''

  if (!normalizedDetails.length) {
    const item = document.createElement('li')
    item.className = 'empty'
    item.textContent = 'No diagnostics yet'
    detailsList.appendChild(item)
    return
  }

  normalizedDetails.forEach((detail) => {
    const item = document.createElement('li')
    item.textContent = detail
    detailsList.appendChild(item)
  })
}

function getStateLabel(status) {
  if (status.isRunning) return 'Running'
  if (!status.enabled) return 'Off'
  return 'On'
}

function buildStatusAnnouncement(status) {
  const parts = [
    `Keepalive ${status.enabled ? 'on' : 'off'}.`,
  ]

  if (status.isRunning) {
    parts.push(status.lastScope === 'single-tab'
      ? 'A selected tab is being checked.'
      : 'Matching tabs are being checked.')
  } else {
    parts.push(`${status.matchedCount} page${status.matchedCount === 1 ? '' : 's'} matched.`)
  }

  if (status.lastResult) {
    parts.push(`Last result: ${status.lastResult}.`)
  }

  return parts.join(' ')
}

function renderStatus(status, options = {}) {
  lastStatus = status
  enabledInput.checked = status.enabled
  intervalInput.value = status.intervalMinutes
  stateText.textContent = getStateLabel(status)
  matchCount.textContent = String(status.matchedCount)
  lastRun.textContent = formatDate(status.lastRunAt)
  lastResult.textContent = status.lastResult || 'Idle'
  lastStats.textContent = formatLastStats(status)
  renderDetails(status.lastDetails || [])
  renderMatches(status.matchedTabs || [])
  updateUiState()

  if (options.announceStatus) {
    announce(buildStatusAnnouncement(status))
  }
}

function renderError(error) {
  console.error('Shawnigan Keepalive popup request failed', error)

  if (lastStatus) {
    renderStatus(lastStatus)
  } else {
    updateUiState()
  }

  lastStats.textContent = 'Refresh failed'
  lastResult.textContent = error?.message || 'Unexpected error'
  renderDetails([error?.message || 'Unexpected error'])
  announce(`Refresh failed. ${error?.message || 'Unexpected error'}`)
}

async function request(type, payload) {
  const response = await chrome.runtime.sendMessage({ type, payload })

  if (!response?.ok) {
    throw new Error(response?.error || 'Request failed')
  }

  return response.data
}

async function withBusy(label, task) {
  controlsLocked = true
  busyLabel = label
  updateUiState()

  try {
    return await task()
  } finally {
    controlsLocked = false
    busyLabel = ''
    updateUiState()
  }
}

async function refresh(options = {}) {
  if (refreshInFlight) {
    refreshQueued = true
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    updateUiState()

    try {
      const status = await request('get-status')
      renderStatus(status, options)
    } catch (error) {
      renderError(error)
    } finally {
      refreshInFlight = null
      updateUiState()

      if (refreshQueued) {
        refreshQueued = false
        scheduleRefresh(0)
      }
    }
  })()

  return refreshInFlight
}

function scheduleRefresh(delay = 200) {
  if (scheduledRefresh) return

  scheduledRefresh = window.setTimeout(() => {
    scheduledRefresh = null
    refresh().catch(() => {})
  }, delay)
}

enabledInput.addEventListener('change', async () => {
  try {
    const status = await withBusy(enabledInput.checked ? 'Turning on...' : 'Turning off...', () =>
      request('save-settings', { enabled: enabledInput.checked }))
    renderStatus(status, { announceStatus: true })
  } catch (error) {
    renderError(error)
  }
})

intervalInput.addEventListener('change', async () => {
  try {
    const status = await withBusy('Saving interval...', () =>
      request('save-settings', { intervalMinutes: intervalInput.value }))
    renderStatus(status, { announceStatus: true })
  } catch (error) {
    renderError(error)
  }
})

runNowButton.addEventListener('click', async () => {
  try {
    const status = await withBusy('Running now...', () => request('run-now'))
    renderStatus(status, { announceStatus: true })
  } catch (error) {
    renderError(error)
  }
})

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    scheduleRefresh(0)
  }
})

window.addEventListener('beforeunload', () => {
  if (!scheduledRefresh) return
  window.clearTimeout(scheduledRefresh)
  scheduledRefresh = null
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.settings) return
  scheduleRefresh()
})

chrome.tabs.onCreated.addListener(() => {
  scheduleRefresh()
})

chrome.tabs.onRemoved.addListener(() => {
  scheduleRefresh()
})

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (!Object.prototype.hasOwnProperty.call(changeInfo, 'url')
    && !Object.prototype.hasOwnProperty.call(changeInfo, 'discarded')
    && !Object.prototype.hasOwnProperty.call(changeInfo, 'title')) {
    return
  }

  scheduleRefresh()
})

chrome.tabs.onActivated.addListener(() => {
  scheduleRefresh()
})

chrome.tabs.onHighlighted.addListener(() => {
  scheduleRefresh()
})

updateUiState()
refresh({ announceStatus: true }).catch(() => {})
