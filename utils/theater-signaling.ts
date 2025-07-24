import { database } from "@/lib/firebase"
import { ref, set, onValue, remove } from "firebase/database"

export interface TheaterSession {
  id: string
  roomId: string
  hostId: string
  hostName: string
  videoUrl: string
  videoType: "direct" | "youtube" | "vimeo"
  status: "waiting" | "loading" | "playing" | "paused" | "ended"
  participants: string[]
  currentTime: number
  lastAction?: TheaterAction
  createdAt: number
}

export interface TheaterAction {
  type: "play" | "pause" | "seek"
  currentTime?: number
  timestamp: number
  hostId: string
  hostName: string
}

export interface TheaterInvite {
  id: string
  sessionId: string
  roomId: string
  host: string
  hostId: string
  videoTitle: string
  timestamp: number
}

export class TheaterSignaling {
  private static instance: TheaterSignaling
  private currentSession: TheaterSession | null = null
  private theaterListeners: Array<() => void> = []

  static getInstance(): TheaterSignaling {
    if (!TheaterSignaling.instance) {
      TheaterSignaling.instance = new TheaterSignaling()
    }
    return TheaterSignaling.instance
  }

  // Create a new theater session
  async createSession(
    roomId: string,
    hostName: string,
    hostId: string,
    videoUrl: string,
    videoType: "direct" | "youtube" | "vimeo",
  ): Promise<string> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const sessionId = `theater_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const session: TheaterSession = {
      id: sessionId,
      roomId,
      hostId,
      hostName,
      videoUrl,
      videoType,
      status: "waiting",
      participants: [hostId],
      currentTime: 0,
      createdAt: Date.now(),
    }

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)
    await set(sessionRef, session)

    this.currentSession = session
    return sessionId
  }

  // Send invite to all room members
  async sendInvite(roomId: string, sessionId: string, hostName: string, hostId: string, videoTitle: string) {
    if (!database) return

    const invite: TheaterInvite = {
      id: `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId,
      roomId,
      host: hostName,
      hostId,
      videoTitle,
      timestamp: Date.now(),
    }

    const inviteRef = ref(database, `rooms/${roomId}/theaterInvites/${invite.id}`)
    await set(inviteRef, invite)

    // Auto-remove invite after 30 seconds
    setTimeout(async () => {
      try {
        await remove(inviteRef)
      } catch (error) {
        console.error("Error removing theater invite:", error)
      }
    }, 30000)
  }

  // Join theater session
  async joinSession(roomId: string, sessionId: string, userId: string) {
    if (!database) return

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    // Get current session data
    const snapshot = await new Promise<any>((resolve) => {
      onValue(sessionRef, resolve, { onlyOnce: true })
    })

    const session = snapshot.val()
    if (session && !session.participants.includes(userId)) {
      const updatedParticipants = [...session.participants, userId]
      await set(ref(database, `rooms/${roomId}/theater/${sessionId}/participants`), updatedParticipants)
    }
  }

  // Send theater action (play, pause, seek)
  async sendAction(
    roomId: string,
    sessionId: string,
    type: "play" | "pause" | "seek",
    currentTime: number,
    hostId: string,
    hostName: string,
  ) {
    if (!database) return

    const action: TheaterAction = {
      type,
      currentTime,
      timestamp: Date.now(),
      hostId,
      hostName,
    }

    const actionRef = ref(database, `rooms/${roomId}/theater/${sessionId}/lastAction`)
    await set(actionRef, action)

    // Update session status
    const statusRef = ref(database, `rooms/${roomId}/theater/${sessionId}/status`)
    await set(statusRef, type === "play" ? "playing" : "paused")

    // Update current time
    const timeRef = ref(database, `rooms/${roomId}/theater/${sessionId}/currentTime`)
    await set(timeRef, currentTime)
  }

  // End theater session
  async endSession(roomId: string, sessionId: string) {
    if (!database) return

    // Update session status to ended
    const statusRef = ref(database, `rooms/${roomId}/theater/${sessionId}/status`)
    await set(statusRef, "ended")

    // Clean up after 5 seconds
    setTimeout(async () => {
      try {
        const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)
        await remove(sessionRef)
      } catch (error) {
        console.error("Error removing theater session:", error)
      }
    }, 5000)

    this.currentSession = null
  }

  // Listen for theater session updates
  listenForSession(roomId: string, sessionId: string, onUpdate: (session: TheaterSession) => void) {
    if (!database) {
      console.warn("Firebase database not initialized, theater listening disabled")
      return () => {}
    }

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const session = snapshot.val()
      if (session) {
        this.currentSession = session
        onUpdate(session)

        // If session ended, notify all participants
        if (session.status === "ended") {
          setTimeout(() => {
            onUpdate({ ...session, status: "ended" })
          }, 1000)
        }
      }
    })

    this.theaterListeners.push(unsubscribe)
    return unsubscribe
  }

  // Listen for theater invites
  listenForInvites(roomId: string, userId: string, onInvite: (invite: TheaterInvite) => void) {
    if (!database) {
      console.warn("Firebase database not initialized, theater invite listening disabled")
      return () => {}
    }

    const invitesRef = ref(database, `rooms/${roomId}/theaterInvites`)

    const unsubscribe = onValue(invitesRef, (snapshot) => {
      const invites = snapshot.val()
      if (invites) {
        Object.values(invites).forEach((invite: any) => {
          // Only show invites from other users
          if (invite.hostId !== userId) {
            onInvite(invite)
          }
        })
      }
    })

    this.theaterListeners.push(unsubscribe)
    return unsubscribe
  }

  // Get current session
  getCurrentSession(): TheaterSession | null {
    return this.currentSession
  }

  // Clean up listeners
  cleanup() {
    this.theaterListeners.forEach((unsubscribe) => unsubscribe())
    this.theaterListeners = []
    this.currentSession = null
  }
}
