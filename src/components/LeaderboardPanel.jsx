import React, { useRef, useState } from 'react'
import { skillLabel } from '../utils/matching.js'

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

// Design tokens pulled straight from the site's CSS (:root and .leader-card
// rules) so the drawn image uses the exact same colors as the live UI.
const COLORS = {
  ink: '#0b1b2c',
  court: '#0b0b0b',
  muted: '#6b7280',
  shuttle: '#ffb703',
  shuttleDark: '#e6a400',
  panelBg: '#ffffff',
  cardBorder: 'rgba(16,16,16,0.06)',
  rankBg: 'rgba(16,16,16,0.05)',
  barTrack: 'rgba(16,16,16,0.08)',
  rowGradients: {
    top1: ['#fffae6', '#fff1c4'],
    top2: ['#f5f5f5', '#e4e4e4'],
    top3: ['#fff3e2', '#ffe2b8'],
    default: ['#ffffff', '#f8f8f6']
  },
  rowBorders: {
    top1: 'rgba(255,183,3,0.4)',
    top2: 'rgba(180,180,180,0.5)',
    top3: 'rgba(205,133,63,0.4)',
    default: 'rgba(16,16,16,0.06)'
  },
  medal: {
    top1: { fill: ['#ffe066', '#e6a400'], text: '#5c3d00' },
    top2: { fill: ['#eef0f2', '#b7bcc2'], text: '#3a3d40' },
    top3: { fill: ['#f0b27a', '#b5651d'], text: '#4a2a0f' }
  }
}

function roundRectPath(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2)
  context.beginPath()
  context.moveTo(x + r, y)
  context.arcTo(x + width, y, x + width, y + height, r)
  context.arcTo(x + width, y + height, x, y + height, r)
  context.arcTo(x, y + height, x, y, r)
  context.arcTo(x, y, x + width, y, r)
  context.closePath()
}

function fillRoundedRect(context, x, y, width, height, radius, color) {
  roundRectPath(context, x, y, width, height, radius)
  context.fillStyle = color
  context.fill()
}

function strokeRoundedRect(context, x, y, width, height, radius, color, lineWidth = 1) {
  roundRectPath(context, x, y, width, height, radius)
  context.strokeStyle = color
  context.lineWidth = lineWidth
  context.stroke()
}

function truncateToWidth(context, text, maxWidth) {
  if (context.measureText(text).width <= maxWidth) return text
  let result = text
  while (result.length > 1 && context.measureText(result + '…').width > maxWidth) {
    result = result.slice(0, -1)
  }
  return result + '…'
}

