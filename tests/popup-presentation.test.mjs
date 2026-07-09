import test from 'node:test'
import assert from 'node:assert/strict'

import {
  getHeroPresentation,
  getIntervalSelection,
  getStatusTone,
} from '../lib/popup-presentation.mjs'

test('presentation prioritizes running, paused, empty, warning, and healthy states', () => {
  assert.deepEqual(getHeroPresentation({ isRunning: true, enabled: true }), {
    label: 'Checking now',
    tone: 'running',
  })
  assert.equal(getHeroPresentation({ enabled: false }).label, 'Paused')
  assert.equal(getHeroPresentation({ enabled: true, matchedCount: 0 }).label, 'No pages open')
  assert.equal(getHeroPresentation({ enabled: true, matchedCount: 1, lastState: 'warning' }).label, 'Needs attention')
  assert.equal(getHeroPresentation({ enabled: true, matchedCount: 1, lastState: 'healthy' }).label, 'Protected')
})

test('presentation exposes smart, supported fixed, and custom intervals', () => {
  assert.equal(getIntervalSelection({ smartIntervalEnabled: true, intervalMinutes: 15 }), 'smart')
  assert.equal(getIntervalSelection({ smartIntervalEnabled: false, intervalMinutes: 5 }), '5')
  assert.equal(getIntervalSelection({ smartIntervalEnabled: false, intervalMinutes: 120 }), 'custom')
  assert.equal(getStatusTone({ enabled: false }), 'muted')
})
