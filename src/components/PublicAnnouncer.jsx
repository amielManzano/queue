import React, { useEffect, useRef, useState } from 'react'

const readMeId = (key) => {
  try {
    return window.localStorage.getItem(key) || ''
  } catch (e) {
    return ''
  }
}

const writeMeId = (key, id) => {
  try {
    if (id) window.localStorage.setItem(key, id)
    else window.localStorage.removeItem(key)
  } catch (e) {}
}

function playChime(ctx) {
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const start = ctx.currentTime + 0.05
  for (let r = 0; r < 3; r += 1) {
    ;[880, 1320].forEach((freq, i) => {
      const at = start + r * 0.7 + i * 0.22
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.5, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.4)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.45)
    })
  }
}

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern)
  } catch (e) {}
}

// The viewer's "Who am I?" choice, remembered on this device per session.
export function useMeId(sessionId) {
  const storageKey = `clash-me-${sessionId}`
  const [meId, setMeId] = useState(() => readMeId(storageKey))

  useEffect(() => {
    setMeId(readMeId(storageKey))
  }, [storageKey])

  const selectMe = (id) => {
    setMeId(id)
    writeMeId(storageKey, id)
  }

  return [meId, selectMe]
}

const announcedKey = (court) => `${court.id}:${court.announcedAt}`
const isAnnounced = (court) => court.status === 'playing' && Boolean(court.announcedAt)

export default function PublicAnnouncer({ courts = [], players = [], queue = [], matchQueue = [], meId, onSelectMe, pickerOpen, onClosePicker }) {
  const [search, setSearch] = useState('')
  const [called, setCalled] = useState(null)
  const audioRef = useRef(null)
  // Games already announced when the page opens should not pop up.
  const seenGamesRef = useRef(new Set(courts.filter(isAnnounced).map(announcedKey)))

  const byId = Object.fromEntries(players.map((p) => [p.id, p]))
  const playerName = (id) => byId[id]?.name || '—'
  // Same players as the "Player queue" section: waiting, in a queued match, or on a court.
  const activeIds = new Set([
    ...queue.map((entry) => entry.id),
    ...[...matchQueue, ...courts].flatMap((group) => [...(group.teamA || []), ...(group.teamB || [])])
  ])
  const sortedPlayers = players.filter((p) => activeIds.has(p.id) || p.id === meId).sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  const filteredPlayers = sortedPlayers.filter((p) => (p.name || '').toLowerCase().includes(search.trim().toLowerCase()))

  // Browsers only allow sound after a user tap, so unlock audio on the first one.
  useEffect(() => {
    const unlock = () => {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext
        if (Ctx && !audioRef.current) audioRef.current = new Ctx()
        audioRef.current?.resume?.()
      } catch (e) {}
    }
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    const newGames = courts.filter((c) => isAnnounced(c) && !seenGamesRef.current.has(announcedKey(c)))
    newGames.forEach((c) => seenGamesRef.current.add(announcedKey(c)))
    const myCourt = meId && newGames.find((c) => [...(c.teamA || []), ...(c.teamB || [])].includes(meId))
    if (!myCourt) return

    setCalled(myCourt)
    playChime(audioRef.current)
    vibrate([400, 150, 400, 150, 400])
  }, [courts])

  useEffect(() => {
    if (pickerOpen) setSearch('')
  }, [pickerOpen])

  const choose = (id) => {
    onSelectMe(id)
    onClosePicker()
  }

  const teamNames = (team) => (team || []).map(playerName).join(' & ')

  return (
    <>
      {pickerOpen && (
        <div className="modal-backdrop" onClick={onClosePicker}>
          <div className="modal court-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="court-player-modal-heading">
              <div>
                <span className="modal-kicker">Who am I?</span>
                <h3>Select your name</h3>
              </div>
              <button className="modal-close" onClick={onClosePicker} aria-label="Close player selector" title="Close">×</button>
            </div>
            <p className="announcer-hint">You'll get a popup when you're announced to a court.</p>
            <div className="court-player-search">
              <span aria-hidden="true">⌕</span>
              <input autoFocus placeholder="Search players" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="court-player-list">
              {filteredPlayers.length === 0 && <div className="muted">No matching players</div>}
              {filteredPlayers.map((player) => (
                <div className="court-player-option" key={player.id}>
                  <div className="court-player-option-info">
                    <div className="court-player-option-avatar">{(player.name || '?').charAt(0).toUpperCase()}</div>
                    <div className="court-player-option-name">{player.name}</div>
                  </div>
                  {player.id === meId ? (
                    <button className="btn secondary small court-player-add" onClick={() => choose('')}>Unselect</button>
                  ) : (
                    <button className="btn small court-player-add" onClick={() => choose(player.id)}>This is me</button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {called && (
        <div className="modal-backdrop" onClick={() => setCalled(null)}>
          <div className="modal announcer-modal" role="alertdialog" onClick={(e) => e.stopPropagation()}>
            <div className="announcer-modal-kicker">🏸 You're up!</div>
            <h3>Go to {called.name}</h3>
            <div className="announcer-modal-matchup">
              <strong>{teamNames(called.teamA)}</strong>
              <span>vs</span>
              <strong>{teamNames(called.teamB)}</strong>
            </div>
            <button className="btn gold" onClick={() => setCalled(null)}>Got it</button>
          </div>
        </div>
      )}
    </>
  )
}
