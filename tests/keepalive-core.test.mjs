import test from 'node:test'
import assert from 'node:assert/strict'

import {
  annotateTabsWithLastStatus,
  buildLastDetails,
  getBadgePresentation,
  getSmartIntervalMinutes,
  isLikelyAuthenticationUrl,
  mapWithConcurrency,
  normalizeSettings,
  normalizeUserStatusSnapshot,
  prioritizeTabsForPing,
} from '../lib/keepalive-core.mjs'

test('normalizeSettings keeps only supported fields and validates running trigger', () => {
  const settings = normalizeSettings({
    enabled: false,
    intervalMinutes: 240,
    isRunning: true,
    currentTrigger: 'alarm',
    lastState: 'warning',
    lastRunAt: '2026-03-27T12:00:00.000Z',
    lastDetails: ['one', 2, 'two', 'three', 'four'],
    extraField: 'ignored',
  })

  assert.equal(settings.enabled, false)
  assert.equal(settings.intervalMinutes, 120)
  assert.equal(settings.isRunning, true)
  assert.equal(settings.currentTrigger, 'alarm')
  assert.equal(settings.lastState, 'warning')
  assert.deepEqual(settings.lastDetails, ['one', 'two', 'three', 'four'])
  assert.equal('extraField' in settings, false)
})


test('isLikelyAuthenticationUrl flags redirected sign-in destinations', () => {
  assert.equal(isLikelyAuthenticationUrl('https://shawnigan.myschoolapp.com/app#login'), true)
  assert.equal(isLikelyAuthenticationUrl('https://signin.blackbaud.com/oauth2/authorize'), true)
  assert.equal(isLikelyAuthenticationUrl('https://shawnigan.myschoolapp.com/app/student'), false)
  assert.equal(isLikelyAuthenticationUrl('https://shawnigan.myschoolapp.com/'), false)
})

test('buildLastDetails summarizes only the first failures and keeps the target URL', () => {
  const details = buildLastDetails('manual', 5, [
    { ok: false, title: 'Tab 1', error: 'Timed out' },
    { ok: false, title: 'Tab 2', status: 500 },
    { ok: false, title: 'Tab 3', error: 'No response' },
    { ok: false, title: 'Tab 4', error: 'Blocked' },
  ])

  assert.deepEqual(details, [
    'Tab 1: Timed out',
    'Tab 2: HTTP 500',
    'Tab 3: No response',
    'Plus 1 more failed tab.',
    'Target URL: https://shawnigan.myschoolapp.com/',
  ])
})

test('prioritizeTabsForPing puts active non-discarded tabs first', () => {
  const ordered = prioritizeTabsForPing([
    { id: 4, active: false, discarded: true },
    { id: 3, active: false, discarded: false },
    { id: 2, active: true, discarded: true },
    { id: 1, active: true, discarded: false },
  ])

  assert.deepEqual(ordered.map((tab) => tab.id), [1, 2, 3, 4])
})

test('mapWithConcurrency preserves order while limiting parallel work', async () => {
  let inFlight = 0
  let maxInFlight = 0

  const results = await mapWithConcurrency([1, 2, 3, 4], 2, async (value) => {
    inFlight += 1
    maxInFlight = Math.max(maxInFlight, inFlight)

    await new Promise((resolve) => setTimeout(resolve, 5))

    inFlight -= 1
    return value * 10
  })

  assert.deepEqual(results, [10, 20, 30, 40])
  assert.equal(maxInFlight, 2)
})

test('annotateTabsWithLastStatus and badge presentation reflect health state', () => {
  const tabs = annotateTabsWithLastStatus([
    { id: 12, title: 'Parent', url: 'https://shawnigan.myschoolapp.com/', active: true, discarded: false },
  ], [
    {
      tabId: 12,
      ok: false,
      summary: 'HTTP 500',
      checkedAt: '2026-03-27T12:15:00.000Z',
      trigger: 'manual',
      statusCode: 500,
    },
  ])

  assert.equal(tabs[0].lastCheckStatus, 'failed')
  assert.equal(tabs[0].lastCheckSummary, 'HTTP 500')

  const badge = getBadgePresentation({
    enabled: true,
    isRunning: false,
    lastState: 'warning',
    lastFailureCount: 1,
    lastMatchedCount: 1,
  }, 1)

  assert.equal(badge.text, '!')
  assert.match(badge.title, /needs attention/i)
})


test('normalizeUserStatusSnapshot keeps only safe session timing fields', () => {
  const snapshot = normalizeUserStatusSnapshot({
    TokenValid: true,
    MinutesSinceActive: '7',
    AuthUsingBbid: true,
    CurrentVersion: '2026.04.27.6',
    UnreadMessageCount: 99,
    PersonalField: 'do not keep',
  })

  assert.deepEqual(snapshot, {
    tokenValid: true,
    minutesSinceActive: 7,
    authUsingBbid: true,
    currentVersion: '2026.04.27.6',
  })
})

test('getSmartIntervalMinutes tightens checks as the session approaches timeout', () => {
  assert.equal(getSmartIntervalMinutes([
    { userStatus: { tokenValid: true, minutesSinceActive: 2 } },
  ], 15), 3)

  assert.equal(getSmartIntervalMinutes([
    { userStatus: { tokenValid: true, minutesSinceActive: 7 } },
  ], 15), 3)

  assert.equal(getSmartIntervalMinutes([
    { userStatus: { tokenValid: true, minutesSinceActive: 9 } },
  ], 15), 1)

  assert.equal(getSmartIntervalMinutes([
    { userStatus: { tokenValid: true, minutesSinceActive: 4 } },
    { userStatus: { tokenValid: true, minutesSinceActive: 8 } },
  ], 15), 2)
})

test('getSmartIntervalMinutes falls back when readonly session status is unavailable', () => {
  assert.equal(getSmartIntervalMinutes([], 15), 15)
  assert.equal(getSmartIntervalMinutes([{ ok: true }], 12), 12)
  assert.equal(getSmartIntervalMinutes([{ userStatus: { tokenValid: false } }], 15), 1)
})
