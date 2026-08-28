// Payment for each player = their share of the fixed court fee
// (split evenly across everyone who played in the session) plus
// their share of shuttles used in every game they personally played.
export function computePayments(players, games, courtFee) {
  const sessionPlayers = players.filter((p) => p.gamesPlayed > 0)
  const courtShare = sessionPlayers.length > 0 ? courtFee / sessionPlayers.length : 0

  const shuttleCostByPlayer = {}
  const shuttleCountByPlayer = {}
  for (const p of players) {
    shuttleCostByPlayer[p.id] = 0
    shuttleCountByPlayer[p.id] = 0
  }

  for (const g of games) {
    const recipients = [...g.teamA, ...g.teamB]
    const divisor = 4
    const perPlayerShuttleCost = (g.shuttlesUsed * g.shuttlePrice) / divisor
    const perPlayerShuttles = g.shuttlesUsed / divisor
    for (const pid of recipients) {
      shuttleCostByPlayer[pid] = (shuttleCostByPlayer[pid] || 0) + perPlayerShuttleCost
      shuttleCountByPlayer[pid] = (shuttleCountByPlayer[pid] || 0) + perPlayerShuttles
    }
  }

  return players.map((p) => {
    const played = p.gamesPlayed > 0
    const shuttleCost = shuttleCostByPlayer[p.id] || 0
    const court = played ? courtShare : 0
    return {
      ...p,
      courtShare: court,
      shuttleCost,
      shuttlesUsed: shuttleCountByPlayer[p.id] || 0,
      totalPayment: court + shuttleCost
    }
  })
}
