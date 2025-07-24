import { initializeApp } from "firebase/app"
import { getDatabase } from "firebase/database"
import { getStorage } from "firebase/storage"
import { getAuth } from "firebase/auth"

const firebaseConfig = {
  apiKey: "AIzaSyDeksN3qPZCmNuoASlEqG38XVmag6ecTh8",
  authDomain: "satloom-rtc.firebaseapp.com",
  databaseURL: "https://satloom-rtc-default-rtdb.firebaseio.com",
  projectId: "satloom-rtc",
  storageBucket: "satloom-rtc.appspot.com",
  messagingSenderId: "273627860564",
  appId: "1:273627860564:web:c326b1bb6ffcb32fb0e7c1",
}

let app
let database
let storage
let auth

try {
  app = initializeApp(firebaseConfig)
  database = getDatabase(app)
  storage = getStorage(app)
  auth = getAuth(app)

  console.log("Firebase initialized successfully")
  console.log("Database URL:", firebaseConfig.databaseURL)
} catch (error) {
  console.error("Firebase initialization error:", error)
  // Fallback for development
  app = null
  database = null
  storage = null
  auth = null
}

export { database, storage, auth }
export default app
