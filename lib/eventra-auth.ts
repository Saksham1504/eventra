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
import { loginToEventra, type EventraUser } from '@/lib/eventra-api'
import { getFirebaseAuth } from '@/lib/firebase'

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
  const auth = getFirebaseAuth()
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return finishSignIn(credential.user, auth)
}

export async function signInWithEventraGoogle(rememberMe: boolean): Promise<EventraUser> {
  const auth = getFirebaseAuth()
  await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
  const credential = await signInWithPopup(auth, new GoogleAuthProvider())
  return finishSignIn(credential.user, auth)
}

export async function sendEventraPasswordReset(email: string): Promise<void> {
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
