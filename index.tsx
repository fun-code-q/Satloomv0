"use client"

import { useState, useEffect } from "react"
import { LandingPage } from "@/components/landing-page"
import { ProfileModal } from "@/components/profile-modal"
import { ChatInterface } from "@/components/chat-interface"
import { database } from "@/lib/firebase"
import { ref, set, get, remove } from "firebase/database"
import { ThemeProvider } from "@/contexts/theme-context"
import { NotificationSystem } from "@/utils/notification-system"

type AppState = "landing" | "profile" | "chat"

interface UserProfile {
  name: string
  avatar?: string
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("landing")
  const [currentRoomId, setCurrentRoomId] = useState<string>("")
  const [userProfile, setUserProfile] = useState<UserProfile>({ name: "" })
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [isCreatingRoom, setIsCreatingRoom] = useState(false)
  const [error, setError] = useState<string>("")
  const [isRoomCreator, setIsRoomCreator] = useState(false)

  const notificationSystem = NotificationSystem.getInstance()

  useEffect(() => {
    console.log("App: Current room ID:", currentRoomId)
    console.log("App: Current state:", appState)
  }, [currentRoomId, appState])

  useEffect(() => {
    // Check for saved profile
    const savedProfile = localStorage.getItem("satloom-profile")
    if (savedProfile) {
      try {
        const profile = JSON.parse(savedProfile)
        setUserProfile(profile)
        console.log("App: Loaded saved profile:", profile)
      } catch (error) {
        console.error("Error loading saved profile:", error)
      }
    }

    // Check for room ID in URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const roomFromUrl = urlParams.get("room")
    console.log("App: Room from URL:", roomFromUrl)
    if (roomFromUrl && roomFromUrl.trim()) {
      handleJoinRoom(roomFromUrl)
    }
  }, [])

  const generateRoomId = () => {
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase()
    console.log("App: Generated room ID:", newRoomId)
    return newRoomId
  }

  const handleCreateRoom = async () => {
    console.log("App: Creating new room")
    setIsCreatingRoom(true)
    setError("")
    setShowProfileModal(true)
    setIsRoomCreator(true) // Mark as room creator
  }

  const handleJoinRoom = async (roomId: string) => {
    console.log("App: Attempting to join room:", roomId)

    if (!roomId.trim()) {
      setError("Please enter a room ID")
      return
    }

    const cleanRoomId = roomId.trim().toUpperCase()
    console.log("App: Clean room ID:", cleanRoomId)

    setError("")
    setCurrentRoomId(cleanRoomId)
    setIsRoomCreator(false) // Not the room creator when joining

    try {
      if (!database) {
        setError("Database not available. Please try again later.")
        setCurrentRoomId("") // Clear on error
        return
      }

      // Check if room exists
      const roomRef = ref(database, `rooms/${cleanRoomId}`)
      const snapshot = await get(roomRef)

      if (!snapshot.exists()) {
        setError("Room not found. Please check the room ID.")
        setCurrentRoomId("") // Clear on error
        return
      }

      // Check if user is the creator of this room
      const roomData = snapshot.val()
      if (roomData.createdBy === userProfile.name) {
        setIsRoomCreator(true)
      }

      console.log("App: Successfully found room:", cleanRoomId)
      setShowProfileModal(true)
    } catch (error) {
      console.error("Error checking room:", error)
      setError("Failed to connect to room. Please try again.")
      setCurrentRoomId("") // Clear on error
    }
  }

