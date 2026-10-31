export const playerNameKey = (name = '') => name.trim().replace(/\s+/g, ' ').toLowerCase()

export function findPlayerByName(players, name, excludeId) {
  const key = playerNameKey(name)
  return players.find((player) => player.id !== excludeId && playerNameKey(player.name) === key) || null
}

// Folds players that share a name into the first-added one: stats are summed
// and every game, queue, match and court reference is pointed at the original.
export function mergeDuplicatePlayers(state) {
  const players = state.players || []
  const originalByKey = new Map()
  const replacedIds = new Map()

  players.forEach((player) => {
    const key = playerNameKey(player.name)
    if (!key) return
    const original = originalByKey.get(key)
    if (original) replacedIds.set(player.id, original.id)
    else originalByKey.set(key, player)
  })

  if (replacedIds.size === 0) return null

  const mergedPlayers = players
    .filter((player) => !replacedIds.has(player.id))
    .map((player) => {
      const duplicates = players.filter((item) => replacedIds.get(item.id) === player.id)
      if (duplicates.length === 0) return player
      const sum = (field) => duplicates.reduce((total, item) => total + (Number(item[field]) || 0), Number(player[field]) || 0)
      return {
        ...player,
        wins: sum('wins'),
        losses: sum('losses'),
        gamesPlayed: sum('gamesPlayed'),
        points: sum('points')
      }
    })

  const remap = (ids = []) => [...new Set(ids.map((id) => replacedIds.get(id) || id))]
  const remapTeams = (item) => ({ ...item, teamA: remap(item.teamA), teamB: remap(item.teamB) })
  const seenQueueIds = new Set()

  return {
    players: mergedPlayers,
    games: (state.games || []).map(remapTeams),
    matchQueue: (state.matchQueue || []).map(remapTeams),
    courts: (state.courts || []).map(remapTeams),
    queue: (state.queue || [])
      .map((entry) => ({ ...entry, id: replacedIds.get(entry.id) || entry.id }))
      .filter((entry) => {
        if (seenQueueIds.has(entry.id)) return false
        seenQueueIds.add(entry.id)
        return true
      })
  }
}
