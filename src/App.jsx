import React, { useEffect, useRef, useState } from 'react'
import SetupPanel from './components/SetupPanel.jsx'
import PlayersPanel from './components/PlayersPanel.jsx'
import QueueCourtsPanel from './components/QueueCourtsPanel.jsx'
import LeaderboardPanel from './components/LeaderboardPanel.jsx'
import MatchHistoryPanel from './components/MatchHistoryPanel.jsx'
import LoginPanel from './components/LoginPanel.jsx'
import ClubsPanel from './components/ClubsPanel.jsx'
import { autoMatch } from './utils/matching.js'
import {
  fetchSession,
  listenToSession,
  saveSession,
  onAuthChange,
  logout,
  deleteAccount,
  isSuperAdmin,
  getUserProfile,
  claimAccessCodeForUser,
  takePendingSignupCode,
  createPublicSession,
  savePublicSession,
  fetchPublicSession,
  listenToPublicSession
} from './firebase.js'
import settingsIcon from './assets/settings.svg'
import logo1 from './assets/logo1.png'


const uid = () => Math.random().toString(36).slice(2, 10)

// Each signed-in user gets exactly one private session, keyed by their own
// uid, so different accounts can never see or overwrite each other's data.
const storageKey = (userId) => `stp-session-data:${userId}`
const publicTokenFromUrl = new URLSearchParams(window.location.search).get('public')

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
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authChecking, setAuthChecking] = useState(false)
  const [authError, setAuthError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [tab, setTab] = useState('players')
  const [connected, setConnected] = useState(false)
  const [firebaseError, setFirebaseError] = useState('')
  const [state, setState] = useState(initialState)
  const [pendingMatch, setPendingMatch] = useState(null)
  const [publicSession, setPublicSession] = useState(null)
  const [publicLoading, setPublicLoading] = useState(Boolean(publicTokenFromUrl))
  const [publicTab, setPublicTab] = useState('queue')
  const skipNextSave = useRef(false)

  useEffect(() => {
    if (!publicTokenFromUrl) return
    return listenToPublicSession(publicTokenFromUrl, (next) => {
      setPublicSession(next)
      setPublicLoading(false)
    }, () => setPublicLoading(false))
  }, [])

  const publicShareActive = state.shareToken && (!state.shareExpiresAt || state.shareExpiresAt > Date.now())
  const publicShareUrl = publicShareActive
    ? `${window.location.origin}${window.location.pathname}?public=${state.shareToken}`
    : ''

  // The ONLY place allowed to grant access: any successful Firebase sign-in
  // (Google or email/password) flips auth state immediately, so we must
  // fully verify — profile exists, or a pending signup code redeems clean —
  // before ever setting `user`, instead of trusting raw auth state.
  useEffect(() => {
    const unsubscribe = onAuthChange(async (u) => {
      if (!u) {
        setUser(null)
        setIsAdmin(false)
        setAuthLoading(false)
        setAuthChecking(false)
        return
      }

      setAuthChecking(true)
      const pendingCode = takePendingSignupCode()

      try {
        let profile = await getUserProfile(u.uid)

        if (!profile && pendingCode) {
          await claimAccessCodeForUser(u, pendingCode)
          profile = await getUserProfile(u.uid)
        }

        if (!profile) {
          const isPasswordAccount = u.providerData.some((p) => p.providerId === 'password')
          if (isPasswordAccount) {
            await deleteAccount(u).catch(() => {})
          } else {
            await logout().catch(() => {})
          }
          setAuthError('No account found for this sign-in. Create an account with a valid access code first.')
          setUser(null)
          return
        }

        setAuthError('')
        setUser(u)
        isSuperAdmin(u.uid).then(setIsAdmin).catch(() => setIsAdmin(false))
      } catch (err) {
        console.error('Post sign-in verification failed:', err)
        const isPasswordAccount = u.providerData.some((p) => p.providerId === 'password')
        if (isPasswordAccount) {
          await deleteAccount(u).catch(() => {})
        } else {
          await logout().catch(() => {})
        }
        setAuthError(err.message || 'Sign-in failed. Please try again.')
        setUser(null)
      } finally {
        setAuthLoading(false)
        setAuthChecking(false)
      }
    })
    return unsubscribe
  }, [])

  const SESSION_ID = user ? user.uid : null

  const saveLocal = (data) => {
    if (!SESSION_ID) return
    try {
      localStorage.setItem(storageKey(SESSION_ID), JSON.stringify(data))
    } catch (err) {
      console.warn('Failed to save local session', err)
    }
  }

  const loadLocal = () => {
    if (!SESSION_ID) return null
    try {
      const raw = localStorage.getItem(storageKey(SESSION_ID))
      return raw ? JSON.parse(raw) : null
    } catch (err) {
      return null
    }
  }

  const clearLocal = () => {
    if (!SESSION_ID) return
    try {
      localStorage.removeItem(storageKey(SESSION_ID))
    } catch (err) {}
  }

  // Live sync: whenever local state changes AFTER the initial reconciliation
  // (connected === true), push to Firebase. Guarded so this can never fire
  // before we've resolved local vs. remote on load.
  useEffect(() => {
    if (!connected || !SESSION_ID) return
    if (skipNextSave.current) {
      skipNextSave.current = false
      return
    }
    saveSession(SESSION_ID, state).catch((err) => {
      console.error('Firebase save failed:', err)
      setFirebaseError('Live sync unavailable. Working locally.')
    })
    try { saveLocal(state) } catch (e) {}
  }, [state, connected, SESSION_ID])

  useEffect(() => {
    if (!connected || !state.shareToken) return
    if (state.shareExpiresAt && state.shareExpiresAt <= Date.now()) {
      update({ shareToken: null, shareExpiresAt: null })
      return
    }
    savePublicSession(state.shareToken, makePublicSession(state, SESSION_ID, user?.uid)).catch((err) => {
      console.error('Public session update failed:', err)
    })
  }, [state, connected, SESSION_ID])

  useEffect(() => {
    if (!connected || !state.shareToken || state.shareExpiresAt) return
    fetchPublicSession(state.shareToken).then((publicSession) => {
      const expiresAt = publicSession?.expiresAt?.toDate
        ? publicSession.expiresAt.toDate().getTime()
        : publicSession?.expiresAt ? new Date(publicSession.expiresAt).getTime() : 0
      update(expiresAt > Date.now()
        ? { shareExpiresAt: expiresAt }
        : { shareToken: null, shareExpiresAt: null })
    }).catch(() => {})
  }, [state.shareToken, state.shareExpiresAt, connected])

  useEffect(() => {
    if (!state.shareExpiresAt) return
    const remaining = state.shareExpiresAt - Date.now()
    if (remaining <= 0) {
      update({ shareToken: null, shareExpiresAt: null })
      return
    }
    const timer = window.setTimeout(() => update({ shareToken: null, shareExpiresAt: null }), remaining)
    return () => window.clearTimeout(timer)
  }, [state.shareExpiresAt])

  // Always persist locally on any state change so a refresh keeps data even when offline.
  useEffect(() => {
    try { saveLocal(state) } catch (e) {}
  }, [state])

  // Connect to the current user's private session whenever they sign in.
  // This runs the whole reconciliation IN ORDER (pull remote -> decide ->
  // maybe push -> THEN start listening) so the live listener and the
  // push-effect above can never race a stale/empty snapshot against good
  // local data.
  useEffect(() => {
    if (!SESSION_ID) {
      setConnected(false)
      setState(initialState)
      return
    }

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
  }, [SESSION_ID])

  const clearSession = () => {
    if (!SESSION_ID) return
    if (!confirm('Clear all of your session data? This cannot be undone.')) return
    // Keep the player roster, but reset their per-session stats since
    // games/shuttles/payments are all derived from games + gamesPlayed.
    const resetPlayers = state.players.map((p) => ({ ...p, wins: 0, losses: 0, gamesPlayed: 0 }))
    const cleared = { ...initialState, players: resetPlayers }
    clearLocal()
    setState(cleared)
    saveSession(SESSION_ID, cleared).catch((err) => {
      console.error('Failed to clear remote session:', err)
      setFirebaseError('Live sync unavailable. Working locally.')
    })
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const update = (patch) => setState((s) => ({ ...s, ...patch }))

  const createPublicShare = async () => {
    const token = crypto.randomUUID?.().replaceAll('-', '').slice(0, 20) || Math.random().toString(36).slice(2, 22)
    try {
      await createPublicSession(token, makePublicSession(state, SESSION_ID, user.uid))
      update({ shareToken: token, shareExpiresAt: Date.now() + 24 * 60 * 60 * 1000 })
    } catch (err) {
      console.error('Failed to create public session:', err)
      setFirebaseError('Could not create the public link. Publish the Firestore rules from README.md, then try again.')
    }
  }

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
  const renameCourt = (courtId, name) => {
    update({ courts: state.courts.map((c) => (c.id === courtId ? { ...c, name } : c)) })
  }

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

  const editGame = (updatedGame) => {
    const games = state.games.map((game) => (game.id === updatedGame.id ? updatedGame : game))
    update({ games, players: recalculatePlayerStats(state.players, games) })
  }

  const numCourts = state.numCourts
  const onUpdateSettings = (patch) => {
    if (patch.numCourts) {
      update({ ...patch, courts: makeCourts(patch.numCourts, state.courts) })
    } else {
      update(patch)
    }
  }

  if (publicTokenFromUrl) {
    if (publicLoading) return <div className="public-shell"><div className="public-card">Loading session...</div></div>
    if (!publicSession) return <div className="public-shell"><div className="public-card"><h1>Session unavailable</h1><p>This session link has expired or is no longer available.</p></div></div>

    const publicProps = {
      players: publicSession.players || [],
      queue: publicSession.queue || [],
      courts: publicSession.courts || [],
      games: publicSession.games || [],
      courtFee: publicSession.courtFee || 0,
      shuttlePrice: publicSession.shuttlePrice || 0,
    }

    return (
      <div className="app-shell public-shell-app" data-theme="dark">
        <div className="topbar"><div className="logo"><img src={logo1} alt="STP Badminton Queue" className="logo-icon" /><div className="center"><h1>Badminton Queue</h1><div className="sub">Skill-based matching · live courts · payment tracking</div></div></div></div>
        <div className="tabs public-tabs">{[['queue', 'Queue & Courts'], ['history', 'Match History'], ['leaderboard', 'Leaderboard']].map(([key, label]) => <button key={key} className={`tab ${publicTab === key ? 'active' : ''}`} onClick={() => setPublicTab(key)}>{label}</button>)}</div>
        <div className="content public-content public-readonly">
          {publicTab === 'queue' && <QueueCourtsPanel {...publicProps} pendingMatch={null} readOnly />}
          {publicTab === 'history' && <MatchHistoryPanel games={publicProps.games} players={publicProps.players} readOnly />}
          {publicTab === 'leaderboard' && <LeaderboardPanel players={publicProps.players} sessionId={publicSession.sessionId} />}
        </div>
        <footer><span>View only · updates automatically · link active for 24 hours</span></footer>
      </div>
    )
  }

  if (authLoading) {
    return (
      <div className="app-shell">
        <div className="content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          Loading...
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPanel onSuccess={() => {}} verifying={authChecking} serverError={authError} />
  }

  return (
    <div className="app-shell" data-theme="dark">
      <div className="topbar">
        <div className="logo">
          <img src={logo1} alt="STP Badminton Queue" className="logo-icon" />
          <div className="center">
            <h1>Badminton Queue</h1>
            <div className="sub">Skill-based matching · live courts · payment tracking</div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {['setup', 'players', 'queue', 'history', 'leaderboard', ...(isAdmin ? ['clubs'] : [])].map((t) => (
          <button
            key={t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
           {t === 'setup' ? (
  <img src={settingsIcon} alt="Settings" className="tab-icon" />
) : t === 'queue' ? (
  'Queue & Courts'
) : t === 'history' ? (
  'Match History'
) : (
  t[0].toUpperCase() + t.slice(1)
)}
          </button>
        ))}
      </div>

      <div className="content">
        {tab === 'setup' && (
          <SetupPanel
            connected={connected}
            firebaseError={firebaseError}
            courtFee={state.courtFee}
            shuttlePrice={state.shuttlePrice}
            numCourts={numCourts}
            onUpdateSettings={onUpdateSettings}
            onClearSession={clearSession}
            publicShareUrl={publicShareUrl}
            onCreatePublicShare={createPublicShare}
            user={user}
            onLogout={handleLogout}
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
            onRemoveFromQueue={removeFromQueue}
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
            onRenameCourt={renameCourt}
          />
        )}

        {tab === 'leaderboard' && (
          <LeaderboardPanel
            players={state.players}
            sessionId={SESSION_ID}
          />
        )}

        {tab === 'history' && (
          <MatchHistoryPanel
            games={state.games}
            players={state.players}
            onEditGame={editGame}
          />
        )}

        {tab === 'clubs' && isAdmin && <ClubsPanel />}
      </div>
      <footer>
        <span>© 2026 Aem Manzano · STP Badminton</span>
      </footer>
    </div>
  )
}

function recalculatePlayerStats(players, games) {
  const statsByPlayer = Object.fromEntries(
    players.map((player) => [player.id, { wins: 0, losses: 0, gamesPlayed: 0, points: 0 }])
  )

  games.forEach((game) => {
    const teamA = game.teamA || []
    const teamB = game.teamB || []
    const pointsA = Math.max(0, Number(game.teamAPoints) || 0)
    const pointsB = Math.max(0, Number(game.teamBPoints) || 0)

    teamA.forEach((playerId) => {
      if (!statsByPlayer[playerId]) return
      statsByPlayer[playerId].gamesPlayed += 1
      statsByPlayer[playerId].points += pointsA
      if (game.winner === 'A') statsByPlayer[playerId].wins += 1
      else statsByPlayer[playerId].losses += 1
    })
    teamB.forEach((playerId) => {
      if (!statsByPlayer[playerId]) return
      statsByPlayer[playerId].gamesPlayed += 1
      statsByPlayer[playerId].points += pointsB
      if (game.winner === 'B') statsByPlayer[playerId].wins += 1
      else statsByPlayer[playerId].losses += 1
    })
  })

  return players.map((player) => ({ ...player, ...statsByPlayer[player.id] }))
}

function makePublicSession(data, sessionId, ownerUid) {
  return {
    sessionId,
    ownerUid,
    sessionName: data.sessionName || sessionId,
    courtFee: data.courtFee || 0,
    shuttlePrice: data.shuttlePrice || 0,
    players: (data.players || []).map(({ id, name, skillLevel, wins, losses, gamesPlayed, points }) => ({
      id,
      name,
      skillLevel,
      wins: wins || 0,
      losses: losses || 0,
      gamesPlayed: gamesPlayed || 0,
      points: points || 0
    })),
    queue: data.queue || [],
    courts: (data.courts || []).map(({ id, name, status, teamA, teamB }) => ({ id, name, status, teamA, teamB })),
    games: data.games || []
  }
}