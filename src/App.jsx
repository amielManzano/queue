import React, { useEffect, useRef, useState } from 'react'
import SetupPanel from './components/SetupPanel.jsx'
import PlayersPanel from './components/PlayersPanel.jsx'
import QueueCourtsPanel from './components/QueueCourtsPanel.jsx'
import LeaderboardPanel from './components/LeaderboardPanel.jsx'
import { autoMatch } from './utils/matching.js'
import { fetchSession, listenToSession, saveSession } from './firebase.js'
import settingsIcon from './assets/settings.svg'
import logo from './assets/logo.png'


const uid = () => Math.random().toString(36).slice(2, 10)

// Single shared session for everyone using the app.
const SESSION_ID = 'stp-shared-session'
const STORAGE_KEY = 'stp-session-data'

function makeCourts(n, existing = []) {
  return Array.from({ length: n }, (_, i) => {
    const id = `court-${i + 1}`
    const prev = existing.find((c) => c.id === id)
    return (
      prev || {
        id,
        name: `Court ${i + 1}`,
        status: 'empty', // empty | assigned | playing
        teamA: [],
        teamB: []
      }
    )
  })
}

const normalizeQueue = (queue = []) =>
  queue.map((item, index) =>
    typeof item === 'string'
      ? { id: item, queuedAt: Date.now() - (queue.length - index) * 1000 }
      : item
  )

const initialState = {
  courtFee: 300,
  shuttlePrice: 100,
  numCourts: 2,
  players: [],
  queue: [],
  courts: makeCourts(2),
  games: []
}

// A doc counts as "real" data worth keeping if it has any players, a
// non-empty queue, games recorded, or any court that isn't empty.
// Used to decide whether local/remote data should win during reconciliation.
function hasRealData(data) {
  if (!data) return false
  return (
    (data.players && data.players.length > 0) ||
    (data.queue && data.queue.length > 0) ||
    (data.games && data.games.length > 0) ||
    (data.courts && data.courts.some((c) => c.status !== 'empty'))
  )
}

