import { database } from "@/lib/firebase"
import { ref, set, onValue, update, remove } from "firebase/database"

export interface TheaterSession {
  id: string
  roomId: string
  hostId: string
  hostName: string
  videoUrl: string
  videoType: "direct" | "youtube" | "vimeo" | "soundcloud"
  status: "waiting" | "loading" | "playing" | "paused" | "ended"
  participants: string[]
  currentTime: number
  lastAction?: TheaterAction
  createdAt: number
  nextVideos?: string[]
  raiseHands?: number
  platform?: string
}

export interface TheaterAction {
  type: "play" | "pause" | "seek" | "raise_hand" | "update_queue"
  currentTime?: number
  hostId: string
  hostName: string
  timestamp: number
  nextVideos?: string[]
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
  private sessions = new Map<string, () => void>()
  private theaterListeners: Array<() => void> = []

  static getInstance(): TheaterSignaling {
    if (!TheaterSignaling.instance) {
      TheaterSignaling.instance = new TheaterSignaling()
    }
    return TheaterSignaling.instance
  }

  // Detect platform from URL
  private detectPlatform(url: string): string {
    if (url.match(/(youtube\.com|youtu\.be)/)) return "youtube"
    if (url.match(/vimeo\.com/)) return "vimeo"
    if (url.match(/soundcloud\.com/)) return "soundcloud"
    if (url.match(/\.(mp4|webm|ogg|mov|avi|mkv|mp3|wav|m3u8)$/i)) return "direct"
    return "unknown"
  }

