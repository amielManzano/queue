import { randomUUID } from 'node:crypto'
import { imageLeaderboardPlayers as players, imageLeaderboardSourceCount } from '../src/utils/imageLeaderboardData.js'

const emailIndex = process.argv.indexOf('--email')
const email = emailIndex >= 0 ? process.argv[emailIndex + 1] : ''
const apply = process.argv.includes('--apply')

if (!email) {
  console.error('Pass the target account explicitly with --email <account-email>.')
  process.exitCode = 1
} else if (!apply) {
  console.log(`Dry run for ${email}:`)
  console.log(`- Replace its existing sessions and overall totals with data transcribed from ${imageLeaderboardSourceCount} images.`)
  console.log('- Preserve the account profile and existing permanent overall QR token when present.')
  console.log(`- Import ${players.length} unique players; create a fresh session with all imported players.`)
  console.table(players.map(({ name, wins, losses, gamesPlayed, points }) => ({
    name, wins, losses, games: gamesPlayed, points
  })))
  console.log('No Firebase data changed. Re-run with --apply to perform the replacement.')
} else {
  const [{ applicationDefault, initializeApp }, { getAuth }, { FieldValue, getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/auth'),
    import('firebase-admin/firestore')
  ])
  const app = initializeApp({
    credential: applicationDefault(),
    projectId: process.env.GCLOUD_PROJECT || 'stp-queue'
  })
  const auth = getAuth(app)
  const db = getFirestore(app)
  const account = await auth.getUserByEmail(email)
  const profileRef = db.collection('users').doc(account.uid)
  const profileSnapshot = await profileRef.get()
  if (!profileSnapshot.exists) throw new Error(`No app profile found for ${email}; nothing was changed.`)

  const profile = profileSnapshot.data()
  const now = Date.now()
  const sessionId = `${account.uid}-image-import-${now.toString(36)}`
  const sessionShareToken = randomUUID().replaceAll('-', '').slice(0, 20)
  const sessionPlayers = players.map((player) => ({
    ...player,
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
    points: 0
  }))
  const session = {
    ownerUid: account.uid,
    sessionName: 'Image data import',
    createdAt: FieldValue.serverTimestamp(),
    courtFee: 300,
    shuttlePrice: 100,
    numCourts: 2,
    players: sessionPlayers,
    queue: [],
    matchQueue: [],
    courts: [1, 2].map((number) => ({
      id: `court-${number}`,
      name: `Court ${number}`,
      status: 'empty',
      teamA: [],
      teamB: []
    })),
    games: [],
    shareToken: sessionShareToken
  }

  const [ownedSessions, ownedPublicSessions, legacySession] = await Promise.all([
    db.collection('sessions').where('ownerUid', '==', account.uid).get(),
    db.collection('publicSessions').where('ownerUid', '==', account.uid).get(),
    db.collection('sessions').doc(account.uid).get()
  ])
  const existingOverallShare = ownedPublicSessions.docs.find((document) => document.data().publicType === 'overall')
  const overallShareToken = profile.overallShareToken
    || existingOverallShare?.id
    || randomUUID().replaceAll('-', '').slice(0, 20)
  const oldSessions = new Map(ownedSessions.docs.map((document) => [document.id, document.data()]))
  if (legacySession.exists) oldSessions.set(account.uid, legacySession.data())
  const oldSessionTokens = [...new Set([...oldSessions.values()].map((item) => item.shareToken).filter(Boolean))]
  const publicRefs = ownedPublicSessions.docs
    .filter((document) => document.id !== overallShareToken)
    .map((document) => document.ref)

  const replacement = db.batch()
  replacement.set(db.collection('sessions').doc(sessionId), session)
  replacement.set(db.collection('overallLeaderboards').doc(account.uid), {
    ownerUid: account.uid,
    players,
    updatedAt: FieldValue.serverTimestamp()
  })
  replacement.set(db.collection('publicSessions').doc(overallShareToken), {
    publicType: 'overall',
    sessionId: `${account.uid}-overall`,
    ownerUid: account.uid,
    sessionName: profile.clubName || 'Overall leaderboard',
    sessionCreatedAt: null,
    players,
    queue: [],
    matchQueue: [],
    courts: [],
    games: [],
    createdAt: FieldValue.serverTimestamp(),
    active: true,
    expiresAt: new Date('9999-12-31T23:59:59.999Z')
  })
  replacement.set(db.collection('publicSessions').doc(sessionShareToken), {
    sessionId,
    ownerUid: account.uid,
    sessionName: session.sessionName,
    sessionCreatedAt: session.createdAt,
    courtFee: session.courtFee,
    shuttlePrice: session.shuttlePrice,
    players: session.players,
    queue: [],
    matchQueue: [],
    courts: session.courts,
    games: [],
    createdAt: FieldValue.serverTimestamp(),
    active: true,
    expiresAt: new Date('9999-12-31T23:59:59.999Z')
  })
  replacement.set(profileRef, {
    activeSessionId: sessionId,
    overallShareToken,
    overallLeaderboard: players,
    accountDataResetAt: FieldValue.serverTimestamp()
  }, { merge: true })
  await replacement.commit()

  for (const [oldId, oldSession] of oldSessions) {
    const emptyState = {
      ...oldSession,
      ownerUid: account.uid,
      sessionName: 'Archived after image import',
      players: [],
      queue: [],
      matchQueue: [],
      courts: [],
      games: [],
      shareToken: null
    }
    await db.collection('sessions').doc(oldId).set(emptyState)
  }

  for (const token of oldSessionTokens) {
    if (token !== sessionShareToken) {
      await db.collection('publicSessions').doc(token).set({ active: false }, { merge: true })
    }
  }

  const oldSessionIds = [...oldSessions.keys()]
  for (let start = 0; start < publicRefs.length; start += 450) {
    const batch = db.batch()
    publicRefs.slice(start, start + 450).forEach((ref) => batch.delete(ref))
    await batch.commit()
  }

  console.log(`Replaced app data for ${email}.`)
  console.log(`Imported ${players.length} players from ${imageLeaderboardSourceCount} images.`)
  console.log(`Archived ${oldSessionIds.length} old session records and expired ${oldSessionTokens.length} old session QR links.`)
  console.log('The account profile and permanent overall QR were preserved.')
}
