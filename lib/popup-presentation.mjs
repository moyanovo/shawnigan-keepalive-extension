export function getStatusTone(status = {}) {
  if (status.isRunning) return 'running'
  if (!status.enabled) return 'muted'
  if (!status.matchedCount) return 'neutral'
  if (status.lastState === 'warning' || status.lastState === 'error') return 'warning'
  return 'healthy'
}

export function getHeroPresentation(status = {}) {
  const tone = getStatusTone(status)
  const labels = {
    running: 'Checking now',
    muted: 'Paused',
    neutral: 'No pages open',
    warning: 'Needs attention',
    healthy: 'Protected',
  }

  return { label: labels[tone], tone }
}

export function getIntervalSelection(status = {}) {
  if (status.smartIntervalEnabled) return 'smart'

  const interval = String(status.intervalMinutes)
  return ['5', '15', '30'].includes(interval) ? interval : 'custom'
}
