import test from 'node:test'
import assert from 'node:assert/strict'

import { autoMatch, levelGroup } from './matching.js'

const player = (id, skillLevel) => ({ id, name: id, skillLevel, gamesPlayed: 0 })
const queueOf = (players) => players.map((p, index) => ({ id: p.id, queuedAt: 1000 + index }))
const matchedIds = (result) => [...result.teamA, ...result.teamB].sort()

test('levelGroup puts Beginner/Novice, Intermediate, and Advanced/Open-Pro together', () => {
  assert.equal(levelGroup(1), levelGroup(2))
  assert.equal(levelGroup(4), levelGroup(5))
  assert.notEqual(levelGroup(2), levelGroup(3))
  assert.notEqual(levelGroup(3), levelGroup(4))
  assert.equal(levelGroup(null), null)
})

test('sameLevel skips a mixed front of the queue to find one level group', () => {
  const players = [
    player('pro', 5),
    player('beginner1', 1),
    player('inter1', 3),
    player('novice1', 2),
    player('advanced', 4),
    player('inter2', 3),
    player('beginner2', 1),
    player('novice2', 2)
  ]

  const result = autoMatch(queueOf(players), players, 'sameLevel')

  assert.deepEqual(matchedIds(result), ['beginner1', 'beginner2', 'novice1', 'novice2'])
  // each team gets one Beginner and one Novice
  for (const team of [result.teamA, result.teamB]) {
    assert.deepEqual(team.map((id) => id.replace(/\d$/, '')).sort(), ['beginner', 'novice'])
  }
})

test('sameLevel looks past the first 8 queued players', () => {
  const players = [
    player('a1', 4), player('a2', 5), player('a3', 4),
    player('i1', 3), player('i2', 3), player('i3', 3),
    player('b1', 1), player('b2', 2),
    player('a4', 5)
  ]

  const result = autoMatch(queueOf(players), players, 'sameLevel')

  assert.deepEqual(matchedIds(result), ['a1', 'a2', 'a3', 'a4'])
})

test('sameLevel returns null instead of mixing levels', () => {
  const players = [
    player('b1', 1), player('n1', 2), player('n2', 2),
    player('i1', 3), player('i2', 3), player('i3', 3),
    player('a1', 4), player('p1', 5),
    player('unranked', null)
  ]

  assert.equal(autoMatch(queueOf(players), players, 'sameLevel'), null)
})
