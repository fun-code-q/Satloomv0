import { initializeApp } from "firebase/app"
import { getDatabase } from "firebase/database"
import { getStorage } from "firebase/storage"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

let app
let database
let storage
let auth

try {
  // Validate required config
  if (!firebaseConfig.apiKey || !firebaseConfig.databaseURL || !firebaseConfig.projectId) {
    throw new Error("Missing required Firebase configuration")
  }

  console.log("Initializing Firebase with config:", {
    apiKey: firebaseConfig.apiKey ? "✓" : "✗",
    authDomain: firebaseConfig.authDomain ? "✓" : "✗",
    databaseURL: firebaseConfig.databaseURL ? "✓" : "✗",
    projectId: firebaseConfig.projectId ? "✓" : "✗",
    storageBucket: firebaseConfig.storageBucket ? "✓" : "✗",
    messagingSenderId: firebaseConfig.messagingSenderId ? "✓" : "✗",
    appId: firebaseConfig.appId ? "✓" : "✗",
  })

  app = initializeApp(firebaseConfig)
  database = getDatabase(app)
  storage = getStorage(app)
  auth = getAuth(app)

  console.log("✅ Firebase initialized successfully")
  console.log("📊 Database URL:", firebaseConfig.databaseURL)
  console.log("🔑 Project ID:", firebaseConfig.projectId)
} catch (error) {
  console.error("❌ Firebase initialization error:", error)
  console.error("🔧 Please check your environment variables:")
  console.error("- NEXT_PUBLIC_FIREBASE_API_KEY")
  console.error("- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN")
  console.error("- NEXT_PUBLIC_FIREBASE_DATABASE_URL")
  console.error("- NEXT_PUBLIC_FIREBASE_PROJECT_ID")
  console.error("- NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET")
  console.error("- NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID")
  console.error("- NEXT_PUBLIC_FIREBASE_APP_ID")

  app = null
  database = null
  storage = null
  auth = null
}

export { database, storage, auth }
export default app
