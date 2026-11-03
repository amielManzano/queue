import test from 'node:test'
import assert from 'node:assert/strict'

import { findPlayerByName, mergeDuplicatePlayers } from './players.js'

test('findPlayerByName ignores case and extra spaces', () => {
  const players = [{ id: 'a', name: 'Melvin' }]
  assert.equal(findPlayerByName(players, '  melvin ')?.id, 'a')
  assert.equal(findPlayerByName(players, 'Melvin', 'a'), null)
})

test('mergeDuplicatePlayers returns null when names are unique', () => {
  assert.equal(mergeDuplicatePlayers({ players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }), null)
})

test('mergeDuplicatePlayers folds the duplicate into the original player', () => {
  const merged = mergeDuplicatePlayers({
    players: [
      { id: 'orig', name: 'Melvin', skillLevel: 4, wins: 2, losses: 1, gamesPlayed: 3, points: 50 },
      { id: 'x', name: 'Other', wins: 0, losses: 0, gamesPlayed: 0, points: 0 },
      { id: 'dup', name: 'melvin', skillLevel: 3, wins: 1, losses: 1, gamesPlayed: 2, points: 30 }
    ],
    games: [{ id: 'g1', teamA: ['dup'], teamB: ['x'] }],
    matchQueue: [{ id: 'm1', teamA: ['dup'], teamB: ['x'] }],
    courts: [{ id: 'c1', teamA: ['dup'], teamB: [] }],
    queue: [{ id: 'orig', queuedAt: 1 }, { id: 'dup', queuedAt: 2 }, { id: 'x', queuedAt: 3 }]
  })

  assert.deepEqual(merged.players.map((p) => p.id), ['orig', 'x'])
  assert.deepEqual(
    merged.players[0],
    { id: 'orig', name: 'Melvin', skillLevel: 4, wins: 3, losses: 2, gamesPlayed: 5, points: 80 }
  )
  assert.deepEqual(merged.games[0].teamA, ['orig'])
  assert.deepEqual(merged.matchQueue[0].teamA, ['orig'])
  assert.deepEqual(merged.courts[0].teamA, ['orig'])
  assert.deepEqual(merged.queue.map((entry) => entry.id), ['orig', 'x'])
})
