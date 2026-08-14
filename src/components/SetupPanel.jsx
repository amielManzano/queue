import React, { useState } from 'react'

export default function SetupPanel({ sessionId, connected, onConnect, courtFee, shuttlePrice, numCourts, onUpdateSettings, onClearSession, user, onLogout }) {
  const [idInput, setIdInput] = useState(sessionId || '')
  const displayName = user?.displayName || user?.email || ''
  const initial = displayName ? displayName.charAt(0).toUpperCase() : '?'

  return (
    <div className="panel">
      <h2>Settings</h2>

      {user && (
        <div className="settings-card">
          <div className="settings-card-title">Account</div>
          <div className="account-row">
            <div className="account-identity">
              <div className="account-avatar">{initial}</div>
              <div style={{ minWidth: 0 }}>
                <div className="account-name">{user.displayName || 'Signed in'}</div>
                {user.email && <div className="account-email">{user.email}</div>}
              </div>
            </div>
            <button className="btn secondary" onClick={() => onLogout && onLogout()}>Sign Out</button>
          </div>
        </div>
      )}

      <div className="settings-card">
        <div className="settings-card-title">Session</div>
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
          <div className="account-row">
            <span className="status-pill"><span className="dot" /> Live — synced via Firebase</span>
            <button className="btn secondary" onClick={() => onClearSession && onClearSession()}>Clear Session</button>
          </div>
        )}

        {connected && (
          <div className="settings-field-grid">
            <div className="settings-field">
              <label>Court fee (total, ₱)</label>
              <input
                type="number"
                min="0"
                value={courtFee}
                onChange={(e) => onUpdateSettings({ courtFee: Number(e.target.value) })}
              />
            </div>
            <div className="settings-field">
              <label>Shuttle price (₱ each)</label>
              <input
                type="number"
                min="0"
                value={shuttlePrice}
                onChange={(e) => onUpdateSettings({ shuttlePrice: Number(e.target.value) })}
              />
            </div>
            <div className="settings-field">
              <label># of courts</label>
              <input
                type="number"
                min="1"
                max="12"
                value={numCourts}
                onChange={(e) => onUpdateSettings({ numCourts: Number(e.target.value) })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

