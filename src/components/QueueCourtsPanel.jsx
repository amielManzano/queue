import React, { useEffect, useState } from 'react'
import { skillLabel } from '../utils/matching.js'

function DoneGameModal({ court, playerName, defaultShuttlePrice, onConfirm, onClose }) {
  const [winner, setWinner] = useState('A')
  const [shuttles, setShuttles] = useState(1)
  const [teamAPoints, setTeamAPoints] = useState(0)
  const [teamBPoints, setTeamBPoints] = useState(0)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Finish {court.name}</h3>
        <div className="muted" style={{ marginBottom: 12 }}>
          {court.teamA.map(playerName).join(' & ')} vs {court.teamB.map(playerName).join(' & ')}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div className="muted" style={{ marginBottom: 6 }}>Winning team</div>
          <div className="row">
            <button
              className={winner === 'A' ? 'btn gold' : 'btn secondary'}
              onClick={() => setWinner('A')}
            >
              Team A
            </button>
            <button
              className={winner === 'B' ? 'btn gold' : 'btn secondary'}
              onClick={() => setWinner('B')}
            >
              Team B
            </button>
          </div>
        </div>

        <div className="row" style={{ marginBottom: 16 }}>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>Team A points</div>
            <input
              type="number"
              min="0"
              step="1"
              value={teamAPoints}
              onChange={(e) => setTeamAPoints(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              style={{ width: 90 }}
            />
          </label>
          <label>
            <div className="muted" style={{ marginBottom: 6 }}>Team B points</div>
            <input
              type="number"
              min="0"
              step="1"
              value={teamBPoints}
              onChange={(e) => setTeamBPoints(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
              style={{ width: 90 }}
            />
          </label>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="muted" style={{ marginBottom: 6 }}>Shuttles used this game</div>
          <input type="number" min="0" step="1" value={shuttles} onChange={(e) => setShuttles(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))} style={{ width: 90 }} />
          <span className="muted" style={{ marginLeft: 8 }}>× ₱{defaultShuttlePrice} ÷ 4 players</span>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => onConfirm(winner, shuttles, teamAPoints, teamBPoints)}>Confirm & Clear Court</button>
        </div>
      </div>
    </div>
  )
}

export default function QueueCourtsPanel({
  players = [],
  queue = [],
  courts = [],
  matchQueue = [],
  shuttlePrice,
  onAutoMatch,
  onCreateManualMatch,
  onClearMatch,
  onReorderQueue,
  onReorderQueueTo,
  onRemoveFromQueue,
  onRemovePlayerFromCourt,
  onAssignMatchToCourt,
  onAssignPlayerToCourt,
  onClearCourt,
  onStartGame,
  onDoneGame,
  onSwapCourtPlayer,
  onRenameCourt
}) {
  const [assignStrategy, setAssignStrategy] = useState('fairRotation')
  const [doneModalCourt, setDoneModalCourt] = useState(null)
  const [selectedCourtByMatch, setSelectedCourtByMatch] = useState({})
  const [manualMatchOpen, setManualMatchOpen] = useState(false)
  const [manualPlayerIds, setManualPlayerIds] = useState([])
  const [manualSearch, setManualSearch] = useState('')
  const [selectModal, setSelectModal] = useState(null)
  const [selectSearch, setSelectSearch] = useState('')
  const [playerSort, setPlayerSort] = useState('name')
  const [tick, setTick] = useState(Date.now())
  const [editingCourtId, setEditingCourtId] = useState(null)
  const [editingCourtName, setEditingCourtName] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const firstAvailableCourt = courts.find((court) => court.status === 'empty')
    if (!firstAvailableCourt) return
    setSelectedCourtByMatch((selected) => {
      const next = { ...selected }
      let changed = false
      matchQueue.forEach((match) => {
        if (!next[match.id]) {
          next[match.id] = firstAvailableCourt.id
          changed = true
        }
      })
      return changed ? next : selected
    })
  }, [matchQueue, courts])

  const byId = Object.fromEntries(players.map((p) => [p.id, p]))
  const playerName = (id) => byId[id]?.name || '—'
  const queuePlayerName = (id) => {
    const name = playerName(id)
    return name.length > 16 ? `${name.slice(0, 13)}...` : name
  }
  const queuedPlayers = queue
    .filter((entry) => byId[entry.id])
    .map((entry) => ({ ...byId[entry.id], queuedAt: entry.queuedAt }))
    .filter(Boolean)
  const emptyCourts = courts.filter((c) => c.status === 'empty')
  const courtPlayerIds = new Set(courts.flatMap((court) => [...(court.teamA || []), ...(court.teamB || [])]))
  const availableCourtPlayers = players.filter((player) => !courtPlayerIds.has(player.id))
  const matchPlayerIds = new Set(matchQueue.flatMap((match) => [...(match.teamA || []), ...(match.teamB || [])]))
  const autoMatchPlayerCount = queuedPlayers.filter((player) => !courtPlayerIds.has(player.id) && !matchPlayerIds.has(player.id)).length
  const manualMatchPlayers = players.filter((player) => !courtPlayerIds.has(player.id) && !matchPlayerIds.has(player.id))
  const activePlayers = players.filter((player) => queue.some((entry) => entry.id === player.id) || courtPlayerIds.has(player.id) || matchPlayerIds.has(player.id))
  const selectedModalCourt = selectModal ? courts.find((court) => court.id === selectModal.courtId) : null
  const selectedModalTeam = selectModal?.team === 'A' ? selectedModalCourt?.teamA : selectedModalCourt?.teamB
  const selectedModalPlayerId = selectedModalTeam?.[selectModal?.idx]

  const openPlayerModal = (courtId, team, idx) => {
    setSelectSearch('')
    setSelectModal({ courtId, team, idx })
  }

  const toggleManualPlayer = (id) => {
    setManualPlayerIds((selected) => selected.includes(id)
      ? selected.filter((playerId) => playerId !== id)
      : selected.length < 4 ? [...selected, id] : selected)
  }

  const createManualMatch = () => {
    if (manualPlayerIds.length !== 4) return
    onCreateManualMatch && onCreateManualMatch(manualPlayerIds)
    setManualPlayerIds([])
    setManualMatchOpen(false)
  }

  const formatWaitTime = (queuedAt) => {
    if (!queuedAt) return '—'
    const totalMinutes = Math.max(0, Math.floor((tick - queuedAt) / 60000))
    if (totalMinutes < 1) {
      return `${Math.max(0, Math.floor((tick - queuedAt) / 1000))}s`
    }
    if (totalMinutes < 60) return `${totalMinutes} min`

    const totalHours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    if (totalHours < 24) return minutes ? `${totalHours} hr ${minutes} min` : `${totalHours} hr`

    const days = Math.floor(totalHours / 24)
    const hours = totalHours % 24
    return hours ? `${days}d ${hours} hr` : `${days}d`
  }

  const formatGameDuration = (startedAt) => {
    if (!startedAt) return null
    const delta = tick - startedAt
    const totalSeconds = Math.max(0, Math.floor(delta / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

  const playerStatus = (playerId) => {
    const court = courts.find((item) => [...(item.teamA || []), ...(item.teamB || [])].includes(playerId))
    if (court) {
      return {
        label: `${court.name} · ${court.status === 'playing' ? 'Live' : 'Ready'}`,
        tone: court.status === 'playing' ? 'playing' : 'ready',
        matchNumber: court.matchNumber
      }
    }

    const queuedMatchIndex = matchQueue.findIndex((match) => [...(match.teamA || []), ...(match.teamB || [])].includes(playerId))
    if (queuedMatchIndex >= 0) {
      const match = matchQueue[queuedMatchIndex]
      const team = (match.teamA || []).includes(playerId) ? 'Team A' : 'Team B'
      return {
        label: `Match ${queuedMatchIndex + 1} · ${team}`,
        tone: 'match',
        matchNumber: queuedMatchIndex + 1,
        queuedAt: match.queuedAtByPlayer?.[playerId] || match.createdAt
      }
    }

    if (queue.some((entry) => entry.id === playerId)) return { label: 'Waiting', tone: 'waiting' }
    return { label: 'Available', tone: 'available' }
  }

  const sortedPlayers = [...players].sort((first, second) => {
    if (playerSort === 'name') return first.name.localeCompare(second.name)
    if (playerSort === 'level') return (second.skillLevel || 0) - (first.skillLevel || 0)
    if (playerSort === 'games') return (second.gamesPlayed || 0) - (first.gamesPlayed || 0)
    if (playerSort === 'wait') {
      const firstEntry = queue.find((entry) => entry.id === first.id)
      const secondEntry = queue.find((entry) => entry.id === second.id)
      const firstWaitStart = firstEntry?.queuedAt || playerStatus(first.id).queuedAt || Date.now()
      const secondWaitStart = secondEntry?.queuedAt || playerStatus(second.id).queuedAt || Date.now()
      return firstWaitStart - secondWaitStart
    }
    if (playerSort === 'status') {
      const rank = { playing: 0, ready: 1, match: 2, waiting: 3, available: 4 }
      return (rank[playerStatus(first.id).tone] ?? 5) - (rank[playerStatus(second.id).tone] ?? 5)
    }
    const firstIndex = queue.findIndex((entry) => entry.id === first.id)
    const secondIndex = queue.findIndex((entry) => entry.id === second.id)
    return (firstIndex < 0 ? activePlayers.length : firstIndex) - (secondIndex < 0 ? activePlayers.length : secondIndex)
  })

  const startEditingCourtName = (c) => {
    setEditingCourtId(c.id)
    setEditingCourtName(c.name)
  }

  const commitCourtName = () => {
    const name = editingCourtName.trim()
    if (name && editingCourtId) {
      onRenameCourt && onRenameCourt(editingCourtId, name)
    }
    setEditingCourtId(null)
    setEditingCourtName('')
  }

  const exportImage = async () => {
    // export removed from courts - handled by leaderboard only
  }

  return (
    <>
        <div className="panel">
        <div className="page-heading">
          <h2>Courts</h2>
          <span>{courts.length} available</span>
        </div>
        <div className="courts-grid">
          {courts.map((c) => (
            <div
              key={c.id}
              className={`court-card ${c.status !== 'empty' ? 'playing' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const data = e.dataTransfer.getData('text/plain')
                if (!data) return
                try {
                  const payload = JSON.parse(data)
                  if (payload.type === 'court') {
                    if (payload.courtId !== c.id) {
                      // move between courts
                      onRemovePlayerFromCourt && onRemovePlayerFromCourt(payload.courtId, payload.id)
                      onAssignPlayerToCourt && onAssignPlayerToCourt(c.id, payload.id)
                    }
                  }
                } catch (err) {
                  /* ignore */
                }
              }}
            >
              <h3>
                {editingCourtId === c.id ? (
                  <input
                    autoFocus
                    value={editingCourtName}
                    onChange={(e) => setEditingCourtName(e.target.value)}
                    onBlur={commitCourtName}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitCourtName()
                      if (e.key === 'Escape') { setEditingCourtId(null); setEditingCourtName('') }
                    }}
                    style={{ fontSize: 'inherit', fontWeight: 'inherit', width: 100 }}
                  />
                ) : (
                  <span onClick={() => startEditingCourtName(c)} style={{ cursor: 'pointer' }} title="Click to rename">
                    {c.name}
                  </span>
                )}
                <span className="muted" style={{ fontWeight: 400, fontSize: 11 }}>
                  {c.status === 'empty' ? 'Empty' : c.status === 'assigned' ? 'Ready' : 'In progress'}
                  {c.status === 'playing' && formatGameDuration(c.startedAt) && ` · ${formatGameDuration(c.startedAt)}`}
                </span>
              </h3>

              {/* always render court surface; show placeholders for empty slots */}
              <div className="court-surface">
                <div className="court-players team-a">
                  {Array.from({ length: 2 }).map((_, idx) => {
                    const id = (c.teamA || [])[idx]
                    return id ? (
                      <div
                        key={id}
                        className="court-player"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'court', id, courtId: c.id }))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div
                              className="court-avatar"
                              onClick={(e) => { e.stopPropagation(); openPlayerModal(c.id, 'A', idx) }}
                              title="Edit court player"
                            >{playerName(id).charAt(0).toUpperCase()}</div>
                            <div className="court-player-name" title={playerName(id)}>{playerName(id)}</div>
                          </div>
                      </div>
                    ) : (
                      <div
                        key={`a-${idx}`}
                        className="court-player empty"
                      >
                        <div
                          className="court-avatar empty"
                          onClick={(e) => {
                            e.stopPropagation()
                            openPlayerModal(c.id, 'A', idx)
                          }}
                          title="Add queued player"
                        >+
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* <div className="court-center">VS</div> */}

                <div className="court-players team-b">
                  {Array.from({ length: 2 }).map((_, idx) => {
                    const id = (c.teamB || [])[idx]
                    return id ? (
                      <div
                        key={id}
                        className="court-player"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'court', id, courtId: c.id }))
                          e.dataTransfer.effectAllowed = 'move'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="court-player-name" title={playerName(id)}>{playerName(id)}</div>
                          <div
                            className="court-avatar"
                            onClick={(e) => { e.stopPropagation(); openPlayerModal(c.id, 'B', idx) }}
                            title="Edit court player"
                          >{playerName(id).charAt(0).toUpperCase()}</div>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={`b-${idx}`}
                        className="court-player empty"
                      >
                        <div
                          className="court-avatar empty"
                          onClick={(e) => {
                            e.stopPropagation()
                            openPlayerModal(c.id, 'B', idx)
                          }}
                          title="Add queued player"
                        >+
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                {c.status === 'assigned' && (
                  <button
                    className="btn small"
                    onClick={() => onStartGame(c.id)}
                    disabled={(c.teamA || []).length + (c.teamB || []).length !== 4}
                    title={(c.teamA || []).length + (c.teamB || []).length === 4 ? 'Start game' : 'Add four players before starting'}
                  >
                    ▶ Start Game
                  </button>
                )}
                {c.status === 'playing' && (
                  <button className="btn gold small" onClick={() => setDoneModalCourt(c)}>✓ Done Game</button>
                )}
                {c.status === 'assigned' && ((c.teamA || []).length + (c.teamB || []).length > 0) && (
                  <button className="btn secondary small" onClick={() => onClearCourt?.(c.id)} title="Return all players to queue">
                    Clear court
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="row queue-match-controls" style={{ marginBottom: 12, alignItems: 'center' }}>
            <select value={assignStrategy} onChange={(e) => setAssignStrategy(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10 }}>
              <option value="fairRotation">Fair Rotation — ⭐ Recommended</option>
              <option value="balancedSkill">Balanced Skill</option>
              <option value="random">Random</option>
            </select>

            <button className="btn gold" onClick={() => onAutoMatch && onAutoMatch(assignStrategy)}>
              ⚡ Auto-assign next match
            </button>
            <button className="btn secondary" onClick={() => { setManualSearch(''); setManualMatchOpen(true) }}>
              + Manual match
            </button>

            <span className="muted">Choose a matching strategy: Fair Rotation, Balanced Skill, or Random</span>
        </div>

        {matchQueue.length > 0 && (
          <div className="match-queue">
            <div className="page-heading">
              <h2>Match queue</h2>
              <span>{matchQueue.length} waiting</span>
            </div>
            <div className="match-queue-items">
              {matchQueue.map((match, index) => (
                <div className="court-card match-queue-card" key={match.id}>
                <h3 className="match-queue-card-heading">
                  <span className="match-number">{index + 1}</span>
                  <span>Match</span>
                </h3>
                <div className="match-teams">
                  <div className="team-line">
                    <span className="team-label team-a-label">Team A</span>
                    <div className="team-players">
                      {match.teamA.map((id) => (
                        <span key={id} className="player-chip" style={{ marginRight: 6 }}>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <div className="leader-avatar" style={{ width: 28, height: 28, fontSize: 12, borderRadius: 8 }}>
                        {playerName(id).split(' ').map((w) => w[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13 }} title={playerName(id)}>{queuePlayerName(id)}</div>
                    </div>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="vs">VS</div>
                  <div className="team-line">
                    <span className="team-label team-b-label">Team B</span>
                    <div className="team-players">
                      {match.teamB.map((id) => (
                        <span key={id} className="player-chip" style={{ marginRight: 6 }}>
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <div className="leader-avatar" style={{ width: 28, height: 28, fontSize: 12, borderRadius: 8 }}>
                        {playerName(id).split(' ').map((w) => w[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13 }} title={playerName(id)}>{queuePlayerName(id)}</div>
                    </div>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="row match-queue-actions" style={{ marginTop: 12 }}>
                  <select
                    value={selectedCourtByMatch[match.id] || ''}
                    onChange={(e) => setSelectedCourtByMatch({ ...selectedCourtByMatch, [match.id]: e.target.value })}
                    disabled={emptyCourts.length === 0}
                  >
                    <option value="" disabled>
                      {emptyCourts.length === 0 ? 'No court' : 'Court'}
                    </option>
                    {emptyCourts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button
                    className="btn"
                    aria-label="Add match to court"
                    title="Add match to court"
                    disabled={!selectedCourtByMatch[match.id]}
                    onClick={() => {
                      onAssignMatchToCourt(match.id, selectedCourtByMatch[match.id])
                      setSelectedCourtByMatch((selected) => {
                        const next = { ...selected }
                        delete next[match.id]
                        return next
                      })
                    }}
                  >
                    <span aria-hidden="true">+</span>
                  </button>
                  <button
                    className="btn secondary"
                    aria-label="Return players to queue"
                    title="Return players to queue"
                    onClick={() => onClearMatch(match.id)}
                  >
                    <span aria-hidden="true">↩</span>
                  </button>
                </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="player-status-list">
          <div className="page-heading">
            <h2>Player queue</h2>
            <div className="player-queue-heading-meta">
              <label className="player-queue-sort">
                <span>Sort</span>
                <select value={playerSort} onChange={(e) => setPlayerSort(e.target.value)} aria-label="Sort player queue">
                  <option value="wait">Wait time</option>
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                  <option value="level">Level</option>
                  <option value="games">Games played</option>
                </select>
              </label>
            </div>
          </div>
          {activePlayers.length === 0 ? (
            <div className="empty-state">No players in the queue yet.</div>
          ) : (
            <div className="queue-grid player-status-items">
              {sortedPlayers.filter((player) => activePlayers.includes(player)).map((player) => {
                const status = playerStatus(player.id)
                const queueEntry = queue.find((entry) => entry.id === player.id)
                const waitStartedAt = queueEntry?.queuedAt || status.queuedAt
                return (
                  <div className="player-status-card" key={player.id}>
                    <div className="player-status-main">
                      <div className="player-status-avatar">
                        <div className="leader-avatar">{player.name.charAt(0).toUpperCase()}</div>
                        <span className={`player-status-text ${status.tone}`} title={status.label}>
                          {status.tone === 'playing' ? 'LIVE' : status.matchNumber ? `M${status.matchNumber}` : status.tone === 'waiting' ? 'WAIT' : 'AVAILABLE'}
                        </span>
                      </div>
                      <div className="leader-info">
                        <div className="leader-name">{player.name}</div>
                        <div className="leader-meta">{skillLabel(player.skillLevel)}</div>
                      </div>
                    </div>
                    <div className="player-status-metrics">
                      <span><small>Wait</small><strong>{waitStartedAt ? formatWaitTime(waitStartedAt) : '—'}</strong></span>
                      <span><small>Games</small><strong>{player.gamesPlayed || 0}</strong></span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      

      

      {doneModalCourt && (
        <DoneGameModal
          court={doneModalCourt}
          playerName={playerName}
          defaultShuttlePrice={shuttlePrice}
          onClose={() => setDoneModalCourt(null)}
          onConfirm={(winner, shuttles, teamAPoints, teamBPoints) => {
            onDoneGame(doneModalCourt.id, winner, shuttles, teamAPoints, teamBPoints)
            setDoneModalCourt(null)
          }}
        />
      )}

      {manualMatchOpen && (
        <div className="modal-backdrop" onClick={() => setManualMatchOpen(false)}>
          <div className="modal court-player-modal manual-match-modal" onClick={(e) => e.stopPropagation()}>
            <div className="court-player-modal-heading manual-match-heading">
              <div>
                <span className="modal-kicker">Build a match</span>
                <h3>Manual match</h3>
                <p className="muted">Choose four available players. The first two form Team A.</p>
              </div>
              <span className="manual-match-count">{manualPlayerIds.length}/4</span>
            </div>
            <div className="court-player-search">
              <span aria-hidden="true">⌕</span>
              <input autoFocus placeholder="Search players" value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} />
            </div>
            <div className="court-player-list manual-match-list">
              {manualMatchPlayers.filter((player) => player.name.toLowerCase().includes(manualSearch.trim().toLowerCase())).map((player) => {
                const selectionIndex = manualPlayerIds.indexOf(player.id)
                const team = selectionIndex < 2 ? 'a' : 'b'
                return (
                  <div className={`court-player-option manual-match-option${selectionIndex >= 0 ? ` selected team-${team}` : ''}`} key={player.id}>
                    <div className="court-player-option-info">
                      <div className="court-player-option-avatar">{player.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="court-player-option-name" title={player.name}>{player.name}</div>
                        <div className="muted court-player-option-skill">{selectionIndex >= 0 ? `Team ${team.toUpperCase()} · Player ${(selectionIndex % 2) + 1}` : skillLabel(player.skillLevel)}</div>
                      </div>
                    </div>
                    <button className={selectionIndex >= 0 ? 'btn secondary small' : 'btn small'} onClick={() => toggleManualPlayer(player.id)}>
                      {selectionIndex >= 0 ? `${team.toUpperCase()}${(selectionIndex % 2) + 1}` : 'Select'}
                    </button>
                  </div>
                )
              })}
              {manualMatchPlayers.filter((player) => player.name.toLowerCase().includes(manualSearch.trim().toLowerCase())).length === 0 && <div className="muted">No available players found.</div>}
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn secondary" onClick={() => setManualMatchOpen(false)}>Cancel</button>
              <button className="btn" disabled={manualPlayerIds.length !== 4} onClick={createManualMatch}>Create match</button>
            </div>
          </div>
        </div>
      )}

      {selectModal && (
        <div className="modal-backdrop" onClick={() => setSelectModal(null)}>
          <div className="modal court-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="court-player-modal-heading">
              <div>
                <span className="modal-kicker">Court edit</span>
                <h3>Select player for {selectModal.courtId}</h3>
              </div>
              <button className="modal-close" onClick={() => setSelectModal(null)} aria-label="Close player selector" title="Close">×</button>
            </div>
            <div className="court-player-search">
              <span aria-hidden="true">⌕</span>
              <input autoFocus placeholder="Search players" value={selectSearch} onChange={(e) => setSelectSearch(e.target.value)} />
            </div>
            <div className="court-player-list">
              {(() => {
                const filtered = availableCourtPlayers.filter((player) => player.name.toLowerCase().includes(selectSearch.trim().toLowerCase()))
                if (filtered.length === 0) return <div className="muted">No matching players</div>
                return filtered.map((player) => (
                  <div className="court-player-option" key={player.id}>
                    <div className="court-player-option-info">
                      <div className="court-player-option-avatar">{player.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div className="court-player-option-name">{player.name}</div>
                        <div className="muted court-player-option-skill">{skillLabel(player.skillLevel)}</div>
                      </div>
                    </div>
                    <button
                      className="btn small"
                      onClick={() => {
                        onAssignPlayerToCourt?.(selectModal.courtId, player.id, selectModal.team, selectModal.idx)
                        setSelectModal(null)
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))
              })()}
            </div>
            {selectedModalPlayerId && (
              <div className="court-player-modal-footer">
                <button
                  className="btn secondary small court-player-clear"
                  onClick={() => {
                    onRemovePlayerFromCourt?.(selectModal.courtId, selectedModalPlayerId)
                    setSelectModal(null)
                  }}
                >
                  Clear player
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </>
  )
}
