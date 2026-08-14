import React, { useEffect, useState } from 'react'
import { skillLabel } from '../utils/matching.js'

function DoneGameModal({ court, playerName, defaultShuttlePrice, onConfirm, onClose }) {
  const [winner, setWinner] = useState('A')
  const [shuttles, setShuttles] = useState(1)

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

        <div style={{ marginBottom: 16 }}>
          <div className="muted" style={{ marginBottom: 6 }}>Shuttles used this game</div>
          <input
            type="number"
            min="0"
            step="1"
            value={shuttles}
            onChange={(e) => setShuttles(Number(e.target.value))}
            style={{ width: 90 }}
          />
          <span className="muted" style={{ marginLeft: 8 }}>
            × ₱{defaultShuttlePrice} ÷ 4 players
          </span>
        </div>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn secondary" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={() => onConfirm(winner, shuttles)}>Confirm & Clear Court</button>
        </div>
      </div>
    </div>
  )
}

export default function QueueCourtsPanel({
  players,
  queue,
  courts,
  pendingMatch,
  shuttlePrice,
  onAutoMatch,
  onClearPending,
  onReorderQueue,
  onReorderQueueTo,
  onRemoveFromQueue,
  onSwapPendingPlayer,
  onAssignPendingToCourt,
  onAssignPlayerToCourt,
  onRemovePlayerFromCourt,
  onStartGame,
  onDoneGame,
  onSwapCourtPlayer,
  onRenameCourt
}) {
  const [assignStrategy, setAssignStrategy] = useState('fairRotation')
  const [selectModal, setSelectModal] = useState(null) // { courtId }
  const [selectSearch, setSelectSearch] = useState('')
  const [selectShowAll, setSelectShowAll] = useState(false)
  const [doneModalCourt, setDoneModalCourt] = useState(null)
  const [tick, setTick] = useState(Date.now())
  const [editingCourtId, setEditingCourtId] = useState(null)
  const [editingCourtName, setEditingCourtName] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const byId = Object.fromEntries(players.map((p) => [p.id, p]))
  const playerName = (id) => byId[id]?.name || '—'
  const queuedPlayers = queue
    .map((entry) => ({ ...byId[entry.id], queuedAt: entry.queuedAt }))
    .filter(Boolean)
  const emptyCourts = courts.filter((c) => c.status === 'empty')

  const formatWaitTime = (queuedAt) => {
    if (!queuedAt) return '—'
    const delta = Date.now() - queuedAt
    const totalSeconds = Math.max(0, Math.floor(delta / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`
  }

  const formatGameDuration = (startedAt) => {
    if (!startedAt) return null
    const delta = tick - startedAt
    const totalSeconds = Math.max(0, Math.floor(delta / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  }

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
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Queue ({queuedPlayers.length} waiting)</h2>
        </div>
        <div className="panel">
        <h2>Courts</h2>
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
                  if (payload.type === 'queue') {
                    onAssignPlayerToCourt && onAssignPlayerToCourt(c.id, payload.id)
                  } else if (payload.type === 'court') {
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
                    const id = c.teamA[idx]
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
                            <div className="court-avatar">{playerName(id).charAt(0).toUpperCase()}</div>
                            <div className="court-player-name">{playerName(id)}</div>
                          </div>
                      </div>
                    ) : (
                      <div
                        key={`a-${idx}`}
                        className="court-player empty"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const data = e.dataTransfer.getData('text/plain')
                          if (!data) return
                          try {
                            const payload = JSON.parse(data)
                            if (payload.type === 'queue') {
                              onAssignPlayerToCourt && onAssignPlayerToCourt(c.id, payload.id, 'A', idx)
                            } else if (payload.type === 'court') {
                              if (payload.courtId !== c.id) {
                                onRemovePlayerFromCourt && onRemovePlayerFromCourt(payload.courtId, payload.id)
                                onAssignPlayerToCourt && onAssignPlayerToCourt(c.id, payload.id, 'A', idx)
                              } else {
                                onSwapCourtPlayer && onSwapCourtPlayer(c.id, payload.id, 'A', idx)
                              }
                            }
                          } catch (err) {}
                        }}
                      >
                        <div
                          className="court-avatar empty"
                          onClick={(e) => { e.stopPropagation(); setSelectModal({ courtId: c.id, team: 'A', idx }) }}
                          style={{ cursor: 'pointer' }}
                        >+
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* <div className="court-center">VS</div> */}

                <div className="court-players team-b">
                  {Array.from({ length: 2 }).map((_, idx) => {
                    const id = c.teamB[idx]
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
                          <div className="court-player-name">{playerName(id)}</div>
                          <div className="court-avatar">{playerName(id).charAt(0).toUpperCase()}</div>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={`b-${idx}`}
                        className="court-player empty"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          const data = e.dataTransfer.getData('text/plain')
                          if (!data) return
                          try {
                            const payload = JSON.parse(data)
                            if (payload.type === 'queue') {
                              onAssignPlayerToCourt && onAssignPlayerToCourt(c.id, payload.id, 'B', idx)
                            } else if (payload.type === 'court') {
                              if (payload.courtId !== c.id) {
                                onRemovePlayerFromCourt && onRemovePlayerFromCourt(payload.courtId, payload.id)
                                onAssignPlayerToCourt && onAssignPlayerToCourt(c.id, payload.id, 'B', idx)
                              } else {
                                onSwapCourtPlayer && onSwapCourtPlayer(c.id, payload.id, 'B', idx)
                              }
                            }
                          } catch (err) {}
                        }}
                      >
                        <div
                          className="court-avatar empty"
                          onClick={(e) => { e.stopPropagation(); setSelectModal({ courtId: c.id, team: 'B', idx }) }}
                          style={{ cursor: 'pointer' }}
                        >+
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="row" style={{ marginTop: 10 }}>
                {c.status === 'assigned' && (
                  <button className="btn small" onClick={() => onStartGame(c.id)}>▶ Start Game</button>
                )}
                {c.status === 'playing' && (
                  <button className="btn gold small" onClick={() => setDoneModalCourt(c)}>✓ Done Game</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

        {!pendingMatch && (
          <div className="row" style={{ marginBottom: 12, alignItems: 'center' }}>
            <select value={assignStrategy} onChange={(e) => setAssignStrategy(e.target.value)} style={{ padding: '8px 10px', borderRadius: 10 }}>
              <option value="fairRotation">Fair Rotation — ⭐ Recommended</option>
              <option value="balancedSkill">Balanced Skill</option>
              <option value="random">Random</option>
            </select>

            <button className="btn gold" onClick={() => onAutoMatch && onAutoMatch(assignStrategy)} disabled={queuedPlayers.length < 4}>
              ⚡ Auto-assign next match
            </button>

            <span className="muted">Choose a matching strategy: Fair Rotation, Balanced Skill, or Random</span>
          </div>
        )}

        {pendingMatch && (
          <div className="court-card playing" style={{ marginBottom: 16 }}>
            <h3>Proposed Match <span className="muted" style={{ fontWeight: 400 }}>tap a name to swap</span></h3>
            <div className="team-line">
              <span>
                {pendingMatch.teamA.map((id) => (
                  <span
                    key={id}
                    className="player-chip"
                    style={{ marginRight: 6, cursor: 'pointer' }}
                    onClick={() => onSwapPendingPlayer('A', id)}
                  >
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <div className="leader-avatar" style={{ width: 28, height: 28, fontSize: 12, borderRadius: 8 }}>
                        {playerName(id).split(' ').map((w) => w[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{playerName(id)}</div>
                    </div>
                  </span>
                ))}
              </span>
            </div>
            <div className="vs">VS</div>
            <div className="team-line">
              <span>
                {pendingMatch.teamB.map((id) => (
                  <span
                    key={id}
                    className="player-chip"
                    style={{ marginRight: 6, cursor: 'pointer' }}
                    onClick={() => onSwapPendingPlayer('B', id)}
                  >
                    <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <div className="leader-avatar" style={{ width: 28, height: 28, fontSize: 12, borderRadius: 8 }}>
                        {playerName(id).split(' ').map((w) => w[0]).slice(0,2).join('').toUpperCase()}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{playerName(id)}</div>
                    </div>
                  </span>
                ))}
              </span>
            </div>
            <div className="row" style={{ marginTop: 12 }}>
              <select
                onChange={(e) => {
                  if (e.target.value) onAssignPendingToCourt(e.target.value)
                }}
                defaultValue=""
                disabled={emptyCourts.length === 0}
              >
                <option value="" disabled>
                  {emptyCourts.length === 0 ? 'No empty court' : 'Assign to court...'}
                </option>
                {emptyCourts.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <button className="btn secondary" onClick={onClearPending}>Cancel match</button>
            </div>
          </div>
        )}

        {queuedPlayers.length === 0 ? (
          <div className="empty-state">Queue is empty — add players from the Players tab.</div>
        ) : (
          <div
            className="queue-grid"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const data = e.dataTransfer.getData('text/plain')
              if (!data) return
              try {
                const payload = JSON.parse(data)
                if (payload.type === 'court') {
                  // dropped from a court -> remove from court and append to queue
                  onRemovePlayerFromCourt && onRemovePlayerFromCourt(payload.courtId, payload.id)
                }
                // if from queue with drag reorder, treat as append
              } catch (err) {}
            }}
          >
            {queuedPlayers.map((p, i) => (
              <div
                className="leader-card queue-card"
                key={p.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ type: 'queue', id: p.id, index: i }))
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const data = e.dataTransfer.getData('text/plain')
                  if (!data) return
                  try {
                    const payload = JSON.parse(data)
                    if (payload.type === 'queue') {
                      onReorderQueueTo && onReorderQueueTo(payload.id, i)
                    } else if (payload.type === 'court') {
                      // move from court to this position in queue
                      onRemovePlayerFromCourt && onRemovePlayerFromCourt(payload.courtId, payload.id)
                      setTimeout(() => onReorderQueueTo && onReorderQueueTo(payload.id, i), 50)
                    }
                  } catch (err) {}
                }}
              >
                <div className="leader-summary">
                  <div className="leader-avatar">{p.name.charAt(0).toUpperCase()}</div>
                  <div className="leader-info">
                    <div className="leader-name">{p.name}</div>
                    <div className="leader-meta">
                      <span>{skillLabel(p.skillLevel)}</span>
                    </div>
                  </div>
                </div>

                <div className="card-top-right">
                  <button className="card-close" onClick={() => onRemoveFromQueue(p.id)}>×</button>
                </div>

                <div className="leader-stats">
                  <div className="leader-stat">
                    <span className="label">Wait</span>
                    <span className="value">{formatWaitTime(p.queuedAt)}</span>
                  </div>
                  <div className="leader-stat">
                    <span className="label">Games</span>
                    <span className="value">{p.gamesPlayed || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      

      

      {doneModalCourt && (
        <DoneGameModal
          court={doneModalCourt}
          playerName={playerName}
          defaultShuttlePrice={shuttlePrice}
          onClose={() => setDoneModalCourt(null)}
          onConfirm={(winner, shuttles) => {
            onDoneGame(doneModalCourt.id, winner, shuttles)
            setDoneModalCourt(null)
          }}
        />
      )}

      {selectModal && (
        <div className="modal-backdrop" onClick={() => setSelectModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Select player for {selectModal.courtId}</h3>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input placeholder="Search players" value={selectSearch} onChange={(e) => setSelectSearch(e.target.value)} style={{ flex: 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="checkbox" checked={selectShowAll} onChange={(e) => setSelectShowAll(e.target.checked)} />
                <span className="muted" style={{ fontSize: 12 }}>Show all players</span>
              </label>
            </div>

            <div style={{ maxHeight: 300, overflow: 'auto', marginTop: 8 }}>
              {(() => {
                const listSource = selectShowAll ? players.map((p) => ({ ...p })) : queuedPlayers
                const filtered = listSource.filter((p) => p.name.toLowerCase().includes(selectSearch.trim().toLowerCase()))
                if (filtered.length === 0) return <div className="muted">No matching players</div>
                return filtered.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{p.name}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{skillLabel(p.skillLevel)}</div>
                    </div>
                    <div>
                      <button className="btn small" onClick={() => { onAssignPlayerToCourt && onAssignPlayerToCourt(selectModal.courtId, p.id, selectModal.team, selectModal.idx); setSelectModal(null) }}>Add</button>
                    </div>
                  </div>
                ))
              })()}
            </div>
            </div>
          </div>
       
      )}
    </>
  )
}
