import React, { useEffect, useRef, useState } from 'react'
import SetupPanel from './components/SetupPanel.jsx'
import PlayersPanel from './components/PlayersPanel.jsx'
import QueueCourtsPanel from './components/QueueCourtsPanel.jsx'
import LeaderboardPanel from './components/LeaderboardPanel.jsx'
import { autoMatch } from './utils/matching.js'
import { createSession, listenToSession, saveSession } from './firebase.js'

const uid = () => Math.random().toString(36).slice(2, 10)

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

export default function App() {
  const [tab, setTab] = useState('setup')
  const [sessionId, setSessionId] = useState('')
  const [connected, setConnected] = useState(false)
  const [firebaseError, setFirebaseError] = useState('')
  const [state, setState] = useState(initialState)
  const [pendingMatch, setPendingMatch] = useState(null)
  const skipNextSave = useRef(false)

  const storageKey = (id) => `stp-session:${id}`

  const saveLocal = (id, data) => {
    try {
      localStorage.setItem(storageKey(id), JSON.stringify(data))
      localStorage.setItem('stp-last-session', id)
    } catch (err) {
      console.warn('Failed to save local session', err)
    }
  }

  const loadLocal = (id) => {
    try {
      const raw = localStorage.getItem(storageKey(id))
      return raw ? JSON.parse(raw) : null
    } catch (err) {
      return null
    }
  }

  const clearLocal = (id) => {
    try {
      if (id) localStorage.removeItem(storageKey(id))
      localStorage.removeItem('stp-last-session')
    } catch (err) {}
  }

  // Live sync: whenever local state changes (after connecting), push to Firebase.
  useEffect(() => {
    if (!connected) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    saveSession(sessionId, state).catch((err) => {
      console.error('Firebase save failed:', err)
      setFirebaseError('Live sync unavailable. Working locally.')
    })
    // Always persist locally as well so refresh restores state even if Firestore is blocked
    try { saveLocal(sessionId, state) } catch (e) {}
  }, [state, connected, sessionId])

  const connect = async (id) => {
    if (!id) return
    setSessionId(id)
    // If we have a local copy for this session, restore it immediately so refresh feels instant
    const local = loadLocal(id)
    if (local) setState({ ...local, queue: normalizeQueue(local.queue) })
    setFirebaseError('')
    try {
      await createSession(id, initialState)
    } catch (err) {
      console.error('Firebase createSession failed (will still work locally):', err)
      setFirebaseError('Live sync unavailable. Working locally.')
    }
    listenToSession(id, (remote) => {
      skipNextSave.current = true
      setState((s) => ({ ...s, ...remote, queue: normalizeQueue(remote.queue) }))
    }, (err) => {
      console.error('Firestore listener failed:', err)
      setFirebaseError('Live sync unavailable. Working locally.')
    })
    setConnected(true)
    setTab('players')
  }

  // Auto-reconnect to last session (if any) so refresh preserves session automatically
  useEffect(() => {
    const last = localStorage.getItem('stp-last-session')
    if (last && !sessionId) {
      connect(last)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearSession = () => {
    if (!sessionId) return
    if (!confirm('Clear local session data and leave session?')) return
    clearLocal(sessionId)
    setState(initialState)
    setSessionId('')
    setConnected(false)
    setTab('setup')
  }

  const update = (patch) => setState((s) => ({ ...s, ...patch }))

  // ── Players ────────────────────────────────────────────────
  const addPlayer = (name, skillLevel) => {
    const player = { id: uid(), name, skillLevel, wins: 0, losses: 0, gamesPlayed: 0 }
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

  const runAutoMatch = () => {
    const result = autoMatch(state.queue.map((entry) => entry.id), state.players)
    if (!result) return
    setPendingMatch({ teamA: result.teamA, teamB: result.teamB })
    update({ queue: state.queue.filter((entry) => !result.teamA.includes(entry.id) && !result.teamB.includes(entry.id)) })
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
  const assignPlayerToCourt = (courtId, playerId) => {
    const courts = state.courts.map((c) => {
      if (c.id !== courtId) return c
      const teamA = [...c.teamA]
      const teamB = [...c.teamB]
      if (teamA.length < 2) teamA.push(playerId)
      else if (teamB.length < 2) teamB.push(playerId)
      const status = teamA.length + teamB.length === 0 ? 'empty' : 'assigned'
      return { ...c, teamA, teamB, status }
    })
    update({ courts, queue: state.queue.filter((entry) => entry.id !== playerId) })
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

  const doneGame = (courtId, winner, shuttlesUsed) => {
    const court = state.courts.find((c) => c.id === courtId)
    if (!court) return

    const game = {
      id: uid(),
      courtId,
      teamA: court.teamA,
      teamB: court.teamB,
      winner,
      shuttlesUsed,
      shuttlePrice: state.shuttlePrice,
      timestamp: Date.now()
    }

    const winners = winner === 'A' ? court.teamA : court.teamB
    const losers = winner === 'A' ? court.teamB : court.teamA

    const players = state.players.map((p) => {
      if (winners.includes(p.id)) return { ...p, wins: p.wins + 1, gamesPlayed: p.gamesPlayed + 1 }
      if (losers.includes(p.id)) return { ...p, losses: p.losses + 1, gamesPlayed: p.gamesPlayed + 1 }
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
        <div>
          <h1>STP Badminton Queue</h1>
          <div className="sub">Skill-based matching · live courts · payment tracking</div>
        </div>
      </div>

      <div className="tabs">
        {['setup', 'players', 'queue', 'leaderboard'].map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'setup' ? 'Session' : t === 'queue' ? 'Queue & Courts' : t[0].toUpperCase() + t.slice(1)}
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
            sessionId={sessionId}
            connected={connected}
            onConnect={connect}
            courtFee={state.courtFee}
            shuttlePrice={state.shuttlePrice}
            numCourts={numCourts}
            onUpdateSettings={onUpdateSettings}
          />
        )}

        {tab === 'players' && (
          <PlayersPanel
            players={state.players}
            games={state.games}
            courtFee={state.courtFee}
            queue={state.queue}
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
            sessionId={sessionId}
          />
        )}
      </div>
    </div>
  )
}
