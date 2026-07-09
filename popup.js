import {
  getHeroPresentation,
  getIntervalSelection,
  getStatusTone,
} from './lib/popup-presentation.mjs'

const enabledInput = document.getElementById('enabled')
const intervalControl = document.getElementById('intervalControl')
const intervalButtons = [...intervalControl.querySelectorAll('button[data-interval]')]
const intervalCustomHint = document.getElementById('intervalCustomHint')
const stateText = document.getElementById('heroStatusBadge')
const matchCount = document.getElementById('matchCount')
const lastRun = document.getElementById('lastRun')
const lastResult = document.getElementById('lastResult')
const lastStats = document.getElementById('lastStats')
const detailsList = document.getElementById('detailsList')
const matchList = document.getElementById('matchList')
const matchHint = document.getElementById('matchHint')
const runNowButton = document.getElementById('runNow')
const screenReaderStatus = document.getElementById('screenReaderStatus')
const hero = document.querySelector('.hero')
const heroSummary = document.getElementById('heroSummary')
const panel = document.querySelector('.panel')

let lastStatus = null
let scheduledRefresh = null
let refreshInFlight = null
let refreshQueued = false
let activeCommand = null
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
  if (!message || message === lastAnnouncement) return
  lastAnnouncement = message
  screenReaderStatus.textContent = message
}

function updateUiState() {
  const extensionRunning = Boolean(lastStatus?.isRunning)
  const isBusy = Boolean(refreshInFlight) || Boolean(activeCommand) || extensionRunning

  panel.setAttribute('aria-busy', String(isBusy))
  enabledInput.disabled = Boolean(activeCommand)

  intervalButtons.forEach((button) => {
    button.disabled = Boolean(activeCommand)
  })

  runNowButton.disabled = Boolean(activeCommand) || extensionRunning || !lastStatus?.enabled
  runNowButton.textContent = busyLabel || (extensionRunning ? 'Checking…' : 'Run now')

  matchList.querySelectorAll('.tab-card__button').forEach((button) => {
    const requiresEnabled = button.dataset.requiresEnabled === 'true'
    button.disabled = Boolean(activeCommand)
      || extensionRunning
      || (requiresEnabled && !lastStatus?.enabled)
  })
}

function describeTabState(tab) {
  if (tab.lastCheckStatus === 'ok') {
    return {
      label: tab.lastCheckedAt ? `Responded ${formatDate(tab.lastCheckedAt)}` : 'Responded',
      state: 'checked-ok',
    }
  }

  if (tab.lastCheckStatus === 'failed') {
    return { label: tab.lastCheckSummary || 'Needs attention', state: 'checked-failed' }
  }

  if (tab.active) return { label: 'Current page', state: 'current' }
  if (tab.discarded) return { label: 'Discarded page', state: 'discarded' }
  return { label: 'Matched page', state: 'matched' }
}

function formatUserStatus(userStatus) {
  if (!userStatus || typeof userStatus !== 'object') return null

  const parts = []
  if (typeof userStatus.minutesSinceActive === 'number') {
    parts.push(`idle ${Math.round(userStatus.minutesSinceActive)} min`)
  }
  if (typeof userStatus.tokenValid === 'boolean') {
    parts.push(userStatus.tokenValid ? 'token valid' : 'token invalid')
  }

  return parts.length ? parts.join(' · ') : null
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
    meta.textContent = [
      tab.lastCheckTrigger ? formatTrigger(tab.lastCheckTrigger) : null,
      formatUserStatus(tab.userStatus),
    ].filter(Boolean).join(' · ') || 'No recent check'

    const badge = document.createElement('span')
    badge.className = 'tab-card__badge'
    const tabState = describeTabState(tab)
    badge.textContent = tabState.label
    item.dataset.state = tabState.state

    const actions = document.createElement('div')
    actions.className = 'tab-card__actions'

    const focusButton = document.createElement('button')
    focusButton.type = 'button'
    focusButton.className = 'tab-card__button tab-card__button--secondary'
    focusButton.dataset.requiresEnabled = 'false'
    focusButton.textContent = 'Open page'
    focusButton.addEventListener('click', async () => {
      try {
        const command = await runCommand('Opening page…', () => request('focus-tab', { tabId: tab.id }))
        if (!command.started) return
        announce(`Opened ${normalizeTitle(tab.title)}.`)
      } catch (error) {
        renderError(error)
      }
    })

    const runButton = document.createElement('button')
    runButton.type = 'button'
    runButton.className = 'tab-card__button'
    runButton.dataset.requiresEnabled = 'true'
    runButton.textContent = tab.id === lastStatus?.activeMatchedTabId ? 'Check current' : 'Check page'
    runButton.addEventListener('click', async () => {
      try {
        const command = await runCommand('Checking page…', () => request('run-tab', { tabId: tab.id }))
        if (!command.started) return
        renderStatus(command.value, { announceStatus: true })
      } catch (error) {
        renderError(error)
      }
    })

    body.append(title, url, meta)
    actions.append(focusButton, runButton)
    item.append(body, badge, actions)
    matchList.appendChild(item)
  })

  updateUiState()
}

function formatLastStats(status) {
  if (status.isRunning) {
    return status.lastScope === 'single-tab'
      ? 'Checking the selected page'
      : 'Checking matching pages'
  }

  if (!status.lastRunAt) return 'No checks yet'
  if (status.lastState === 'paused') return 'Keepalive is paused'

  const matched = Number(status.lastMatchedCount || 0)
  const success = Number(status.lastSuccessCount || 0)
  const failure = Number(status.lastFailureCount || 0)
  const trigger = status.lastTrigger ? ` · ${formatTrigger(status.lastTrigger)}` : ''
  const smart = status.smartIntervalEnabled && status.lastSmartIntervalMinutes
    ? ` · next ${status.lastSmartIntervalMinutes} min`
    : ''

  return `${success} ok · ${failure} failed · ${matched} checked${trigger}${smart}`
}

