import { initializeApp } from 'firebase/app'
import {
  initializeFirestore,
  doc,
  collection,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyA9kdZEg1Vq5ftbDrlr-MhzeLRNYgfZamc",
  authDomain: "stp-queue.firebaseapp.com",
  projectId: "stp-queue",
  storageBucket: "stp-queue.firebasestorage.app",
  messagingSenderId: "452109703533",
  appId: "1:452109703533:web:d49f139968f2ccf407a264",
  measurementId: "G-NTYPKDKM9F"
};

const app = initializeApp(firebaseConfig)

// Replace getFirestore() with initializeFirestore and force long polling
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
})

const SESSIONS = 'sessions'

export function sessionRef(sessionId) {
  if (!sessionId) throw new Error('sessionId is required for sessionRef()')
  return doc(db, SESSIONS, sessionId)
}

// One-time read. Returns the doc's data, or null if it doesn't exist yet.
// Used to reconcile local vs. remote BEFORE attaching the live listener,
// so we never race a stale/empty snapshot against fresh local data.
export async function fetchSession(sessionId) {
  const snap = await getDoc(sessionRef(sessionId))
  return snap.exists() ? snap.data() : null
}

// Only initializes the session doc if it doesn't already exist.
// Never overwrites live data — safe to call on every app load.
export async function createSession(sessionId, initialState) {
  const ref = sessionRef(sessionId)
  const existing = await getDoc(ref)

  if (existing.exists()) {
    return existing.data()
  }

  await setDoc(ref, {
    ...initialState,
    createdAt: serverTimestamp()
  })
  return initialState
}

export async function saveSession(sessionId, state) {
  return setDoc(sessionRef(sessionId), state, { merge: true })
}

export function listenToSession(sessionId, callback, onError) {
  if (!sessionId) return () => {}

  return onSnapshot(
    sessionRef(sessionId),
    (snap) => {
      if (snap.exists()) {
        callback(snap.data())
      }
    },
    (error) => {
      console.error(`[Firebase] Listener error for session ${sessionId}:`, error)
      if (onError) onError(error)
    }
  )
}

export function getSessionsQuery() {
  return query(collection(db, SESSIONS), orderBy('createdAt', 'desc'))
}