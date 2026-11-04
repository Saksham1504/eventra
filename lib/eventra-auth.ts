import {
  browserLocalPersistence,
  browserSessionPersistence,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth'
import { loginToEventra, getMe, type EventraUser } from '@/lib/eventra-api'
import { getFirebaseAuth } from '@/lib/firebase'

// ─── Dev mock mode ────────────────────────────────────────────────────────────
// When NEXT_PUBLIC_FIREBASE_API_KEY starts with "dev-" we skip real Firebase
// and use the backend mock-token auth instead.
const IS_DEV_MOCK = (process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '').startsWith('dev-')

function roleFromEmail(email: string): string {
  if (email.includes('admin')) return 'mock-admin'
  if (email.includes('organizer') || email.includes('org')) return 'mock-organizer'
  return 'mock-student1'
}

async function devSignIn(mockToken: string): Promise<EventraUser> {
  // Store the token so auth-context picks it up
  if (typeof window !== 'undefined') {
    window.__eventra_dev_token = mockToken
  }
  return getMe(mockToken)
}

// ─── Real Firebase helpers ────────────────────────────────────────────────────
async function finishSignIn(
  user: User,
  auth: ReturnType<typeof getFirebaseAuth>,
): Promise<EventraUser> {
  try {
    return await loginToEventra(await user.getIdToken())
  } catch (error) {
    try {
      await signOut(auth)
    } catch (cleanupError) {
      console.error('Could not clear Firebase session after Eventra sign-in failed.', cleanupError)
    }
    throw error
  }
}

export async function signInWithEventraEmail(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<EventraUser> {
  if (IS_DEV_MOCK) {
    const token = roleFromEmail(email)
    return devSignIn(token)
  }
  const auth = getFirebaseAuth()
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return finishSignIn(credential.user, auth)
}

export async function signInWithEventraGoogle(rememberMe: boolean): Promise<EventraUser> {
  if (IS_DEV_MOCK) {
    return devSignIn('mock-student1')
  }
  const auth = getFirebaseAuth()
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
  const credential = await signInWithPopup(auth, new GoogleAuthProvider())
  return finishSignIn(credential.user, auth)
}

export async function sendEventraPasswordReset(email: string): Promise<void> {
  if (IS_DEV_MOCK) {
    // Simulate success silently in dev
    return
  }
  await sendPasswordResetEmail(getFirebaseAuth(), email)
}

export function getEventraAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') {
    switch (error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'The email or password is incorrect.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.'
      case 'auth/popup-closed-by-user':
        return 'Google sign-in was closed before it finished.'
      case 'auth/popup-blocked':
        return 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.'
      case 'auth/unauthorized-domain':
        return 'This site is not authorized for Firebase sign-in. Add localhost to Firebase authorized domains.'
      case 'auth/invalid-email':
        return 'Enter a valid email address.'
    }
  }

  return error instanceof Error ? error.message : 'Sign-in failed. Please try again.'
}

// Allow TypeScript to know about the global
declare global {
  interface Window {
    __eventra_dev_token?: string
  }
}