function isIOS() {
  if (typeof navigator === 'undefined') return false
  return /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Draws the leaderboard entirely with the Canvas 2D API — real canvas
// gradients, rounded rects, and text always render identically across
// devices, unlike a DOM screenshot (html2canvas), which approximates CSS
// and can render CSS Grid / gradients differently per browser/OS. This is
// the single source of truth for the exported image.
function drawLeaderboardImage(players, sortDescription) {
  const dpr = 2 // fixed export resolution, independent of device pixel ratio
  const width = 860
  const paddingX = 24
  const paddingTop = 26
  const titleToRowsGap = 20
  const rowHeight = 78
  const rowGap = 10
  const rowsHeight = players.length * rowHeight + Math.max(0, players.length - 1) * rowGap
  const height = paddingTop + 30 + 34 + titleToRowsGap + rowsHeight + 24

  const canvas = document.createElement('canvas')
  canvas.width = width * dpr
  canvas.height = height * dpr
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  ctx.textBaseline = 'alphabetic'

  // Panel background
  fillRoundedRect(ctx, 0, 0, width, height, 12, COLORS.panelBg)

  // Title
  ctx.fillStyle = COLORS.court
  ctx.font = '800 18px "Archivo Black", Inter, sans-serif'
  ctx.fillText('LEADERBOARD', paddingX, paddingTop + 16)

  ctx.fillStyle = COLORS.muted
  ctx.font = '12px Inter, sans-serif'
  ctx.fillText(sortDescription, paddingX, paddingTop + 36)

  const rowsTop = paddingTop + 30 + 34 + titleToRowsGap - 26
  const rowWidth = width - paddingX * 2

  // Row content is inset from the card's own edges (mirrors .leader-card's
  // own padding: 12px 16px) — columns are laid out within that inner
  // width, not the full row width, so nothing bleeds past the rounded
  // card border.
  const rowInsetX = 16
  const contentWidth = rowWidth - rowInsetX * 2

  // Column layout mirrors .leaderboard-grid .leader-card's
  // grid-template-columns: auto 1fr 30% 1fr. CSS Grid resolves percentage
  // tracks (30%) against the full content box, then splits any remaining
  // space evenly between the fr tracks — not against whatever's left
  // after the other columns, which is what previously pushed the last
  // column past the row's right edge.
  const gap = 12
  const rankColW = 46
  const rateColW = contentWidth * 0.30
  const frRemaining = contentWidth - rankColW - rateColW - gap * 3
  const nameColW = frRemaining / 2
  const statsColW = frRemaining / 2

  players.forEach((player, index) => {
    const y = rowsTop + index * (rowHeight + rowGap)
    const variant = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : 'default'
    const [gradStart, gradEnd] = COLORS.rowGradients[variant]

    // Row background — real canvas linear gradient (renders correctly,
    // unlike html2canvas's approximation of CSS linear-gradient)
    const angleGrad = variant === 'default'
      ? ctx.createLinearGradient(paddingX, y, paddingX, y + rowHeight) // 180deg
      : ctx.createLinearGradient(paddingX, y, paddingX + rowWidth, y + rowHeight) // ~135deg
    angleGrad.addColorStop(0, gradStart)
    angleGrad.addColorStop(1, gradEnd)
    fillRoundedRect(ctx, paddingX, y, rowWidth, rowHeight, 16, angleGrad)
    strokeRoundedRect(ctx, paddingX, y, rowWidth, rowHeight, 16, COLORS.rowBorders[variant], 1)

    let colX = paddingX + rowInsetX
    const centerY = y + rowHeight / 2

    // Rank
    const rankCenterX = colX + rankColW / 2
    if (variant === 'top1' || variant === 'top2' || variant === 'top3') {
      const medalColors = COLORS.medal[variant]
      const medalGrad = ctx.createLinearGradient(rankCenterX - 16, centerY - 16, rankCenterX + 16, centerY + 16)
      medalGrad.addColorStop(0, medalColors.fill[0])
      medalGrad.addColorStop(1, medalColors.fill[1])
      ctx.beginPath()
      ctx.arc(rankCenterX, centerY, 16, 0, Math.PI * 2)
      ctx.fillStyle = medalGrad
      ctx.fill()
      ctx.fillStyle = medalColors.text
      ctx.font = '800 13px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(String(index + 1), rankCenterX, centerY + 4)
    } else {
      ctx.beginPath()
      ctx.arc(rankCenterX, centerY, 16, 0, Math.PI * 2)
      ctx.fillStyle = COLORS.rankBg
      ctx.fill()
      ctx.fillStyle = COLORS.muted
      ctx.font = '800 12px Inter, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(`#${index + 1}`, rankCenterX, centerY + 4)
    }
    ctx.textAlign = 'left'
    colX += rankColW + gap

    // Avatar + name/skill
    const avatarR = 21
    const avatarCx = colX + avatarR
    const avatarGrad = ctx.createLinearGradient(avatarCx - avatarR, centerY - avatarR, avatarCx + avatarR, centerY + avatarR)
    avatarGrad.addColorStop(0, COLORS.shuttle)
    avatarGrad.addColorStop(1, COLORS.shuttleDark)
    ctx.beginPath()
    ctx.arc(avatarCx, centerY, avatarR, 0, Math.PI * 2)
    ctx.fillStyle = avatarGrad
    ctx.fill()
    const initials = String(player.name).trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    ctx.fillStyle = COLORS.ink
    ctx.font = '800 13px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(initials, avatarCx, centerY + 4)
    ctx.textAlign = 'left'

    const textX = colX + avatarR * 2 + 10
    const textMaxWidth = nameColW - (avatarR * 2 + 10)
    ctx.fillStyle = COLORS.court
    ctx.font = '800 14px Inter, sans-serif'
    ctx.fillText(truncateToWidth(ctx, String(player.name), textMaxWidth), textX, centerY - 3)
    ctx.fillStyle = COLORS.muted
    ctx.font = '12px Inter, sans-serif'
    ctx.fillText(truncateToWidth(ctx, skillLabel(player.skillLevel), textMaxWidth), textX, centerY + 14)
    colX += nameColW + gap

    // Win rate label + percentage + bar
    const winRate = player.gamesPlayed ? Math.round((player.wins / player.gamesPlayed) * 100) : 0
    ctx.fillStyle = COLORS.muted
    ctx.font = '12px Inter, sans-serif'
    ctx.fillText('Win rate', colX, centerY - 8)
    ctx.fillStyle = COLORS.ink
    ctx.font = '800 13px Inter, sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(`${winRate}%`, colX + rateColW, centerY - 8)
    ctx.textAlign = 'left'

    fillRoundedRect(ctx, colX, centerY + 2, rateColW, 8, 4, COLORS.barTrack)
    const barGrad = ctx.createLinearGradient(colX, 0, colX + rateColW, 0)
    barGrad.addColorStop(0, COLORS.shuttle)
    barGrad.addColorStop(1, COLORS.shuttleDark)
    fillRoundedRect(ctx, colX, centerY + 2, Math.max(4, rateColW * winRate / 100), 8, 4, barGrad)
    colX += rateColW + gap

    // Games / W-L stats, right-aligned pair like .leader-stats
    const statW = statsColW / 2
    const stat1Right = colX + statW - 10
    const stat2Right = colX + statsColW - 2
    ctx.textAlign = 'right'
    ctx.fillStyle = COLORS.muted
    ctx.font = '12px Inter, sans-serif'
    ctx.fillText('Games', stat1Right, centerY - 6)
    ctx.fillText('W-L', stat2Right, centerY - 6)
    ctx.fillStyle = COLORS.court
    ctx.font = '800 14px Inter, sans-serif'
    ctx.fillText(String(player.gamesPlayed), stat1Right, centerY + 14)
    ctx.fillText(`${player.wins}-${player.losses}`, stat2Right, centerY + 14)
    ctx.textAlign = 'left'
  })

  return canvas.toDataURL('image/png')
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
    if (ranked.length === 0) return
    setExporting(true)
    setExportError('')
    try {
      // Drawn directly on canvas — no DOM screenshot step, so there's
      // nothing for iOS Safari (or any browser) to render inconsistently.
      const dataUrl = drawLeaderboardImage(ranked, SORT_DESCRIPTIONS[sortMode])

      if (isIOS()) {
        // iOS Safari ignores an anchor's download attribute and just
        // opens the image in a new tab instead of saving it — showing
        // it in-page lets the user tap-and-hold to save to Photos.
        setPreviewUrl(dataUrl)
      } else {
        const link = document.createElement('a')
        link.href = dataUrl
        link.download = `leaderboard${sessionId ? `-${sessionId}` : ''}.png`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }
    } catch (error) {
      console.error('Could not create the leaderboard image', error)
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