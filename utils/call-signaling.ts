import { database } from "@/lib/firebase"
import { ref, push, set, onValue, remove, update, get } from "firebase/database"
import { WebRTCSignaling } from "./webrtc-signaling"

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
  private webrtcSignaling = WebRTCSignaling.getInstance()

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

        // Start WebRTC connection
        const isVideo = callData.type === "video"
        const remoteUserId =
          callData.callerId === userId ? updatedParticipants.find((p) => p !== userId) : callData.callerId

        if (remoteUserId) {
          await this.webrtcSignaling.answerCall(roomId, callId, userId, remoteUserId, isVideo)
        }
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

      // End WebRTC connection
      this.webrtcSignaling.endCall(callId)

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

  async initiateWebRTCCall(
    roomId: string,
    callId: string,
    localUserId: string,
    remoteUserId: string,
    isVideo: boolean,
  ): Promise<MediaStream> {
    return await this.webrtcSignaling.startCall(roomId, callId, localUserId, remoteUserId, isVideo)
  }

  getLocalStream(callId: string): MediaStream | null {
    return this.webrtcSignaling.getLocalStream(callId)
  }

  async switchCamera(callId: string, facingMode: "user" | "environment"): Promise<MediaStream> {
    return this.webrtcSignaling.switchCamera(callId, facingMode)
  }

  getRemoteStream(callId: string): MediaStream | null {
    return this.webrtcSignaling.getRemoteStream(callId)
  }

  setRemoteStreamCallback(callback: (callId: string, stream: MediaStream) => void): void {
    this.webrtcSignaling.onRemoteStream = callback
  }

  listenForCalls(
    roomId: string,
    currentUserId: string,
    onIncomingCall: (call: CallData) => void,
    onCallUpdate: (call: CallData) => void,
  ): () => void {
    if (!database) return () => {}

    const callsRef = ref(database, `calls/${roomId}`)

    const unsubscribe = onValue(callsRef, async (snapshot) => {
      const calls = snapshot.val()
      if (calls) {
        for (const callData of Object.values(calls) as CallData[]) {
          // Handle incoming calls (for other users)
          if (callData.status === "ringing" && callData.callerId !== currentUserId) {
            console.log("Incoming call detected:", callData)
            onIncomingCall(callData)
          }

          // Handle call updates (for all participants)
          if (callData.participants.includes(currentUserId) || callData.callerId === currentUserId) {
            console.log("Call update:", callData)
            onCallUpdate(callData)

            // If call was just answered, start WebRTC for the caller
            if (
              callData.status === "answered" &&
              callData.callerId === currentUserId &&
              callData.participants.length > 1
            ) {
              const remoteUserId = callData.participants.find((p) => p !== currentUserId)
              if (remoteUserId && !this.webrtcSignaling.getLocalStream(callData.id)) {
                try {
                  console.log("Starting WebRTC connection for answered call")
                  await this.webrtcSignaling.startCall(
                    roomId,
                    callData.id,
                    currentUserId,
                    remoteUserId,
                    callData.type === "video",
                  )
                } catch (error) {
                  console.error("Error starting WebRTC after call answered:", error)
                }
              }
            }
          }
        }
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
    this.webrtcSignaling.cleanup()
  }
}