  // Clean data to remove undefined values
  private cleanData(obj: any): any {
    if (obj === null || obj === undefined) return null
    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanData(item)).filter((item) => item !== undefined)
    }
    if (typeof obj === "object") {
      const cleaned: Record<string, any> = {}
      Object.keys(obj).forEach((key) => {
        const value = this.cleanData(obj[key])
        if (value !== undefined) {
          cleaned[key] = value
        }
      })
      return cleaned
    }
    return obj
  }

  // Helper method to get a single snapshot from Firebase
  private getSnapshot(ref: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let unsubscribe: (() => void) | null = null

      unsubscribe = onValue(
        ref,
        (snapshot) => {
          if (unsubscribe) unsubscribe()
          resolve(snapshot)
        },
        (error) => {
          if (unsubscribe) unsubscribe()
          reject(error)
        },
      )
    })
  }

  async createSession(
    roomId: string,
    hostName: string,
    hostId: string,
    videoUrl: string,
    videoType: "direct" | "youtube" | "vimeo" | "soundcloud",
  ): Promise<string> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const sessionId = `theater_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const platform = this.detectPlatform(videoUrl)

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
      platform,
      createdAt: Date.now(),
      nextVideos: [],
      raiseHands: 0,
    }

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)
    await set(sessionRef, this.cleanData(session))

    this.currentSession = session
    return sessionId
  }

  async joinSession(roomId: string, sessionId: string, userId: string): Promise<boolean> {
    if (!database) return false

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    try {
      const sessionSnapshot = await this.getSnapshot(sessionRef)

      if (!sessionSnapshot.exists()) {
        return false
      }

      const session = sessionSnapshot.val()
      if (session.status === "ended") {
        return false
      }

      // Add user to participants if not already there
      if (!session.participants.includes(userId)) {
        const updatedParticipants = [...session.participants, userId]
        await update(sessionRef, {
          participants: updatedParticipants,
        })
      }

      return true
    } catch (error) {
      console.error("Error joining session:", error)
      return false
    }
  }

  async leaveSession(roomId: string, sessionId: string, userId: string): Promise<void> {
    if (!database) return

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    try {
      const sessionSnapshot = await this.getSnapshot(sessionRef)

      if (!sessionSnapshot.exists()) {
        return
      }

      const session = sessionSnapshot.val()
      const updatedParticipants = session.participants.filter((id: string) => id !== userId)

      if (updatedParticipants.length === 0) {
        // Last participant left, end session
        await this.endSession(roomId, sessionId)
      } else {
        await update(sessionRef, {
          participants: updatedParticipants,
        })
      }
    } catch (error) {
      console.error("Error leaving session:", error)
    }
  }

  async sendAction(
    roomId: string,
    sessionId: string,
    type: TheaterAction["type"],
    currentTime: number,
    hostId: string,
    hostName: string,
    nextVideos?: string[],
  ): Promise<void> {
    if (!database) return

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    // Create base action object
    const action: TheaterAction = {
      type,
      currentTime,
      hostId,
      hostName,
      timestamp: Date.now(),
    }

    // Only add nextVideos if it's provided and not undefined
    if (nextVideos !== undefined) {
      action.nextVideos = nextVideos
    }

    const updateData: any = {
      lastAction: this.cleanData(action),
      currentTime,
    }

    if (type === "play") {
      updateData.status = "playing"
    } else if (type === "pause") {
      updateData.status = "paused"
    } else if (type === "raise_hand") {
      // Increment raise hand count
      try {
        const sessionSnapshot = await this.getSnapshot(sessionRef)

        if (sessionSnapshot.exists()) {
          const session = sessionSnapshot.val()
          updateData.raiseHands = (session.raiseHands || 0) + 1
        }
      } catch (error) {
        console.error("Error getting session for raise hand:", error)
        updateData.raiseHands = 1 // Default to 1 if we can't get current count
      }
    } else if (type === "update_queue" && nextVideos !== undefined) {
      updateData.nextVideos = nextVideos
    }

    await update(sessionRef, this.cleanData(updateData))
  }

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
    await set(inviteRef, this.cleanData(invite))

    // Auto-remove invite after 30 seconds
    setTimeout(async () => {
      try {
        await remove(inviteRef)
      } catch (error) {
        console.error("Error removing theater invite:", error)
      }
    }, 30000)
  }

  async endSession(roomId: string, sessionId: string): Promise<void> {
    if (!database) return

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    const endAction: TheaterAction = {
      type: "pause",
      currentTime: 0,
      hostId: "",
      hostName: "",
      timestamp: Date.now(),
    }

    await update(
      sessionRef,
      this.cleanData({
        status: "ended",
        lastAction: endAction,
      }),
    )

    // Clean up after 5 minutes
    setTimeout(
      async () => {
        try {
          await remove(sessionRef)
        } catch (error) {
          console.error("Error cleaning up session:", error)
        }
      },
      5 * 60 * 1000,
    )

    this.currentSession = null
  }

  listenForSession(roomId: string, sessionId: string, callback: (session: TheaterSession) => void): () => void {
    if (!database) {
      console.warn("Firebase database not initialized, theater listening disabled")
      return () => {}
    }

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)
    const key = `${roomId}-${sessionId}`

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const session = snapshot.val()
        this.currentSession = session
        callback(session)

        // If session ended, notify all participants
        if (session.status === "ended") {
          setTimeout(() => {
            callback({ ...session, status: "ended" })
          }, 1000)
        }
      }
    })

    // Store cleanup function
    if (this.sessions.has(key)) {
      this.sessions.get(key)!()
    }
    this.sessions.set(key, unsubscribe)
    this.theaterListeners.push(unsubscribe)

    // Return cleanup function
    return () => {
      unsubscribe()
      this.sessions.delete(key)
    }
  }

  listenForInvites(roomId: string, userId: string, onInvite: (invite: TheaterInvite) => void): () => void {
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

  async getActiveSession(roomId: string): Promise<TheaterSession | null> {
    if (!database) return null

    const sessionsRef = ref(database, `rooms/${roomId}/theater`)

    try {
      const snapshot = await this.getSnapshot(sessionsRef)

      if (!snapshot.exists()) {
        return null
      }

      const sessions = snapshot.val()

      // Find the most recent active session
      const activeSessions = Object.entries(sessions)
        .map(([id, session]: [string, any]) => ({
          ...session,
          id,
        }))
        .filter((session: any) => session.status !== "ended")
        .sort((a: any, b: any) => b.createdAt - a.createdAt)

      return activeSessions.length > 0 ? activeSessions[0] : null
    } catch (error) {
      console.error("Error getting active session:", error)
      return null
    }
  }

  // Clean up listeners
  cleanup() {
    this.theaterListeners.forEach((unsubscribe) => unsubscribe())
    this.theaterListeners = []
    this.sessions.forEach((unsubscribe) => {
      unsubscribe()
    })
    this.sessions.clear()
    this.currentSession = null
  }
}
