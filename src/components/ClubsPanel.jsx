import React, { useEffect, useState } from 'react'
import { listenToClubs, createClub, listenToUsers } from '../firebase'

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars (0/O, 1/I)

function generateClubCode() {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  const group = (offset) =>
    Array.from(bytes.slice(offset, offset + 4), (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
  return `STP-${group(0)}-${group(4)}`
}

function formatDate(ts) {
  if (!ts) return '—'
  const date = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function ClubsPanel() {
  const [clubs, setClubs] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiedCode, setCopiedCode] = useState('')

  useEffect(() => {
    const unsubscribe = listenToClubs(
      (list) => {
        setClubs(list)
        setLoading(false)
      },
      (err) => {
        setError('Failed to load clubs: ' + err.message)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [])

  useEffect(() => {
    const unsubscribe = listenToUsers(
      (list) => {
        setUsers(list)
        setUsersLoading(false)
      },
      (err) => {
        setError('Failed to load users: ' + err.message)
        setUsersLoading(false)
      }
    )
    return unsubscribe
  }, [])

  const handleAddClub = async () => {
    setError('')
    setCreating(true)
    try {
      const code = generateClubCode()
      await createClub(code)
    } catch (err) {
      console.error('Failed to create club:', err)
      setError('Failed to create club. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (code) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      setTimeout(() => setCopiedCode(''), 1500)
    } catch (err) {
      /* clipboard unavailable — ignore */
    }
  }

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>Clubs</h2>
        <button className="btn" onClick={handleAddClub} disabled={creating}>
          {creating ? 'Creating…' : '+ Add Club'}
        </button>
      </div>

      {error && (
        <div className="login-error" style={{ color: '#8d2a2a', background: '#fff2f2', border: '1px solid #f1c0c0', marginTop: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="empty-state">Loading clubs…</div>
      ) : clubs.length === 0 ? (
        <div className="empty-state">No clubs yet. Click "+ Add Club" to generate an access code for a new club owner.</div>
      ) : (
        <table style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Access Code</th>
              <th>Club Creator</th>
              <th>Created</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((club) => (
              <tr key={club.code}>
                <td>
                  <button
                    className="btn secondary small"
                    onClick={() => handleCopy(club.code)}
                    title="Click to copy"
                    style={{ fontFamily: 'monospace', fontSize: 13 }}
                  >
                    {copiedCode === club.code ? 'Copied!' : club.code}
                  </button>
                </td>
                <td>
                  {club.creatorName || club.creatorEmail ? (
                    <div>
                      <div style={{ fontWeight: 700 }}>{club.creatorName || '—'}</div>
                      {club.creatorEmail && <div className="muted">{club.creatorEmail}</div>}
                    </div>
                  ) : (
                    <span className="muted">Unclaimed</span>
                  )}
                </td>
                <td>{formatDate(club.createdAt)}</td>
                <td>
                  <span className="status-pill" style={!club.used ? { background: 'rgba(107,114,128,0.12)', color: '#4b5563' } : undefined}>
                    <span className="dot" style={!club.used ? { background: '#9ca3af', boxShadow: '0 0 0 3px rgba(156,163,175,0.18)' } : undefined} />
                    {club.used ? 'Claimed' : 'Pending'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: 28 }}>Users</h2>
      {usersLoading ? (
        <div className="empty-state">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="empty-state">No one has signed up yet.</div>
      ) : (
        <table style={{ marginTop: 14 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Access Code Used</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.uid}>
                <td>{u.displayName || '—'}</td>
                <td>{u.email || '—'}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{u.clubCode || '—'}</td>
                <td>{formatDate(u.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
