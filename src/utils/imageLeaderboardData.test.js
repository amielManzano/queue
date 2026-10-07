import test from 'node:test'
import assert from 'node:assert/strict'
import { imageLeaderboardPlayers, imageLeaderboardSourceCount } from './imageLeaderboardData.js'

test('image leaderboard import includes only the five supplied September images', () => {
  assert.equal(imageLeaderboardSourceCount, 5)
  assert.equal(imageLeaderboardPlayers.length, 25)
  assert.deepEqual(
    imageLeaderboardPlayers.find((player) => player.id === 'nard'),
    {
      id: 'nard',
      name: 'Nard',
      wins: 9,
      losses: 1,
      gamesPlayed: 10,
      points: 281,
      skillLevel: null
    }
  )
  assert.deepEqual(
    imageLeaderboardPlayers.find((player) => player.id === 'melvin'),
    {
      id: 'melvin',
      name: 'Melvin',
      wins: 19,
      losses: 6,
      gamesPlayed: 25,
      points: 812,
      skillLevel: null
    }
  )
  assert.deepEqual(
    imageLeaderboardPlayers.find((player) => player.id === 'shai'),
    {
      id: 'shai',
      name: 'Shai',
      wins: 12,
      losses: 8,
      gamesPlayed: 20,
      points: 653,
      skillLevel: null
    }
  )
})

test('every imported player has game totals consistent with wins and losses', () => {
  imageLeaderboardPlayers.forEach((player) => {
    assert.equal(player.gamesPlayed, player.wins + player.losses, player.name)
  })
})