export default function App() {
  const [tab, setTab] = useState('players')
  const [connected, setConnected] = useState(false)
  const [firebaseError, setFirebaseError] = useState('')
  const [state, setState] = useState(initialState)
  const [pendingMatch, setPendingMatch] = useState(null)
  const skipNextSave = useRef(false)

  const saveLocal = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (err) {
      console.warn('Failed to save local session', err)
    }
  }

  const loadLocal = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : null
    } catch (err) {
      return null
    }
  }

  const clearLocal = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (err) {}
  }

  // Live sync: whenever local state changes AFTER the initial reconciliation
  // (connected === true), push to Firebase. Guarded so this can never fire
  // before we've resolved local vs. remote on load.
  useEffect(() => {
    if (!connected) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    saveSession(SESSION_ID, state).catch((err) => {
      console.error('Firebase save failed:', err)
      setFirebaseError('Live sync unavailable. Working locally.')
    })
    try { saveLocal(state) } catch (e) {}
  }, [state, connected])

  // Always persist locally on any state change so a refresh keeps data even when offline.
  useEffect(() => {
    try { saveLocal(state) } catch (e) {}
  }, [state])

  // Connect to the one shared session on mount. This runs the whole
  // reconciliation IN ORDER (pull remote -> decide -> maybe push -> THEN
  // start listening) so the live listener and the push-effect above can
  // never race a stale/empty snapshot against good local data.
  useEffect(() => {
    let unsubscribe = () => {}

    ;(async () => {
      const local = loadLocal()
      setFirebaseError('')

      try {
        const remote = await fetchSession(SESSION_ID)

        if (hasRealData(remote)) {
          // Remote already has real data — trust it as the shared source of truth.
          setState((s) => ({ ...s, ...remote, queue: normalizeQueue(remote.queue) }))
        } else if (hasRealData(local)) {
          // Remote is empty/missing but this browser has real local data
          // (e.g. an earlier sync never landed) — push it up instead of
          // silently letting it get overwritten by empty defaults.
          setState({ ...local, queue: normalizeQueue(local.queue) })
          await saveSession(SESSION_ID, local)
        } else if (remote) {
          // Remote exists but is empty defaults, and we have nothing local either.
          setState((s) => ({ ...s, ...remote, queue: normalizeQueue(remote.queue) }))
        } else {
          // Nothing anywhere yet — initialize the doc.
          await saveSession(SESSION_ID, initialState)
        }
      } catch (err) {
        console.error('Firebase initial sync failed (will still work locally):', err)
        setFirebaseError('Live sync unavailable. Working locally.')
        if (hasRealData(local)) {
          setState({ ...local, queue: normalizeQueue(local.queue) })
        }
      }

      // Only now, after reconciliation is settled, start listening for
      // changes from other clients and allow the push-effect to run.
      unsubscribe = listenToSession(SESSION_ID, (remote) => {
        skipNextSave.current = true
        setState((s) => ({ ...s, ...remote, queue: normalizeQueue(remote.queue) }))
      }, (err) => {
        console.error('Firestore listener failed:', err)
        setFirebaseError('Live sync unavailable. Working locally.')
      })

      setConnected(true)
    })()

    return () => unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearSession = () => {
    if (!confirm('Clear all session data for everyone? This cannot be undone.')) return
    clearLocal()
    setState(initialState)
    saveSession(SESSION_ID, initialState).catch((err) => {
      console.error('Failed to clear remote session:', err)
      setFirebaseError('Live sync unavailable. Working locally.')
    })
  }

  const update = (patch) => setState((s) => ({ ...s, ...patch }))

  // ── Players ────────────────────────────────────────────────
  const addPlayer = (name, skillLevel) => {
    const player = { id: uid(), name, skillLevel, wins: 0, losses: 0, gamesPlayed: 0, points: 0 }
    update({ players: [...state.players, player] })
  }
  const editSkill = (id, skillLevel) => {
    update({ players: state.players.map((p) => (p.id === id ? { ...p, skillLevel } : p)) })
  }
  const updatePlayer = (id, patch) => {
    update({ players: state.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  }
  const removePlayer = (id) => {
    update({
      players: state.players.filter((p) => p.id !== id),
      queue: state.queue.filter((qid) => qid !== id)
    })
  }

  // ── Queue ──────────────────────────────────────────────────
  const addToQueue = (id) => {
    if (state.queue.some((entry) => entry.id === id)) return
    update({ queue: [...state.queue, { id, queuedAt: Date.now() }] })
  }
  const removeFromQueue = (id) => update({ queue: state.queue.filter((entry) => entry.id !== id) })
  const reorderQueue = (id, dir) => {
    const q = [...state.queue]
    const i = q.findIndex((entry) => entry.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= q.length) return
    ;[q[i], q[j]] = [q[j], q[i]]
    update({ queue: q })
  }

  // Move a queue item to a specific index (used by drag-drop)
  const reorderQueueTo = (id, toIndex) => {
    const q = [...state.queue]
    const from = q.findIndex((entry) => entry.id === id)
    if (from < 0) return
    const [item] = q.splice(from, 1)
    const insertAt = Math.min(Math.max(0, toIndex), q.length)
    q.splice(insertAt, 0, item)
    update({ queue: q })
  }

  const runAutoMatch = (strategy = 'fairRotation') => {
    const result = autoMatch(state.queue, state.players, strategy, state.games)
    if (!result) return
    // find first empty court and assign directly
    const empty = state.courts.find((c) => c.status === 'empty')
    if (!empty) return
    const courts = state.courts.map((c) =>
      c.id === empty.id ? { ...c, status: 'assigned', teamA: result.teamA, teamB: result.teamB } : c
    )
    const newQueue = state.queue.filter((entry) => !result.teamA.includes(entry.id) && !result.teamB.includes(entry.id))
    update({ courts, queue: newQueue })
  }

  const clearPending = () => {
    if (!pendingMatch) return
    update({
      queue: [
        ...pendingMatch.teamA.map((playerId) => ({ id: playerId, queuedAt: Date.now() })),
        ...pendingMatch.teamB.map((playerId) => ({ id: playerId, queuedAt: Date.now() })),
        ...state.queue
      ]
    })
    setPendingMatch(null)
  }

  const swapPendingPlayer = (team, outId) => {
    if (state.queue.length === 0) return
    const inId = state.queue[0].id
    const restQueue = [
      { id: outId, queuedAt: Date.now() },
      ...state.queue.slice(1)
    ]
    const teamKey = team === 'A' ? 'teamA' : 'teamB'
    setPendingMatch({
      ...pendingMatch,
      [teamKey]: pendingMatch[teamKey].map((pid) => (pid === outId ? inId : pid))
    })
    update({ queue: restQueue })
  }

  // Assign a single player (from queue) to a court. If court already has players,
  // fill teamA then teamB. Removes the player from the queue.
  const assignPlayerToCourt = (courtId, playerId, team, idx) => {
    let displaced = null
    const courts = state.courts.map((c) => {
      if (c.id !== courtId) return c
      const teamA = [...c.teamA]
      const teamB = [...c.teamB]

      if (team === 'A' && (idx === 0 || idx === 1)) {
        displaced = teamA[idx]
        teamA[idx] = playerId
      } else if (team === 'B' && (idx === 0 || idx === 1)) {
        displaced = teamB[idx]
        teamB[idx] = playerId
      } else {
        // fallback: append to first available
        if (teamA.length < 2) teamA.push(playerId)
        else if (teamB.length < 2) teamB.push(playerId)
      }

      // remove duplicates across teams
      const uniqA = teamA.filter(Boolean).filter((id, i, arr) => arr.indexOf(id) === i)
      const uniqB = teamB.filter(Boolean).filter((id, i, arr) => arr.indexOf(id) === i)
      const status = uniqA.length + uniqB.length === 0 ? 'empty' : 'assigned'
      return { ...c, teamA: uniqA, teamB: uniqB, status }
    })

    const newQueue = state.queue.filter((entry) => entry.id !== playerId)
    if (displaced && displaced !== playerId) {
      newQueue.push({ id: displaced, queuedAt: Date.now() })
    }

    update({ courts, queue: newQueue })
  }

  // Remove a player from a court and put them back to the end of the queue
  const removePlayerFromCourt = (courtId, playerId) => {
    const courts = state.courts.map((c) => {
      if (c.id !== courtId) return c
      const teamA = c.teamA.filter((id) => id !== playerId)
      const teamB = c.teamB.filter((id) => id !== playerId)
      const status = teamA.length + teamB.length === 0 ? 'empty' : (c.status === 'playing' ? c.status : 'assigned')
      return { ...c, teamA, teamB, status }
    })
    update({ courts, queue: [...state.queue, { id: playerId, queuedAt: Date.now() }] })
  }

  const assignPendingToCourt = (courtId) => {
    if (!pendingMatch) return
    const courts = state.courts.map((c) =>
      c.id === courtId
        ? { ...c, status: 'assigned', teamA: pendingMatch.teamA, teamB: pendingMatch.teamB }
        : c
    )
    update({ courts })
    setPendingMatch(null)
  }

  // ── Courts ─────────────────────────────────────────────────
  const startGame = (courtId) => {
    update({
      courts: state.courts.map((c) =>
        c.id === courtId ? { ...c, status: 'playing', startedAt: Date.now() } : c
      )
    })
  }

  const doneGame = (courtId, winner, shuttlesUsed, teamAPoints, teamBPoints) => {
    const court = state.courts.find((c) => c.id === courtId)
    if (!court) return

    const game = {
      id: uid(),
      courtId,
      teamA: court.teamA,
      teamB: court.teamB,
      winner,
      teamAPoints: Math.max(0, Number(teamAPoints) || 0),
      teamBPoints: Math.max(0, Number(teamBPoints) || 0),
      shuttlesUsed,
      shuttlePrice: state.shuttlePrice,
      timestamp: Date.now()
    }

    const winners = winner === 'A' ? court.teamA : court.teamB
    const losers = winner === 'A' ? court.teamB : court.teamA
    const pointsA = Math.max(0, Number(teamAPoints) || 0)
    const pointsB = Math.max(0, Number(teamBPoints) || 0)

    const players = state.players.map((p) => {
      if (winners.includes(p.id)) {
        return {
          ...p,
          wins: p.wins + 1,
          gamesPlayed: p.gamesPlayed + 1,
          points: (p.points || 0) + (winner === 'A' ? pointsA : pointsB),
        }
      }
      if (losers.includes(p.id)) {
        return {
          ...p,
          losses: p.losses + 1,
          gamesPlayed: p.gamesPlayed + 1,
          points: (p.points || 0) + (winner === 'A' ? pointsB : pointsA),
        }
      }
      return p
    })

    const courts = state.courts.map((c) =>
      c.id === courtId ? { ...c, status: 'empty', teamA: [], teamB: [], startedAt: null } : c
    )

    update({
      games: [...state.games, game],
      players,
      courts,
      queue: [
        ...state.queue,
        ...court.teamA.map((playerId) => ({ id: playerId, queuedAt: Date.now() })),
        ...court.teamB.map((playerId) => ({ id: playerId, queuedAt: Date.now() }))
      ]
    })
  }

  const numCourts = state.numCourts
  const onUpdateSettings = (patch) => {
    if (patch.numCourts) {
      update({ ...patch, courts: makeCourts(patch.numCourts, state.courts) })
    } else {
      update(patch)
    }
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="logo">
          <img src={logo} alt="STP Badminton Queue" className="logo-icon" />
          <div className="center">
            <h1>Badminton Queue</h1>
            <div className="sub">Skill-based matching · live courts · payment tracking</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {['setup', 'players', 'queue', 'leaderboard'].map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
           {t === 'setup' ? (
  <img src={settingsIcon} alt="Settings" className="tab-icon" />
) : t === 'queue' ? (
  'Queue & Courts'
) : (
  t[0].toUpperCase() + t.slice(1)
)}
          </button>
        ))}
      </div>

      {firebaseError && (
        <div className="panel" style={{ border: '1px solid #f1c0c0', background: '#fff2f2', color: '#8d2a2a' }}>
          {firebaseError}
        </div>
      )}

      <div className="content">
        {tab === 'setup' && (
          <SetupPanel
            connected={connected}
            courtFee={state.courtFee}
            shuttlePrice={state.shuttlePrice}
            numCourts={numCourts}
            onUpdateSettings={onUpdateSettings}
            onClearSession={clearSession}
          />
        )}

        {tab === 'players' && (
          <PlayersPanel
            players={state.players}
            games={state.games}
            courtFee={state.courtFee}
            queue={state.queue}
            courts={state.courts}
            onAddPlayer={addPlayer}
            onEditSkill={editSkill}
            onRemovePlayer={removePlayer}
            onUpdatePlayer={updatePlayer}
            onAddToQueue={addToQueue}
          />
        )}

        {tab === 'queue' && (
          <QueueCourtsPanel
            players={state.players}
            queue={state.queue}
            courts={state.courts}
            pendingMatch={pendingMatch}
            shuttlePrice={state.shuttlePrice}
            onAutoMatch={runAutoMatch}
            onClearPending={clearPending}
            onReorderQueue={reorderQueue}
            onReorderQueueTo={reorderQueueTo}
            onRemoveFromQueue={removeFromQueue}
            onSwapPendingPlayer={swapPendingPlayer}
            onAssignPendingToCourt={assignPendingToCourt}
            onAssignPlayerToCourt={assignPlayerToCourt}
            onRemovePlayerFromCourt={removePlayerFromCourt}
            onStartGame={startGame}
            onDoneGame={doneGame}
          />
        )}

        {tab === 'leaderboard' && (
          <LeaderboardPanel
            players={state.players}
            sessionId={SESSION_ID}
          />
        )}
      </div>
      <footer>
        <span>© 2026 Aem Manzano · STP Badminton</span>
      </footer>
    </div>
  )
}