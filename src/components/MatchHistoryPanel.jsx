import React, { useState } from 'react'

function formatDate(timestamp) {
  if (!timestamp) return 'Unknown date'
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function MatchHistoryPanel({ games, players, onEditGame }) {
  const [editingGame, setEditingGame] = useState(null)
  const playerName = (id) => players.find((player) => player.id === id)?.name || 'Unknown player'
  const orderedGames = [...games].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  const openEditor = (game) => {
    setEditingGame({
      ...game,
      teamAPoints: game.teamAPoints ?? 0,
      teamBPoints: game.teamBPoints ?? 0,
      shuttlesUsed: game.shuttlesUsed ?? 0
    })
  }

  const saveEdit = (event) => {
    event.preventDefault()
    if (!editingGame) return
    onEditGame({
      ...editingGame,
      teamAPoints: Math.max(0, Number(editingGame.teamAPoints) || 0),
      teamBPoints: Math.max(0, Number(editingGame.teamBPoints) || 0),
      shuttlesUsed: Math.max(0, Number(editingGame.shuttlesUsed) || 0)
    })
    setEditingGame(null)
  }

  return (
    <div className="panel match-history-panel">
      <div className="page-heading">
        <h2>Match History</h2>
        <span>{games.length} recorded</span>
      </div>

      {orderedGames.length === 0 ? (
        <div className="empty-state">No completed matches yet.</div>
      ) : (
        <div className="match-history-list">
          {orderedGames.map((game) => (
            <article className="match-history-item" key={game.id}>
              <div className="match-history-main">
                <div className="match-history-date">{formatDate(game.timestamp)} · {game.courtId || 'Court'}</div>
                <div className="match-history-teams">
                  <span className={game.winner === 'A' ? 'match-winner' : ''}>
                    {game.teamA.map(playerName).join(' & ') || 'Team A'}
                  </span>
                  <strong>{game.teamAPoints ?? 0} - {game.teamBPoints ?? 0}</strong>
                  <span className={game.winner === 'B' ? 'match-winner' : ''}>
                    {game.teamB.map(playerName).join(' & ') || 'Team B'}
                  </span>
                </div>
                <div className="match-history-meta">{game.shuttlesUsed ?? 0} shuttle{game.shuttlesUsed === 1 ? '' : 's'}</div>
              </div>
              <button className="btn secondary small" onClick={() => openEditor(game)}>Edit</button>
            </article>
          ))}
        </div>
      )}

      {editingGame && (
        <div className="modal-backdrop" onClick={() => setEditingGame(null)}>
          <form className="modal match-edit-modal" onSubmit={saveEdit} onClick={(event) => event.stopPropagation()}>
            <h3>Edit Match</h3>
            <p className="player-edit-subtitle">
              {editingGame.teamA.map(playerName).join(' & ')} vs {editingGame.teamB.map(playerName).join(' & ')}
            </p>

            <label className="match-edit-field">
              <span>Winner</span>
              <select value={editingGame.winner} onChange={(event) => setEditingGame({ ...editingGame, winner: event.target.value })}>
                <option value="A">Team A</option>
                <option value="B">Team B</option>
              </select>
            </label>
            <div className="match-edit-fields">
              <label className="match-edit-field">
                <span>Team A points</span>
                <input type="number" min="0" value={editingGame.teamAPoints} onChange={(event) => setEditingGame({ ...editingGame, teamAPoints: event.target.value })} />
              </label>
              <label className="match-edit-field">
                <span>Team B points</span>
                <input type="number" min="0" value={editingGame.teamBPoints} onChange={(event) => setEditingGame({ ...editingGame, teamBPoints: event.target.value })} />
              </label>
              <label className="match-edit-field">
                <span>Shuttles used</span>
                <input type="number" min="0" step="1" value={editingGame.shuttlesUsed} onChange={(event) => setEditingGame({ ...editingGame, shuttlesUsed: event.target.value })} />
              </label>
            </div>
            <div className="actions player-edit-actions">
              <button type="button" className="btn secondary" onClick={() => setEditingGame(null)}>Cancel</button>
              <button type="submit" className="btn">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
