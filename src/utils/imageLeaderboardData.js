const imageSessions = [
  {
    date: '2026-09-05',
    players: [
      ['Melvin', 5, 0, 5, 155], ['Aem', 3, 0, 3, 93], ['Earl', 3, 2, 5, 139],
      ['Shai', 3, 2, 5, 129], ['James', 3, 2, 5, 127], ['Charles', 2, 3, 5, 133],
      ['Norimar', 2, 3, 5, 130], ['Jonas', 1, 4, 5, 138], ['Luz', 1, 4, 5, 126],
      ['Riz', 1, 4, 5, 114]
    ]
  },
  {
    date: '2026-09-09',
    players: [
      ['Jonas', 3, 1, 4, 244], ['Norimar', 2, 1, 3, 211], ['Melvin', 2, 2, 4, 265],
      ['Shai', 2, 2, 4, 233], ['Luz', 2, 2, 4, 219], ['Aem', 1, 0, 1, 124],
      ['Earl', 1, 3, 4, 247], ['Faye', 1, 3, 4, 117]
    ]
  },
  {
    date: '2026-09-12',
    players: [
      ['Melvin', 4, 0, 4, 94], ['Earl', 3, 1, 4, 99], ['Takayuki', 3, 1, 4, 85],
      ['Hayate', 3, 1, 4, 75], ['Faye', 3, 2, 5, 114], ['Misaki', 2, 1, 3, 71],
      ['Yuki', 2, 2, 4, 100], ['Riz', 2, 2, 4, 96], ['Rino', 2, 2, 4, 91],
      ['Mizuki', 2, 2, 4, 89], ['Sumire', 2, 2, 4, 70], ['Shai', 2, 3, 5, 118],
      ['Luz', 2, 3, 5, 104], ['Jonas', 0, 5, 5, 100], ['Tomoya', 0, 5, 5, 98]
    ]
  },
  {
    date: '2026-09-25',
    players: [
      ['Nard', 5, 0, 5, 149], ['Melvin', 5, 1, 6, 155], ['Earl', 4, 1, 5, 122],
      ['James', 4, 2, 6, 155], ['Norimar', 3, 2, 5, 127], ['Luz', 3, 2, 5, 118],
      ['Mizuki', 2, 3, 5, 124], ['Mich', 2, 3, 5, 119], ['Misaki', 2, 3, 5, 118],
      ['Katrina', 2, 3, 5, 117], ['Yuki', 2, 3, 5, 113], ['Tomoya', 2, 3, 5, 101],
      ['Ira', 1, 3, 4, 94], ['Rino', 1, 4, 5, 89], ['Jonas', 0, 5, 5, 113]
    ]
  },
  {
    date: '2026-09-30',
    players: [
      ['Shai', 5, 1, 6, 173], ['Red', 4, 1, 5, 148], ['Nard', 4, 1, 5, 132],
      ['Mich', 4, 1, 5, 124], ['Aem', 3, 0, 3, 93], ['Jonas', 3, 2, 5, 112],
      ['Charles', 3, 3, 6, 157], ['Earl', 3, 3, 6, 148], ['Melvin', 3, 3, 6, 143],
      ['Mikay', 3, 1, 4, 110], ['Ira', 2, 4, 6, 144], ['James', 2, 4, 6, 144],
      ['Norimar', 1, 4, 5, 129], ['Rino', 1, 5, 6, 140], ['Riz', 0, 6, 6, 127]
    ]
  }
]

export const imageLeaderboardSourceCount = imageSessions.length

const playersByName = new Map()
imageSessions.forEach(({ players }) => {
  players.forEach(([name, wins, losses, gamesPlayed, points]) => {
    const id = name.trim().toLowerCase()
    const player = playersByName.get(id) || {
      id,
      name,
      wins: 0,
      losses: 0,
      gamesPlayed: 0,
      points: 0,
      skillLevel: null
    }
    player.wins += wins
    player.losses += losses
    player.gamesPlayed += gamesPlayed
    player.points += points
    playersByName.set(id, player)
  })
})

export const imageLeaderboardPlayers = [...playersByName.values()].sort((a, b) => a.name.localeCompare(b.name))
