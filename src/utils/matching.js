// Pulls the next 4 players off the front of the queue and splits
// them into two balanced doubles teams by skill level (1-5).
// The player who has waited longest is always included.
export function autoMatch(queue, players) {
  if (queue.length < 4) return null

  const byId = Object.fromEntries(players.map((p) => [p.id, p]))
  const next4Ids = queue.slice(0, 4)
  const pool = next4Ids.map((id) => byId[id]).filter(Boolean)
  if (pool.length < 4) return null

  // Sort by skill descending, pair highest+lowest together on
  // opposite teams so both teams end up close in total skill.
  const sorted = [...pool].sort((a, b) => b.skillLevel - a.skillLevel)
  const teamA = [sorted[0], sorted[3]]
  const teamB = [sorted[1], sorted[2]]

  return {
    teamA: teamA.map((p) => p.id),
    teamB: teamB.map((p) => p.id),
    remainingQueue: queue.slice(4)
  }
}

export function skillLabel(level) {
  return ['', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Open/Pro'][level] || 'Unranked'
}
