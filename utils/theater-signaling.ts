import { database } from "@/lib/firebase"
import { ref, push, set, onValue, off, update, remove } from "firebase/database"

export interface TheaterSession {
  id: string
  roomId: string
  hostId: string
  host: string
  videoUrl: string
  platform: "youtube" | "vimeo" | "direct" | "soundcloud"
  status: "waiting" | "playing" | "paused" | "ended"
  currentTime: number
  participants: string[]
  createdAt: number
  lastAction?: {
    type: "play" | "pause" | "seek" | "raise_hand" | "update_queue"
    currentTime: number
    hostId: string
    host: string
    timestamp: number
    nextVideos?: string[]
  }
  nextVideos?: string[]
  raiseHands?: number
}

export interface TheaterInvite {
  id: string
  sessionId: string
  roomId: string
  hostId: string
  host: string
  videoTitle: string
  timestamp: number
}

export class TheaterSignaling {
  private static instance: TheaterSignaling
  private currentSession: TheaterSession | null = null

  static getInstance(): TheaterSignaling {
    if (!TheaterSignaling.instance) {
      TheaterSignaling.instance = new TheaterSignaling()
    }
    return TheaterSignaling.instance
  }

  private cleanData(obj: any): any {
    if (obj === null || obj === undefined) {
      return null
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.cleanData(item)).filter((item) => item !== undefined)
    }

