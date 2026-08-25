import React, { useState } from 'react'
import { skillLabel } from '../utils/matching.js'
import { computePayments } from '../utils/payment.js'

export default function PlayersPanel({ players, games, courtFee, onAddPlayer, onEditSkill, onRemovePlayer, onAddToQueue, onRemoveFromQueue, queue, courts = [], onUpdatePlayer }) {
  const [name, setName] = useState('')
  const [skill, setSkill] = useState(3)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSkill, setEditSkill] = useState(3)
  const [search, setSearch] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [openActionsId, setOpenActionsId] = useState(null)

  const submit = () => {
    if (!name.trim()) return
    onAddPlayer(name.trim(), skill)
    setName('')
    setSkill(3)
    setAddModalOpen(false)
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
      <div className="players-toolbar">
        <div className="players-title-group">
          <h2>Players</h2>
          <span>{players.length} registered</span>
        </div>
        <div className="players-toolbar-actions">
          <input
            className="search-player-input"
            placeholder="Search directory"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn add-player-btn" onClick={() => setAddModalOpen(true)}>+ Add Player</button>
        </div>
      </div>

      {players.length === 0 && <div className="empty-state">No players yet. Add your club members above.</div>}

      <div className="player-table-wrap">
        <table className="player-table">
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col">Games</th>
              <th scope="col">Shuttles</th>
              <th scope="col">Payment</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
        {playersWithStats
          .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
          .map((p) => {
          const isOnCourt = onCourtIds.has(p.id)
          const isQueued = queuedIds.has(p.id)
          const queueLabel = isOnCourt ? 'On court' : isQueued ? 'In queue' : 'Queue'

          return (
          <tr key={p.id}>
            <th scope="row" className="player-table-identity">
              <div className="leader-avatar" title={p.name}>
                <div className="avatar-initials">{p.name.split(' ').map((w) => w[0]).slice(0,2).join('').toUpperCase()}</div>
              </div>
              <span>
                <strong className="leader-name" onDoubleClick={() => beginEdit(p)}>{p.name}</strong>
                <small className="leader-meta">{skillLabel(p.skillLevel)}</small>
              </span>
            </th>
            <td data-label="Games">{p.gamesPlayed}</td>
            <td data-label="Shuttles">{p.shuttlesUsed ? p.shuttlesUsed.toFixed(1) : '0.0'}</td>
            <td data-label="Payment">₱{p.totalPayment.toFixed(2)}</td>
            <td className="player-table-actions" data-label="Actions">
                <button
                  className="btn player-actions-toggle"
                  onClick={() => setOpenActionsId(openActionsId === p.id ? null : p.id)}
                  aria-expanded={openActionsId === p.id}
                >
                  Actions
                </button>
              <div className={`player-actions-menu${openActionsId === p.id ? ' is-open' : ''}`}>
                <button
                  className="btn secondary small"
                  disabled={isOnCourt}
                  onClick={() => {
                    if (isQueued) onRemoveFromQueue?.(p.id)
                    else onAddToQueue(p.id)
                    setOpenActionsId(null)
                  }}
                >
                  {queueLabel}
                </button>
                <button className="btn player-edit-btn" onClick={() => beginEdit(p)}>Edit</button>
                <button
                  className="btn player-delete-btn"
                  onClick={() => { onRemovePlayer(p.id); setOpenActionsId(null) }}
                  aria-label={`Delete ${p.name}`}
                  title={`Delete ${p.name}`}
                >
                  <span aria-hidden="true">×</span> Delete
                </button>
              </div>
            </td>
          </tr>
        )})}
          </tbody>
        </table>
      </div>

      {addModalOpen && (
        <div className="modal-backdrop" onClick={() => setAddModalOpen(false)}>
          <div className="modal player-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add Player</h3>
            <p className="player-edit-subtitle">Add a new player to the directory</p>

            <div className="player-edit-fields">
              <label className="player-edit-field">
                <span>Name</span>
                <input
                  autoFocus
                  placeholder="Player name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                />
              </label>
              <label className="player-edit-field">
                <span>Skill level</span>
                <select value={skill} onChange={(e) => setSkill(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((lvl) => (
                    <option key={lvl} value={lvl}>{skillLabel(lvl)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="actions player-edit-actions" style={{ marginTop: 16 }}>
              <button className="btn secondary" onClick={() => setAddModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

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
