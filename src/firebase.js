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
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  deleteUser
} from 'firebase/auth'

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

export const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()

// Each Google account is only ever allowed one signed-in session doc, keyed by uid,
// so a user's data can never collide with or leak into another user's session.
export function googleLogin() {
  return signInWithPopup(auth, googleProvider)
}

export async function register(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password)
  if (displayName) await updateProfile(cred.user, { displayName })
  return cred
}

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password)
}

// Rolls back a just-created auth account if code redemption fails right
// after (e.g. a race where someone else claimed the same code first).
export function deleteAccount(user) {
  return deleteUser(user)
}

export function logout() {
  return signOut(auth)
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}

const USERS = 'users'
const CLUBS = 'clubs'
const ADMINS = 'admins'

export function userRef(uid) {
  return doc(db, USERS, uid)
}

// Presence of a users/{uid} doc = this account already redeemed a club
// access code in the past, so returning members never need to re-enter one.
export async function getUserProfile(uid) {
  const snap = await getDoc(userRef(uid))
  return snap.exists() ? snap.data() : null
}

export async function createUserProfile(uid, data) {
  return setDoc(userRef(uid), { ...data, createdAt: serverTimestamp() })
}

// Live list of every registered member, newest first — powers the Clubs
// admin page's "Users" table.
export function listenToUsers(callback, onError) {
  const q = query(collection(db, USERS), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
    (error) => {
      console.error('[Firebase] Users listener error:', error)
      if (onError) onError(error)
    }
  )
}

export async function isSuperAdmin(uid) {
  const snap = await getDoc(doc(db, ADMINS, uid))
  return snap.exists()
}

export function clubRef(code) {
  return doc(db, CLUBS, code)
}

// Clubs are created by the super admin from the Clubs page (each doc id is the
// access code itself). A club starts unclaimed — the first person who signs up
// with its code becomes its creator. Firestore rules should only allow the
// super admin to create clubs, and only allow a used:false -> true update (by
// the redeeming user) so a signup can claim a club but never mint new ones.
export async function createClub(code) {
  return setDoc(clubRef(code), {
    code,
    used: false,
    creatorUid: null,
    creatorName: null,
    creatorEmail: null,
    createdAt: serverTimestamp(),
    usedAt: null
  })
}

export async function getClub(code) {
  const snap = await getDoc(clubRef(code))
  return snap.exists() ? snap.data() : null
}

export async function redeemClub(code, user) {
  return setDoc(
    clubRef(code),
    {
      used: true,
      creatorUid: user.uid,
      creatorName: user.displayName || null,
      creatorEmail: user.email || null,
      usedAt: serverTimestamp()
    },
    { merge: true }
  )
}

// Fails fast (before any sign-in attempt) if a code can't be redeemed.
export async function validateAccessCode(code) {
  if (!code) {
    throw new Error('This app is invite-only. Enter the access code your club owner gave you to create an account.')
  }
  const club = await getClub(code)
  if (!club) throw new Error('Invalid access code.')
  if (club.used) throw new Error('This access code has already been used.')
}

// Actually redeems the code + creates the member profile once sign-in has
// succeeded. Firestore rules still reject a used:false->true update if
// someone else claimed the same code in the meantime.
export async function claimAccessCodeForUser(fbUser, code) {
  await redeemClub(code, fbUser)
  await createUserProfile(fbUser.uid, {
    email: fbUser.email,
    displayName: fbUser.displayName,
    clubCode: code
  })
}

// Stashes the code a signup is about to redeem so the auth-state listener
// (the only place that can safely gate app access — see App.jsx) can finish
// redeeming it right after sign-in succeeds, without racing the UI.
let pendingSignupCode = null
export function setPendingSignupCode(code) {
  pendingSignupCode = code
}
export function takePendingSignupCode() {
  const code = pendingSignupCode
  pendingSignupCode = null
  return code
}

export function listenToClubs(callback, onError) {
  const q = query(collection(db, CLUBS), orderBy('createdAt', 'desc'))
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => d.data())),
    (error) => {
      console.error('[Firebase] Clubs listener error:', error)
      if (onError) onError(error)
    }
  )
}

const SESSIONS = 'sessions'
const PUBLIC_SESSIONS = 'publicSessions'

export function sessionRef(sessionId) {
  if (!sessionId) throw new Error('sessionId is required for sessionRef()')
  return doc(db, SESSIONS, sessionId)
}

export function publicSessionRef(token) {
  if (!token) throw new Error('token is required for publicSessionRef()')
  return doc(db, PUBLIC_SESSIONS, token)
}

export async function createPublicSession(token, data) {
  return setDoc(publicSessionRef(token), {
    ...data,
    ownerUid: data.ownerUid,
    createdAt: serverTimestamp(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
  })
}

export async function savePublicSession(token, data) {
  return setDoc(publicSessionRef(token), data, { merge: true })
}

export async function fetchPublicSession(token) {
  const snap = await getDoc(publicSessionRef(token))
  if (!snap.exists()) return null
  const data = snap.data()
  const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
  return expiresAt && expiresAt.getTime() <= Date.now() ? null : data
}

export function listenToPublicSession(token, callback, onError) {
  if (!token) return () => {}
  return onSnapshot(
    publicSessionRef(token),
    (snap) => {
      if (!snap.exists()) return callback(null)
      const data = snap.data()
      const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
      callback(expiresAt && expiresAt.getTime() <= Date.now() ? null : data)
    },
    onError
  )
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