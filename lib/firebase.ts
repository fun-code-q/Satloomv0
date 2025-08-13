import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getDatabase, type Database } from "firebase/database"

let app: FirebaseApp | undefined
let database: Database | undefined

try {
  // Check if we have the required environment variables
  const requiredEnvVars = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  // Check for missing required variables
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([key, value]) => !value)
    .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.toUpperCase()}`)

  if (missingVars.length > 0) {
    console.warn("Missing Firebase environment variables:", missingVars)
    console.warn("Firebase features will be disabled")
  } else {
    // Only initialize if we have all required variables
    const firebaseConfig = {
      apiKey: requiredEnvVars.apiKey,
      authDomain: requiredEnvVars.authDomain,
      databaseURL: requiredEnvVars.databaseURL,
      projectId: requiredEnvVars.projectId,
      storageBucket: requiredEnvVars.storageBucket,
      messagingSenderId: requiredEnvVars.messagingSenderId,
      appId: requiredEnvVars.appId,
    }

    // Initialize Firebase only if it hasn't been initialized already
    if (!getApps().length) {
      app = initializeApp(firebaseConfig)
      console.log("Firebase initialized successfully")
    } else {
      app = getApps()[0]
      console.log("Using existing Firebase app")
    }

    // Initialize Realtime Database
    if (app && requiredEnvVars.databaseURL) {
      database = getDatabase(app)
      console.log("Firebase Realtime Database initialized")
    }
  }
} catch (error) {
  console.error("Firebase initialization error:", error)
  console.warn("Firebase features will be disabled")
}

export { app, database }
