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

let lastStatus = null
let scheduledRefresh = null
let refreshInFlight = null
let refreshQueued = false

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

function renderMatches(tabs) {
  matchList.innerHTML = ''
  matchHint.textContent = `${tabs.length} page${tabs.length === 1 ? '' : 's'}`

  if (!tabs.length) {
    const item = document.createElement('li')
    item.className = 'empty'
    item.textContent = 'No matching Shawnigan pages open'
    matchList.appendChild(item)
    return
  }

  tabs.forEach((tab) => {
    const item = document.createElement('li')
    const title = document.createElement('strong')
    const url = document.createElement('span')
    const meta = document.createElement('span')

    title.textContent = tab.active ? `${tab.title} - active` : tab.title
    url.textContent = tab.url
    meta.textContent = `tab ${tab.id} · window ${tab.windowId}${tab.discarded ? ' · discarded' : ''}`

    item.append(title, url, meta)
    matchList.appendChild(item)
  })
}

function formatTrigger(trigger) {
  return trigger === 'alarm' ? 'scheduled run' : 'manual run'
}

function formatLastStats(status) {
  if (!status.lastRunAt) return 'No checks yet'
  if (status.lastResult === 'Paused') return 'Paused'

  const matched = Number(status.lastMatchedCount || 0)
  const success = Number(status.lastSuccessCount || 0)
  const failure = Number(status.lastFailureCount || 0)
  const trigger = status.lastTrigger ? ` via ${formatTrigger(status.lastTrigger)}` : ''

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

function renderStatus(status) {
  lastStatus = status
  enabledInput.checked = status.enabled
  intervalInput.value = status.intervalMinutes
  stateText.textContent = status.enabled ? 'On' : 'Off'
  matchCount.textContent = String(status.matchedCount)
  lastRun.textContent = formatDate(status.lastRunAt)
  lastResult.textContent = status.lastResult || 'Idle'
  lastStats.textContent = formatLastStats(status)
  runNowButton.disabled = !status.enabled
  renderDetails(status.lastDetails || [])
  renderMatches(status.matchedTabs || [])
}

function renderError(error) {
  console.error('Shawnigan Keepalive popup request failed', error)

  if (lastStatus) {
    renderStatus(lastStatus)
  }

  lastStats.textContent = 'Refresh failed'
  lastResult.textContent = error?.message || 'Unexpected error'
  renderDetails([error?.message || 'Unexpected error'])
}

async function request(type, payload) {
  const response = await chrome.runtime.sendMessage({ type, payload })

  if (!response?.ok) {
    throw new Error(response?.error || 'Request failed')
  }

  return response.data
}

async function refresh() {
  if (refreshInFlight) {
    refreshQueued = true
    return refreshInFlight
  }

  refreshInFlight = (async () => {
    try {
      renderStatus(await request('get-status'))
    } catch (error) {
      renderError(error)
    } finally {
      refreshInFlight = null

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
    renderStatus(await request('save-settings', { enabled: enabledInput.checked }))
  } catch (error) {
    renderError(error)
  }
})

intervalInput.addEventListener('change', async () => {
  try {
    renderStatus(await request('save-settings', { intervalMinutes: intervalInput.value }))
  } catch (error) {
    renderError(error)
  }
})

runNowButton.addEventListener('click', async () => {
  runNowButton.disabled = true

  try {
    renderStatus(await request('run-now'))
  } catch (error) {
    renderError(error)
  } finally {
    if (lastStatus) {
      runNowButton.disabled = !lastStatus.enabled
    }
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

refresh().catch(() => {})
