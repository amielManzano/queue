import React, { useEffect, useState } from 'react'
import QRCode from 'qrcode'

export default function SetupPanel({ sessionId, connected, onConnect, firebaseError, courtFee, shuttlePrice, numCourts, onUpdateSettings, onClearSession, publicShareUrl, onCreatePublicShare, user, onLogout }) {
  const [idInput, setIdInput] = useState(sessionId || '')
  const [qrCode, setQrCode] = useState('')
  const displayName = user?.displayName || user?.email || ''
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?'

  useEffect(() => {
    if (!publicShareUrl) {
      setQrCode('')
      return
    }
    QRCode.toDataURL(publicShareUrl, { width: 220, margin: 2, color: { dark: '#101b2d', light: '#ffffff' } }).then(setQrCode)
  }, [publicShareUrl])

  return (
    <div className="panel">
      <div className="page-heading">
        <h2>Session</h2>
        <span>Configuration</span>
      </div>
      {firebaseError && <div className="sync-status" role="status">{firebaseError}</div>}
      {user && (
        <div className="account-row" style={{ marginBottom: 14 }}>
          <div className="account-identity">
            <div className="account-avatar">{initial}</div>
            <div>
              <strong>{user.displayName || 'Signed in'}</strong>
              {user.email && <div className="muted">{user.email}</div>}
            </div>
          </div>
          <button className="btn secondary" onClick={() => onLogout && onLogout()}>Sign Out</button>
        </div>
      )}
      {!connected ? (
        <div className="row">
          <input
            placeholder="Session name e.g. stp-aug12"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
          />
          <button className="btn" onClick={() => onConnect(idInput.trim())} disabled={!idInput.trim()}>
            Start / Join Session
          </button>
        </div>
      ) : (
        <div className="session-toolbar">
          <span className="muted">
            Session: <strong style={{ color: 'var(--ink)' }}>{sessionId}</strong> — synced live via Firebase
          </span>
          <div className="session-actions">
            <button className="btn secondary" onClick={onCreatePublicShare}>
              {publicShareUrl ? 'Generate new QR' : 'Generate QR for public view'}
            </button>
            <button className="btn secondary" onClick={() => onClearSession && onClearSession()}>Clear Session</button>
          </div>
        </div>
      )}

      {connected && publicShareUrl && (
        <div className="share-box">
          <div className="qr-preview">
            {qrCode && <img src={qrCode} alt="QR code for public session" className="session-qr" />}
            <span>Scan to view live session</span>
          </div>
          <div className="share-details">
            <div className="share-heading">
              <div>
                <span className="share-eyebrow">PUBLIC VIEW</span>
                <strong>Share this session</strong>
              </div>
              <span className="share-live"><i /> Live</span>
            </div>
            <p className="share-description">Members can scan this code to see the queue and court status without signing in.</p>
            <label className="share-link-label" htmlFor="public-session-link">Share link</label>
            <div className="share-link-row">
              <input id="public-session-link" readOnly value={publicShareUrl} onFocus={(e) => e.target.select()} />
              <button className="btn secondary share-copy" onClick={() => navigator.clipboard?.writeText(publicShareUrl)}>Copy link</button>
            </div>
            <div className="share-expiry"><span>⏱</span> Active for 24 hours</div>
          </div>
        </div>
      )}

      {connected && (
        <div className="row" style={{ marginTop: 14 }}>
          <label>
            <div className="muted">Court fee (total, ₱)</div>
            <input
              type="number"
              min="0"
              value={courtFee}
              onChange={(e) => onUpdateSettings({ courtFee: e.target.value === '' ? '' : Number(e.target.value) })}
              style={{ width: 120, marginTop: 10 }}
            />
          </label>
          <label>
            <div className="muted">Shuttle price (₱ each)</div>
            <input
              type="number"
              min="0"
              value={shuttlePrice}
              onChange={(e) => onUpdateSettings({ shuttlePrice: e.target.value === '' ? '' : Number(e.target.value) })}
              style={{ width: 120, marginTop: 10 }}
            />
          </label>
          <label>
            <div className="muted"># of courts</div>
            <input
              type="number"
              min="1"
              max="12"
              value={numCourts}
              onChange={(e) => onUpdateSettings({ numCourts: e.target.value === '' ? '' : Number(e.target.value) })}
              style={{ width: 90, marginTop: 10 }}
            />
          </label>
        </div>
      )}
    </div>
  )
}
