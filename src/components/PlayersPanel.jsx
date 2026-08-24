import React, { useState } from 'react'
import { skillLabel } from '../utils/matching.js'
import { computePayments } from '../utils/payment.js'

export default function PlayersPanel({ players, games, courtFee, onAddPlayer, onEditSkill, onRemovePlayer, onAddToQueue, queue, courts = [], onUpdatePlayer }) {
  const [name, setName] = useState('')
  const [skill, setSkill] = useState(3)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSkill, setEditSkill] = useState(3)
  const [search, setSearch] = useState('')

  const submit = () => {
    if (!name.trim()) return
    onAddPlayer(name.trim(), skill)
    setName('')
    setSkill(3)
  }

  const beginEdit = (player) => {
    setEditingId(player.id)
    setEditName(player.name)
    setEditSkill(player.skillLevel)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditSkill(3)
  }

  const saveEdit = (player) => {
    const trimmedName = editName.trim()
    if (!trimmedName) return

    if (onUpdatePlayer && trimmedName !== player.name) {
      onUpdatePlayer(player.id, { name: trimmedName })
    }

    if (onEditSkill && editSkill !== player.skillLevel) {
      onEditSkill(player.id, editSkill)
    }

    cancelEdit()
  }

  const playersWithStats = computePayments(players, games, courtFee)
  const editingPlayer = playersWithStats.find((p) => p.id === editingId) || null
  const canSaveEdit = editName.trim().length > 0
  const queuedIds = new Set(queue.map((entry) => entry.id))
  const onCourtIds = new Set(
    courts.flatMap((court) => [...(court.teamA || []), ...(court.teamB || [])]).filter(Boolean)
  )

  return (
    <div className="panel">
      <h2>Players</h2>

      <div className="row add-player-row" style={{ marginBottom: 16 }}>
        <input
          className="add-player-name"
          placeholder="Player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <select className="add-player-skill" value={skill} onChange={(e) => setSkill(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((lvl) => (
            <option key={lvl} value={lvl}>
              {skillLabel(lvl)}
            </option>
          ))}
        </select>
        <button className="btn add-player-btn" onClick={submit}>+ Add Player</button>
      </div>

      <div className="row search-player-row" style={{ marginBottom: 12 }}>
        <input
          className="search-player-input"
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {players.length === 0 && <div className="empty-state">No players yet. Add your club members above.</div>}

      <div className="player-grid">
        {playersWithStats
          .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
          .map((p) => {
          const isOnCourt = onCourtIds.has(p.id)
          const isQueued = queuedIds.has(p.id)
          const isUnavailable = isOnCourt || isQueued
          const queueLabel = isOnCourt ? 'On court' : isQueued ? 'In queue' : 'Queue'

          return (
          <div key={p.id} className="player-card">
           

            <div className="leader-summary">
              <div className="leader-avatar" title={p.name}>
                <div className="avatar-initials">{p.name.split(' ').map((w) => w[0]).slice(0,2).join('').toUpperCase()}</div>
              </div>
              <div className="leader-info">
                <div className="leader-name" onDoubleClick={() => beginEdit(p)}>{p.name}</div>
                <div className="leader-meta">
                  <span>{skillLabel(p.skillLevel)}</span>
                </div>
              </div>
            </div>

            <div className="leader-stats">
              <div className="leader-stat">
                <span className="label">Games</span>
                <span className="value">{p.gamesPlayed}</span>
              </div>
              <div className="leader-stat">
                <span className="label">Shuttles</span>
                <span className="value">{p.shuttlesUsed ? p.shuttlesUsed.toFixed(1) : '0.0'}</span>
              </div>
              <div className="leader-stat">
                <span className="label">Payment</span>
                <span className="value">₱{p.totalPayment.toFixed(2)}</span>
              </div>

              <div className="actions">
                <button
                  className="btn secondary small"
                  disabled={isUnavailable}
                  onClick={() => onAddToQueue(p.id)}
                >
                  {queueLabel}
                </button>
                <button className="btn gold" onClick={() => beginEdit(p)}>Edit</button>
                <button className="btn delete" onClick={() => onRemovePlayer(p.id)}>Delete</button>
              </div>
            </div>
          </div>
        )})}
      </div>

      {editingPlayer && (
        <div className="modal-backdrop" onClick={cancelEdit}>
          <div className="modal player-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Player</h3>
            <p className="player-edit-subtitle">Update details for {editingPlayer.name}</p>

            <div className="player-edit-fields">
              <label className="player-edit-field">
                <span>Name</span>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(editingPlayer)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                  autoFocus
                />
              </label>

              <label className="player-edit-field">
                <span>Skill level</span>
                <select
                  value={editSkill}
                  onChange={(e) => setEditSkill(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') saveEdit(editingPlayer)
                    if (e.key === 'Escape') cancelEdit()
                  }}
                >
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <option key={lvl} value={lvl}>{skillLabel(lvl)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="actions player-edit-actions" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => saveEdit(editingPlayer)} disabled={!canSaveEdit}>Save</button>
              <button className="btn secondary" onClick={cancelEdit}>Cancel</button>
              <button className="btn warn delete" onClick={() => onRemovePlayer(editingPlayer.id)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
