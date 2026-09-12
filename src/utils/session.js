export async function safelyExpirePublicSession(expireFn, token) {
  if (!token) return

  try {
    await expireFn(token)
  } catch (error) {
    console.warn('[Session] Failed to expire public share before creating a new session:', error)
  }
}
