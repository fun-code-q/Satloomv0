import { initializeApp } from "firebase/app"
import { getDatabase } from "firebase/database"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

// Validate required configuration
if (!firebaseConfig.projectId) {
  console.error("Firebase Project ID is missing")
}

if (!firebaseConfig.databaseURL) {
  console.error("Firebase Database URL is missing")
}

// Initialize Firebase
let app
let database

try {
  app = initializeApp(firebaseConfig)

  // Only initialize database if we have the required config
  if (firebaseConfig.databaseURL && firebaseConfig.projectId) {
    database = getDatabase(app)
  } else {
    console.warn("Firebase Database not initialized due to missing configuration")
    database = null
  }
} catch (error) {
  console.error("Firebase initialization error:", error)
  app = null
  database = null
}

export { database }
export default app
