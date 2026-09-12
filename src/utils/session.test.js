import test from 'node:test'
import assert from 'node:assert/strict'

import { safelyExpirePublicSession } from './session.js'

test('safelyExpirePublicSession ignores missing tokens', async () => {
  let called = false
  await safelyExpirePublicSession(async () => {
    called = true
  }, '')

  assert.equal(called, false)
})

test('safelyExpirePublicSession suppresses stale-session expiration errors', async () => {
  let calls = 0

  await safelyExpirePublicSession(async () => {
    calls += 1
    throw new Error('permission denied')
  }, 'abc123')

  assert.equal(calls, 1)
})
