import React, { useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { skillLabel } from '../utils/matching.js'

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Minimum sample size before a player's win rate is trusted enough to rank on it.
const MIN_GAMES = 5

const SORT_MODES = {
  minGames: 'Win rate (min. games)',
  winsFirst: 'Most wins',
  composite: 'Composite score'
}

const SORT_DESCRIPTIONS = {
  minGames: `Ranks by win rate, but players need at least ${MIN_GAMES} games to qualify.`,
  winsFirst: 'Ranks by total wins first, win rate only breaks ties.',
  composite: 'Blends net wins (wins minus losses) with win rate scaled by games played, balancing volume and consistency.'
}

export default function LeaderboardPanel({ players, sessionId }) {
  const exportRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [exportError, setExportError] = useState('')
  const [sortMode, setSortMode] = useState('minGames')

  const ranked = [...players]
    .sort((a, b) => {
      const wrA = a.gamesPlayed ? a.wins / a.gamesPlayed : 0
      const wrB = b.gamesPlayed ? b.wins / b.gamesPlayed : 0

      if (sortMode === 'winsFirst') {
        if (b.wins !== a.wins) return b.wins - a.wins
        return wrB - wrA
      }

      if (sortMode === 'composite') {
        // Blends net record with win rate scaled by volume so grinding out
        // wins counts as much as a high but small-sample win rate.
        const scoreA = (a.wins - a.losses) + wrA * a.gamesPlayed
        const scoreB = (b.wins - b.losses) + wrB * b.gamesPlayed
        return scoreB - scoreA
      }

      // minGames: players below the threshold always rank under qualified ones.
      const qualifiedA = a.gamesPlayed >= MIN_GAMES
      const qualifiedB = b.gamesPlayed >= MIN_GAMES
      if (qualifiedA !== qualifiedB) return qualifiedA ? -1 : 1
      if (wrB !== wrA) return wrB - wrA
      return b.wins - a.wins
    })

  const exportImage = async () => {
    if (!exportRef.current) return
    setExporting(true)
    setExportError('')
    try {
      const options = { backgroundColor: null, scale: isIOS() ? 1 : 2, useCORS: true }
      let canvas
      try {
        canvas = await html2canvas(exportRef.current, options)
      } catch (error) {
        if (!isIOS()) throw error
        canvas = await html2canvas(exportRef.current, { ...options, scale: 0.5 })
      }
      setPreviewUrl(canvas.toDataURL('image/png'))
    } catch (error) {
      console.error('Could not export leaderboard image', error)
      setExportError('Could not create the image on this device. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="panel leaderboard-panel" ref={exportRef}>
      <div className="row leaderboard-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Leaderboard</h2>
        <div className="row leaderboard-controls">
          <select
            className="leaderboard-sort"
            value={sortMode}
            onChange={(e) => setSortMode(e.target.value)}
            aria-label="Leaderboard ranking method"
          >
            {Object.entries(SORT_MODES).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button className="btn btn-export" onClick={exportImage} disabled={exporting || ranked.length === 0}>
            {exporting ? 'Exporting…' : '⬇ Export as Image'}
          </button>
        </div>
      </div>

      {exportError && <div className="error-text" role="alert">{exportError}</div>}

      <div className="leaderboard-sort-hint">{SORT_DESCRIPTIONS[sortMode]}</div>

      {ranked.length === 0 ? (
        <div className="empty-state">No completed games yet. Results appear here once games are marked done.</div>
      ) : (
        <div className="leaderboard-grid" >
          {ranked.map((p, i) => {
            const winRate = p.gamesPlayed ? Math.round((p.wins / p.gamesPlayed) * 100) : 0
            const initials = p.name.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase()
            const rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : ''
            return (
              <div key={p.id} className={`leader-card ${rankClass}`}>
                <div className={`leader-rank ${rankClass}`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </div>

                <div className="leader-summary">
                  <div className="leader-avatar">{initials}</div>
                  <div className="leader-info">
                    <div className="leader-name">{p.name}</div>
                    <div className="leader-meta">
                      <span>{skillLabel(p.skillLevel)}</span>
                    </div>
                  </div>
                </div>

                <div className="leader-rate">
                  <div className="leader-rate-top">
                    <span>Win rate</span>
                    <strong>{winRate}%</strong>
                  </div>
                  <div className="winbar"><div className="fill" style={{ width: `${winRate}%` }} /></div>
                </div>

                <div className="leader-stats">
                  <div className="leader-stat">
                    <span className="label">Games</span>
                    <span className="value">{p.gamesPlayed}</span>
                  </div>
                  <div className="leader-stat">
                    <span className="label">W-L</span>
                    <span className="value">{p.wins}-{p.losses}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {previewUrl && (
        <div
          onClick={() => setPreviewUrl(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.85)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div style={{ color: '#fff', marginBottom: 12, fontSize: 15, textAlign: 'center' }}>
            Tap and hold the image, then choose "Save Image" — tap anywhere else to close
          </div>
          <img
            src={previewUrl}
            alt="Leaderboard export"
            style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: 8 }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="btn"
            style={{ marginTop: 16 }}
            onClick={() => setPreviewUrl(null)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  )
}