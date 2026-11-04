import { getApp, getApps, initializeApp, type FirebaseOptions } from 'firebase/app'
import { getAuth } from 'firebase/auth'

export function getFirebaseAuth() {
  const config: FirebaseOptions = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  }
  const requiredValues: Array<[string, string | undefined]> = [
    ['NEXT_PUBLIC_FIREBASE_API_KEY', config.apiKey],
    ['NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN', config.authDomain],
    ['NEXT_PUBLIC_FIREBASE_PROJECT_ID', config.projectId],
    ['NEXT_PUBLIC_FIREBASE_APP_ID', config.appId],
  ]
  const missingValues = requiredValues.filter(([, value]) => !value).map(([name]) => name)

  if (missingValues.length > 0) {
    throw new Error(
      `Missing Firebase configuration: ${missingValues.join(', ')}. Copy .env.local.example to .env.local and fill in the Firebase web app values.`,
    )
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(config)
  return getAuth(app)
}