    if (typeof obj === "object") {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = this.cleanData(value)
        if (cleanedValue !== undefined) {
          cleaned[key] = cleanedValue
        }
      }
      return cleaned
    }

    return obj
  }

  private getSnapshot(ref: any): Promise<any> {
    return new Promise((resolve, reject) => {
      let unsubscribe: (() => void) | null = null

      unsubscribe = onValue(
        ref,
        (snapshot) => {
          if (unsubscribe) {
            unsubscribe()
          }
          resolve(snapshot)
        },
        (error) => {
          if (unsubscribe) {
            unsubscribe()
          }
          reject(error)
        },
      )
    })
  }

  async createSession(
    roomId: string,
    host: string,
    hostId: string,
    videoUrl: string,
    platform: "youtube" | "vimeo" | "direct" | "soundcloud",
  ): Promise<string> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const sessionRef = push(ref(database, `rooms/${roomId}/theater`))
    const sessionId = sessionRef.key!

    const session: Omit<TheaterSession, "id"> = {
      roomId,
      hostId,
      host,
      videoUrl,
      platform,
      status: "waiting",
      currentTime: 0,
      participants: [hostId],
      createdAt: Date.now(),
      nextVideos: [],
      raiseHands: 0,
    }

    const cleanedSession = this.cleanData(session)
    await set(sessionRef, cleanedSession)

    this.currentSession = { id: sessionId, ...session }
    return sessionId
  }

  async joinSession(roomId: string, sessionId: string, userId: string): Promise<void> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    try {
      const snapshot = await this.getSnapshot(sessionRef)
      const session = snapshot.val()

      if (!session) {
        throw new Error("Session not found")
      }

      const updatedParticipants = [...(session.participants || []), userId]
      await update(sessionRef, { participants: updatedParticipants })
    } catch (error) {
      console.error("Error joining session:", error)
      throw error
    }
  }

  async leaveSession(roomId: string, sessionId: string, userId: string): Promise<void> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    try {
      const snapshot = await this.getSnapshot(sessionRef)
      const session = snapshot.val()

      if (!session) return

      const updatedParticipants = (session.participants || []).filter((id: string) => id !== userId)

      if (updatedParticipants.length === 0) {
        // No participants left, end session
        await this.endSession(roomId, sessionId)
      } else {
        await update(sessionRef, { participants: updatedParticipants })
      }
    } catch (error) {
      console.error("Error leaving session:", error)
      throw error
    }
  }

  async endSession(roomId: string, sessionId: string): Promise<void> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)
    await update(sessionRef, { status: "ended" })

    // Clean up after a delay
    setTimeout(async () => {
      try {
        await remove(sessionRef)
      } catch (error) {
        console.error("Error removing session:", error)
      }
    }, 5000)

    this.currentSession = null
  }

  async sendAction(
    roomId: string,
    sessionId: string,
    type: "play" | "pause" | "seek" | "raise_hand" | "update_queue",
    currentTime: number,
    hostId: string,
    host: string,
    nextVideos?: string[],
  ): Promise<void> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    const actionData: any = {
      lastAction: {
        type,
        currentTime,
        hostId,
        host,
        timestamp: Date.now(),
      },
      currentTime,
    }

    // Handle specific action types
    if (type === "play") {
      actionData.status = "playing"
    } else if (type === "pause") {
      actionData.status = "paused"
    } else if (type === "raise_hand") {
      try {
        const snapshot = await this.getSnapshot(sessionRef)
        const session = snapshot.val()
        const currentRaiseHands = session?.raiseHands || 0
        actionData.raiseHands = currentRaiseHands + 1
      } catch (error) {
        console.error("Error updating raise hands:", error)
        actionData.raiseHands = 1
      }
    } else if (type === "update_queue" && nextVideos) {
      actionData.nextVideos = nextVideos
      actionData.lastAction.nextVideos = nextVideos
    }

    const cleanedData = this.cleanData(actionData)
    await update(sessionRef, cleanedData)
  }

  async sendInvite(roomId: string, sessionId: string, host: string, hostId: string, videoTitle: string): Promise<void> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const inviteRef = push(ref(database, `rooms/${roomId}/theater_invites`))
    const inviteId = inviteRef.key!

    const invite: Omit<TheaterInvite, "id"> = {
      sessionId,
      roomId,
      hostId,
      host,
      videoTitle,
      timestamp: Date.now(),
    }

    const cleanedInvite = this.cleanData(invite)
    await set(inviteRef, cleanedInvite)

    // Auto-remove invite after 5 minutes
    setTimeout(async () => {
      try {
        await remove(inviteRef)
      } catch (error) {
        console.error("Error removing invite:", error)
      }
    }, 300000)
  }

  listenForSession(roomId: string, sessionId: string, callback: (session: TheaterSession) => void): () => void {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const sessionRef = ref(database, `rooms/${roomId}/theater/${sessionId}`)

    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const sessionData = snapshot.val()
      if (sessionData) {
        const session: TheaterSession = {
          id: sessionId,
          ...sessionData,
        }
        this.currentSession = session
        callback(session)
      }
    })

    return () => {
      off(sessionRef)
      unsubscribe()
    }
  }

  listenForInvites(roomId: string, userId: string, callback: (invite: TheaterInvite) => void): () => void {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const invitesRef = ref(database, `rooms/${roomId}/theater_invites`)

    const unsubscribe = onValue(invitesRef, (snapshot) => {
      const invites = snapshot.val()
      if (invites) {
        Object.entries(invites).forEach(([inviteId, inviteData]: [string, any]) => {
          if (inviteData.hostId !== userId && inviteData.timestamp > Date.now() - 300000) {
            const invite: TheaterInvite = {
              id: inviteId,
              ...inviteData,
            }
            callback(invite)
          }
        })
      }
    })

    return () => {
      off(invitesRef)
      unsubscribe()
    }
  }

  async getActiveSession(roomId: string): Promise<TheaterSession | null> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const theaterRef = ref(database, `rooms/${roomId}/theater`)

    try {
      const snapshot = await this.getSnapshot(theaterRef)
      const sessions = snapshot.val()

      if (!sessions) return null

      // Find active session
      for (const [sessionId, sessionData] of Object.entries(sessions) as [string, any][]) {
        if (sessionData.status === "playing" || sessionData.status === "paused" || sessionData.status === "waiting") {
          return {
            id: sessionId,
            ...sessionData,
          }
        }
      }

      return null
    } catch (error) {
      console.error("Error getting active session:", error)
      return null
    }
  }

  getCurrentSession(): TheaterSession | null {
    return this.currentSession
  }

  cleanup(): void {
    this.currentSession = null
  }
}
