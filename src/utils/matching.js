// Auto-match strategies:
// - 'longest': take the first 4 entries in queue (longest wait) then balance by skill
// - 'fewestGames': pick 4 players with the fewest games played (tie-break by queuedAt), then balance by skill
// `queue` should be the full queue array of entries: [{ id, queuedAt }, ...]
export function autoMatch(queue, players, strategy = 'fairRotation', games = []) {
  // `queue` is array of entries: { id, queuedAt }
  if (!Array.isArray(queue) || queue.length < 4) return null

  const byId = Object.fromEntries(players.map((p) => [p.id, p]))

  // Build candidate pool from queue entries (keep queuedAt for tie-breaks)
  const entries = queue.map((e) => ({ entry: e, player: byId[e.id] })).filter((x) => x.player)
  if (entries.length < 4) return null

  // Build partner/opponent counts from recent games
  const partnerCount = {}
  const opponentCount = {}
  const recentGames = Array.isArray(games) ? games.slice(-50) : []
  recentGames.forEach((g) => {
    const tA = g.teamA || []
    const tB = g.teamB || []
    // partners within same team
    const addPairs = (arr, map) => {
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          const key = `${arr[i]}|${arr[j]}`
          map[key] = (map[key] || 0) + 1
        }
      }
    }
    addPairs(tA, partnerCount)
    addPairs(tB, partnerCount)
    // opponents across teams
    for (const a of tA) for (const b of tB) {
      const key = `${a}|${b}`
      opponentCount[key] = (opponentCount[key] || 0) + 1
      const rev = `${b}|${a}`
      opponentCount[rev] = (opponentCount[rev] || 0) + 1
    }
  })

  const lastGamePlayers = new Set((recentGames[recentGames.length - 1] || { teamA: [], teamB: [] }).teamA.concat((recentGames[recentGames.length - 1] || { teamA: [], teamB: [] }).teamB || []))
  const playersWhoDidNotPlayLastGame = entries.filter(({ player }) => !lastGamePlayers.has(player.id))
  const rotationEntries = strategy === 'fairRotation' && playersWhoDidNotPlayLastGame.length >= 4
    ? playersWhoDidNotPlayLastGame
    : entries

  // Fair Rotation deliberately holds players from the last game when a fresh
  // group can be made. A 12-player pool still keeps combinations manageable.
  const poolLimit = Math.min(rotationEntries.length, strategy === 'fairRotation' ? 12 : 8)
  const pool = rotationEntries.slice(0, poolLimit).map((match) => ({ ...match.player, queuedAt: match.entry.queuedAt }))

  // helper: evaluate a 4-player combo
  const now = Date.now()
  function scoreCombo(combo, strat) {
    // combo: array of 4 player objects
    const gamesSum = combo.reduce((s, p) => s + (p.gamesPlayed || 0), 0)
    const waitSum = combo.reduce((s, p) => s + Math.max(0, now - (p.queuedAt || now)), 0)

    // partner repeats among the 4 (pairs within eventual teams will be counted later),
    // count any prior teammate occurrences among all pairs
    let partners = 0
    for (let i = 0; i < combo.length; i++) for (let j = i + 1; j < combo.length; j++) {
      const key = `${combo[i].id}|${combo[j].id}`
      partners += partnerCount[key] || 0
    }

    // opponents: count prior opponent pairings among possible cross-team pairs
    // We'll form teams by skill pairing: highest+lowest vs middle two
    const sorted = [...combo].sort((a, b) => b.skillLevel - a.skillLevel)
    const teamA = [sorted[0], sorted[3]]
    const teamB = [sorted[1], sorted[2]]
    let opponents = 0
    for (const a of teamA) for (const b of teamB) {
      const key = `${a.id}|${b.id}`
      opponents += opponentCount[key] || 0
    }

    const skillA = teamA.reduce((s, p) => s + (p.skillLevel || 0), 0)
    const skillB = teamB.reduce((s, p) => s + (p.skillLevel || 0), 0)
    const skillDiff = Math.abs(skillA - skillB)

    const consecutive = combo.reduce((c, p) => c + (lastGamePlayers.has(p.id) ? 1 : 0), 0)

    // base score (lower is better)
    let score = 0

    if (strat === 'fairRotation') {
      score += gamesSum * 10          // prefer players with fewer games
      score -= waitSum / 1000 * 2     // reward waiting, without overpowering matchup variety
      score += partners * 900         // strongly avoid repeating player groups and teammates
      score += opponents * 450        // strongly avoid familiar opponents
      score += skillDiff * 12         // retain skill balance
      score += consecutive * 2000     // only used when a fresh group cannot be formed
    } else if (strat === 'balancedSkill') {
      score += skillDiff * 12         // prioritize skill balance
      score += gamesSum * 4           // prefer fewest games
      score -= waitSum / 1000 * 3     // consider waiting time
      score += partners * 25
      score += opponents * 20
      score += consecutive * 150
    } else if (strat === 'random') {
      score += Math.random() * 1000
      score += partners * 20
      score += opponents * 15
      score += consecutive * 300
    } else {
      // fallback similar to fairRotation
      score += gamesSum * 5
      score -= waitSum / 1000 * 4
      score += partners * 30
      score += opponents * 20
      score += skillDiff * 8
      score += consecutive * 180
    }

    return { score, teamA: teamA.map((p) => p.id), teamB: teamB.map((p) => p.id) }
  }

  // generate combos of 4 from pool
  const combos = []
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        for (let l = k + 1; l < pool.length; l++) {
          combos.push([pool[i], pool[j], pool[k], pool[l]])
        }
      }
    }
  }

  let best = null
  for (const combo of combos) {
    const result = scoreCombo(combo, strategy)
    if (!best || result.score < best.score) best = result
  }

  if (!best) {
    // fallback: take first 4
    const first4 = entries.slice(0, 4).map((m) => m.player)
    const sorted = [...first4].sort((a, b) => b.skillLevel - a.skillLevel)
    return {
      teamA: [sorted[0].id, sorted[3].id],
      teamB: [sorted[1].id, sorted[2].id]
    }
  }

  return { teamA: best.teamA, teamB: best.teamB }
}

export function skillLabel(level) {
  return ['', 'Beginner', 'Novice', 'Intermediate', 'Advanced', 'Open/Pro'][level] || 'Unranked'
}
