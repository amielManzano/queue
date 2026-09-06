import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'

const sourceUid = 'Li5gnY4XR7d3sJHHA6UomISOU003'
const destinationUid = 'XeZxOieeweaY9JX8eiUNhjK0g8Q2'
const apply = process.argv.includes('--apply')

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service-account JSON path.')
}

process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS
  .replace(/[\r\n]/g, '')
  .trim()

if (/^\/[a-zA-Z]\//.test(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS
    .replace(/^\/([a-zA-Z])\//, '$1:/')
}

initializeApp({ credential: applicationDefault() })
const db = getFirestore()

async function getOwnedDocuments(collectionName) {
  const snapshot = await db.collection(collectionName)
    .where('ownerUid', '==', sourceUid)
    .get()
  return snapshot.docs
}

async function main() {
  const sourceProfile = await db.collection('users').doc(sourceUid).get()
  const sourceLegacySession = await db.collection('sessions').doc(sourceUid).get()
  const ownedSessions = await getOwnedDocuments('sessions')
  const ownedPublicSessions = await getOwnedDocuments('publicSessions')

  const sessionDocs = new Map(ownedSessions.map((snapshot) => [snapshot.id, snapshot]))
  if (sourceLegacySession.exists) sessionDocs.set(sourceUid, sourceLegacySession)

  console.log(`Source profile: ${sourceProfile.exists ? 'found' : 'missing'}`)
  console.log(`Sessions to copy: ${sessionDocs.size}`)
  console.log(`Public links to copy: ${ownedPublicSessions.length}`)

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to write the migration.')
    return
  }

  const writes = []
  if (sourceProfile.exists) {
    writes.push(db.collection('users').doc(destinationUid).set({
      ...sourceProfile.data(),
      migratedFromUid: sourceUid,
      migratedAt: FieldValue.serverTimestamp()
    }, { merge: true }))
  }

  for (const snapshot of sessionDocs.values()) {
    writes.push(db.collection('sessions').doc(snapshot.id).set({
      ...snapshot.data(),
      ownerUid: destinationUid
    }, { merge: true }))
  }

  for (const snapshot of ownedPublicSessions) {
    writes.push(db.collection('publicSessions').doc(snapshot.id).set({
      ...snapshot.data(),
      ownerUid: destinationUid
    }, { merge: true }))
  }

  await Promise.all(writes)
  console.log('Migration completed.')
  console.log('The destination account now owns the copied profile, sessions, and public links.')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
