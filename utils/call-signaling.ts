import { database } from "@/lib/firebase"
import { ref, push, set, onValue, remove, update, get } from "firebase/database"

export interface CallData {
  id: string
  roomId: string
  callerId: string
  caller: string
  type: "audio" | "video"
  status: "ringing" | "answered" | "ended"
  participants: string[]
  timestamp: number
}

export class CallSignaling {
  private static instance: CallSignaling
  private callListeners: Map<string, () => void> = new Map()

  static getInstance(): CallSignaling {
    if (!CallSignaling.instance) {
      CallSignaling.instance = new CallSignaling()
    }
    return CallSignaling.instance
  }

  async startCall(roomId: string, callerName: string, callerId: string, type: "audio" | "video"): Promise<string> {
    try {
      if (!database) throw new Error("Database not initialized")

      const callsRef = ref(database, `calls/${roomId}`)
      const newCallRef = push(callsRef)
      const callId = newCallRef.key!

      const callData: CallData = {
        id: callId,
        roomId,
        callerId,
        caller: callerName,
        type,
        status: "ringing",
        participants: [callerId],
        timestamp: Date.now(),
      }

      await set(newCallRef, callData)
      console.log("Call started:", callData)

      // Auto-end call after 60 seconds if not answered
      setTimeout(async () => {
        try {
          const callRef = ref(database, `calls/${roomId}/${callId}`)
          const snapshot = await get(callRef)
          if (snapshot.exists() && snapshot.val().status === "ringing") {
            await this.endCall(roomId, callId)
          }
        } catch (error) {
          console.error("Error auto-ending call:", error)
        }
      }, 60000)

      return callId
    } catch (error) {
      console.error("Error starting call:", error)
      throw error
    }
  }

  async answerCall(roomId: string, callId: string, userId: string): Promise<void> {
    try {
      if (!database) return

      const callRef = ref(database, `calls/${roomId}/${callId}`)
      const snapshot = await get(callRef)

      if (snapshot.exists()) {
        const callData = snapshot.val()
        const updatedParticipants = [...callData.participants]
        if (!updatedParticipants.includes(userId)) {
          updatedParticipants.push(userId)
        }

        await update(callRef, {
          status: "answered",
          participants: updatedParticipants,
        })

        console.log("Call answered:", callId)
      }
    } catch (error) {
      console.error("Error answering call:", error)
      throw error
    }
  }

  async endCall(roomId: string, callId: string): Promise<void> {
    try {
      if (!database) return

      const callRef = ref(database, `calls/${roomId}/${callId}`)
      await update(callRef, { status: "ended" })

      console.log("Call ended:", callId)

      // Remove call data after 5 seconds
      setTimeout(async () => {
        try {
          await remove(callRef)
        } catch (error) {
          console.error("Error removing call data:", error)
        }
      }, 5000)
    } catch (error) {
      console.error("Error ending call:", error)
      throw error
    }
  }

  listenForCalls(
    roomId: string,
    currentUserId: string,
    onIncomingCall: (call: CallData) => void,
    onCallUpdate: (call: CallData) => void,
  ): () => void {
    if (!database) return () => {}

    const callsRef = ref(database, `calls/${roomId}`)

    const unsubscribe = onValue(callsRef, (snapshot) => {
      const calls = snapshot.val()
      if (calls) {
        Object.values(calls).forEach((call: any) => {
          const callData = call as CallData

          // Handle incoming calls (for other users)
          if (callData.status === "ringing" && callData.callerId !== currentUserId) {
            console.log("Incoming call detected:", callData)
            onIncomingCall(callData)
          }

          // Handle call updates (for all participants)
          if (callData.participants.includes(currentUserId) || callData.callerId === currentUserId) {
            console.log("Call update:", callData)
            onCallUpdate(callData)
          }
        })
      }
    })

    // Store the unsubscribe function
    this.callListeners.set(roomId, unsubscribe)

    return unsubscribe
  }

  cleanup(): void {
    console.log("Cleaning up call signaling")
    this.callListeners.forEach((unsubscribe) => {
      unsubscribe()
    })
    this.callListeners.clear()
  }
}