function getHeroSummary(status, tone) {
  if (tone === 'running') return 'Checking matched Shawnigan pages'
  if (tone === 'muted') return 'Turn keepalive on when you are ready'
  if (tone === 'neutral') return 'Open a Shawnigan page to start watching'
  if (tone === 'warning') return status.lastResult || 'Review the last check'
  return `${status.matchedCount} matched page${status.matchedCount === 1 ? '' : 's'} are active`
}

function renderDetails(details) {
  const normalizedDetails = Array.isArray(details)
    ? details.filter((detail) => typeof detail === 'string')
    : []

  detailsList.innerHTML = ''
  const entries = normalizedDetails.length ? normalizedDetails : ['No diagnostics yet']
  entries.forEach((detail) => {
    const item = document.createElement('li')
    item.textContent = detail
    detailsList.appendChild(item)
  })
}

function renderInterval(status) {
  const selection = getIntervalSelection(status)
  intervalButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.interval === selection))
  })

  intervalCustomHint.hidden = selection !== 'custom'
  intervalCustomHint.textContent = selection === 'custom'
    ? `Custom: ${status.intervalMinutes} min`
    : ''
}

function buildStatusAnnouncement(status) {
  const state = getHeroPresentation(status)
  return `${state.label}. ${getHeroSummary(status, state.tone)}.`
}

function renderStatus(status, options = {}) {
  lastStatus = status
  enabledInput.checked = Boolean(status.enabled)

  const presentation = getHeroPresentation(status)
  hero.dataset.tone = getStatusTone(status)
  stateText.textContent = presentation.label
  heroSummary.textContent = getHeroSummary(status, presentation.tone)
  matchCount.textContent = String(status.matchedCount || 0)
  lastRun.textContent = formatDate(status.lastRunAt)
  lastResult.textContent = status.lastResult || 'Idle'
  lastStats.textContent = formatLastStats(status)
  renderInterval(status)
  renderDetails(status.lastDetails || [])
  renderMatches(status.matchedTabs || [])
  updateUiState()

  if (options.announceStatus) announce(buildStatusAnnouncement(status))
}

function renderError(error) {
  console.error('Shawnigan Keepalive popup request failed', error)
  if (lastStatus) renderStatus(lastStatus)

  lastStats.textContent = 'Refresh failed'
  lastResult.textContent = error?.message || 'Unexpected error'
  renderDetails([error?.message || 'Unexpected error'])
  announce(`Refresh failed. ${error?.message || 'Unexpected error'}`)
}

async function request(type, payload) {
  const response = await chrome.runtime.sendMessage({ type, payload })
  if (!response?.ok) throw new Error(response?.error || 'Request failed')
  return response.data
}

async function runCommand(label, task) {
  if (activeCommand) return { started: false }

  busyLabel = label
  activeCommand = Promise.resolve().then(task)
  updateUiState()

  try {
    return { started: true, value: await activeCommand }
  } finally {
    activeCommand = null
    busyLabel = ''
    updateUiState()

    if (refreshQueued) {
      refreshQueued = false
      scheduleRefresh(0)
    }
  }
}

async function refresh(options = {}) {
  if (activeCommand || refreshInFlight) {
    refreshQueued = true
    return activeCommand || refreshInFlight
  }

  refreshInFlight = (async () => {
    updateUiState()
    try {
      renderStatus(await request('get-status'), options)
    } catch (error) {
      renderError(error)
    } finally {
      refreshInFlight = null
      updateUiState()

      if (refreshQueued && !activeCommand) {
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
    const command = await runCommand(enabledInput.checked ? 'Turning on…' : 'Turning off…', () =>
      request('save-settings', { enabled: enabledInput.checked }))
    if (command.started) renderStatus(command.value, { announceStatus: true })
  } catch (error) {
    renderError(error)
  }
})

intervalButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const value = button.dataset.interval
    try {
      const command = await runCommand('Saving interval…', () => request('save-settings', value === 'smart'
        ? { smartIntervalEnabled: true }
        : { smartIntervalEnabled: false, intervalMinutes: Number(value) }))
      if (command.started) renderStatus(command.value, { announceStatus: true })
    } catch (error) {
      renderError(error)
    }
  })
})

runNowButton.addEventListener('click', async () => {
  try {
    const command = await runCommand('Checking now…', () => request('run-now'))
    if (command.started) renderStatus(command.value, { announceStatus: true })
  } catch (error) {
    renderError(error)
  }
})

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleRefresh(0)
})

window.addEventListener('beforeunload', () => {
  if (!scheduledRefresh) return
  window.clearTimeout(scheduledRefresh)
  scheduledRefresh = null
})

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.settings) scheduleRefresh()
})

chrome.tabs.onCreated.addListener(() => scheduleRefresh())
chrome.tabs.onRemoved.addListener(() => scheduleRefresh())
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (['url', 'discarded', 'title'].some((key) => Object.hasOwn(changeInfo, key))) scheduleRefresh()
})
chrome.tabs.onActivated.addListener(() => scheduleRefresh())
chrome.tabs.onHighlighted.addListener(() => scheduleRefresh())

updateUiState()
refresh({ announceStatus: true }).catch(() => {})
