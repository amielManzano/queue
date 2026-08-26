import React, { useState } from 'react'

export default function SetupPanel({ sessionId, connected, onConnect, firebaseError, courtFee, shuttlePrice, numCourts, onUpdateSettings, onClearSession, user, onLogout }) {
  const [idInput, setIdInput] = useState(sessionId || '')
  const displayName = user?.displayName || user?.email || ''
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?'

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
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span className="muted">
            Session: <strong style={{ color: 'var(--ink)' }}>{sessionId}</strong> — synced live via Firebase
          </span>
          <div>
            <button className="btn secondary" onClick={() => onClearSession && onClearSession()}>Clear Session</button>
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
              onChange={(e) => onUpdateSettings({ courtFee: Number(e.target.value) })}
              style={{ width: 120 }}
            />
          </label>
          <label>
            <div className="muted">Shuttle price (₱ each)</div>
            <input
              type="number"
              min="0"
              value={shuttlePrice}
              onChange={(e) => onUpdateSettings({ shuttlePrice: Number(e.target.value) })}
              style={{ width: 120 }}
            />
          </label>
          <label>
            <div className="muted"># of courts</div>
            <input
              type="number"
              min="1"
              max="12"
              value={numCourts}
              onChange={(e) => onUpdateSettings({ numCourts: Number(e.target.value) })}
              style={{ width: 90 }}
            />
          </label>
        </div>
      )}
    </div>
  )
}
