import React, { useRef, useState } from 'react'
import html2canvas from 'html2canvas'

// iOS Safari (including standalone/homescreen PWA mode) does not reliably
// support triggering downloads via <a download>. iPadOS 13+ also reports
// as "Mac" in the user agent but has touch points, so we check for that too.
function isIOS() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isAppleTouch = /iPad|iPhone|iPod/.test(ua)
  const isIPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
  return isAppleTouch || isIPadOS13Plus
}

export default function LeaderboardPanel({ players, sessionId }) {
  const exportRef = useRef(null)
  const [exporting, setExporting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)

  const ranked = [...players]
    .sort((a, b) => {
      const wrA = a.gamesPlayed ? a.wins / a.gamesPlayed : 0
      const wrB = b.gamesPlayed ? b.wins / b.gamesPlayed : 0
      if (wrB !== wrA) return wrB - wrA
      return b.wins - a.wins
    })

  const exportImage = async () => {
    if (!exportRef.current) return
    setExporting(true)
    try {
      const canvas = await html2canvas(exportRef.current, { backgroundColor: null, scale: 2 })

      if (isIOS()) {
        // Downloads don't work reliably on iOS Safari / homescreen PWAs.
        // Show the image so the user can long-press → Save Image instead.
        const dataUrl = canvas.toDataURL('image/png')
        setPreviewUrl(dataUrl)
      } else {
        const link = document.createElement('a')
        link.download = `${sessionId || 'stp-session'}-results.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="panel" ref={exportRef}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>Leaderboard</h2>
        <button className="btn" onClick={exportImage} disabled={exporting || ranked.length === 0}>
          {exporting ? 'Exporting…' : '⬇ Export as Image'}
        </button>
      </div>

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
                <div className="leader-summary">
                  <div className="leader-avatar">{initials}</div>
                  <div className="leader-info">
                    <div className="leader-name">{p.name}</div>
                    <div className="leader-meta">
                      <span>#{i + 1}</span>
                    </div>
                  </div>
                </div>

                <div className="leader-rate">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--muted)' }}>
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