  const handleProfileSave = async (profile: UserProfile) => {
    console.log("App: Saving profile and joining room")
    try {
      setUserProfile(profile)

      // Save profile to localStorage
      localStorage.setItem("satloom-profile", JSON.stringify(profile))

      let roomId = currentRoomId

      if (isCreatingRoom || !roomId) {
        // Creating new room
        roomId = generateRoomId()
        console.log("App: Creating new room with ID:", roomId)
        setCurrentRoomId(roomId)
        setIsRoomCreator(true) // Ensure creator flag is set

        if (database) {
          // Create room in Firebase
          const roomRef = ref(database, `rooms/${roomId}`)
          await set(roomRef, {
            createdAt: Date.now(),
            createdBy: profile.name,
            members: {
              [profile.name]: {
                name: profile.name,
                avatar: profile.avatar || null,
                joinedAt: Date.now(),
              },
            },
          })
          console.log("App: Room created in Firebase:", roomId)
        }

        notificationSystem.roomCreated(roomId)
      } else {
        // Joining existing room - add user to members
        console.log("App: Joining existing room:", roomId)
        if (database) {
          const memberRef = ref(database, `rooms/${roomId}/members/${profile.name}`)
          await set(memberRef, {
            name: profile.name,
            avatar: profile.avatar || null,
            joinedAt: Date.now(),
          })
          console.log("App: Added user to existing room:", roomId)
        }
      }

      // Ensure room ID is set before changing state
      if (roomId && roomId.trim()) {
        console.log("App: Final room ID before entering chat:", roomId)
        setCurrentRoomId(roomId)
        setAppState("chat")
        setShowProfileModal(false)
        setIsCreatingRoom(false)

        // Update URL without refreshing the page - ensure room ID is included
        const newUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`
        window.history.pushState({}, "", newUrl)
        console.log("App: Updated URL to:", newUrl)
      } else {
        throw new Error("Room ID is missing or invalid")
      }
    } catch (error) {
      console.error("Error saving profile:", error)
      setError("Failed to join room. Please try again.")
      notificationSystem.error("Failed to join room")
      // Reset state on error
      setCurrentRoomId("")
      setAppState("landing")
    }
  }

  const handleLeaveRoom = async () => {
    console.log("App: Leaving room:", currentRoomId)
    try {
      // Clear the room from URL
      window.history.pushState({}, "", window.location.origin)

      // If user was the host and room still exists, clean it up
      if (database && currentRoomId && userProfile.name) {
        const roomRef = ref(database, `rooms/${currentRoomId}`)
        const snapshot = await get(roomRef)

        if (snapshot.exists()) {
          const roomData = snapshot.val()
          // If current user was the host, remove the entire room
          if (roomData.createdBy === userProfile.name) {
            await remove(roomRef)

            // Also clean up related data
            const callsRef = ref(database, `calls/${currentRoomId}`)
            await remove(callsRef)

            const gamesRef = ref(database, `games/${currentRoomId}`)
            await remove(gamesRef)
          }
        }
      }
    } catch (error) {
      console.error("Error cleaning up room:", error)
    }

    // Reset state
    setAppState("landing")
    setCurrentRoomId("")
    setIsCreatingRoom(false)
    setError("")
  }

  const handleProfileModalClose = () => {
    console.log("App: Profile modal closed")
    setShowProfileModal(false)
    setIsCreatingRoom(false)
    setCurrentRoomId("")
    setError("")

    // Clear URL if user cancels
    window.history.pushState({}, "", window.location.origin)
  }

  // Debug render
  console.log("App: Rendering with state:", { appState, currentRoomId, isCreatingRoom })

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-900">
        {appState === "landing" && (
          <LandingPage onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} error={error} />
        )}

        {appState === "chat" && currentRoomId && (
          <ChatInterface
            roomId={currentRoomId}
            userProfile={userProfile}
            onLeave={handleLeaveRoom}
            isHost={isRoomCreator}
          />
        )}

        {appState === "chat" && !currentRoomId && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-white text-center">
              <div className="text-xl mb-4">Error: No room ID available</div>
              <button
                onClick={() => setAppState("landing")}
                className="bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded"
              >
                Return to Home
              </button>
            </div>
          </div>
        )}

        <ProfileModal
          isOpen={showProfileModal}
          onClose={handleProfileModalClose}
          onSave={handleProfileSave}
          defaultProfile={userProfile}
        />
      </div>
    </ThemeProvider>
  )
}
