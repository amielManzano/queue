import React, { useState } from 'react'
import { skillLabel } from '../utils/matching.js'
import { computePayments } from '../utils/payment.js'

export default function PlayersPanel({ players, games, courtFee, onAddPlayer, onEditSkill, onRemovePlayer, onAddToQueue, queue, onUpdatePlayer }) {
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

  const playersWithStats = computePayments(players, games, courtFee)

  return (
    <div className="panel">
      <h2>Players</h2>

      <div className="row" style={{ marginBottom: 16 }}>
        <input
          placeholder="Player name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <select value={skill} onChange={(e) => setSkill(Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((lvl) => (
            <option key={lvl} value={lvl}>
              {skillLabel(lvl)}
            </option>
          ))}
        </select>
        <button className="btn" onClick={submit}>+ Add Player</button>
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <input
          placeholder="Search players"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 300 }}
        />
      </div>

      {players.length === 0 && <div className="empty-state">No players yet. Add your club members above.</div>}

      <div className="player-grid">
        {playersWithStats
          .filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()))
          .map((p) => (
          <div key={p.id} className="player-card">
           

            <div className="leader-summary">
              <div className="leader-avatar" title={p.name}>
                <div className="avatar-initials">{p.name.split(' ').map((w) => w[0]).slice(0,2).join('').toUpperCase()}</div>
              </div>
              <div className="leader-info">
                {editingId === p.id ? (
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} />
                ) : (
                  <div className="leader-name" onDoubleClick={() => { setEditingId(p.id); setEditName(p.name); setEditSkill(p.skillLevel) }}>{p.name}</div>
                )}
                <div className="leader-meta">
                  {editingId === p.id ? (
                    <select value={editSkill} onChange={(e) => setEditSkill(Number(e.target.value))}>
                      {[1,2,3,4,5].map((lvl) => (
                        <option key={lvl} value={lvl}>{skillLabel(lvl)}</option>
                      ))}
                    </select>
                  ) : (
                    <span>{skillLabel(p.skillLevel)}</span>
                  )}
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
                <span className="value">{p.shuttlesUsed ? p.shuttlesUsed.toFixed(2) : '0.00'}</span>
              </div>
              <div className="leader-stat">
                <span className="label">Payment</span>
                <span className="value">₱{p.totalPayment.toFixed(2)}</span>
              </div>

              <div className="actions">
                {editingId === p.id ? (
                  <>
                    <button className="btn" onClick={() => {
                      if (onUpdatePlayer) onUpdatePlayer(p.id, { name: editName })
                      if (onEditSkill && editSkill !== p.skillLevel) onEditSkill(p.id, editSkill)
                      setEditingId(null)
                    }}>Save</button>
                    <button className="btn secondary" onClick={() => setEditingId(null)}>Cancel</button>
                    <button className="btn warn delete" onClick={() => onRemovePlayer(p.id)}>Delete</button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn secondary small"
                      disabled={queue.some((entry) => entry.id === p.id)}
                      onClick={() => onAddToQueue(p.id)}
                    >
                      {queue.some((entry) => entry.id === p.id) ? 'In queue' : 'Queue'}
                    </button>
                    <button className="btn gold" onClick={() => { setEditingId(p.id); setEditName(p.name); setEditSkill(p.skillLevel) }}>Edit</button>
                    <button className="btn delete" onClick={() => onRemovePlayer(p.id)}>Delete</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
