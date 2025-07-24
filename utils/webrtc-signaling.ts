import { database } from "@/lib/firebase"
import { ref, push, onValue, remove } from "firebase/database"
import { createPeerConnection, requestMediaPermissions, stopMediaStream } from "@/lib/webrtc"

export interface WebRTCSignal {
  type: "offer" | "answer" | "ice-candidate"
  data: any
  from: string
  to: string
  timestamp: number
}

export class WebRTCSignaling {
  private static instance: WebRTCSignaling
  private peerConnections: Map<string, RTCPeerConnection> = new Map()
  private localStreams: Map<string, MediaStream> = new Map()
  private remoteStreams: Map<string, MediaStream> = new Map()
  private signalListeners: Map<string, () => void> = new Map()

  static getInstance(): WebRTCSignaling {
    if (!WebRTCSignaling.instance) {
      WebRTCSignaling.instance = new WebRTCSignaling()
    }
    return WebRTCSignaling.instance
  }

  async startCall(
    roomId: string,
    callId: string,
    localUserId: string,
    remoteUserId: string,
    isVideo = false,
  ): Promise<MediaStream> {
    try {
      console.log("Starting WebRTC call:", { callId, localUserId, remoteUserId, isVideo })

      // Request media permissions with explicit video constraints
      const localStream = await requestMediaPermissions(true, isVideo)
      if (!localStream) {
        throw new Error("Failed to get local media stream")
      }

      // Log detailed track information
      const audioTracks = localStream.getAudioTracks()
      const videoTracks = localStream.getVideoTracks()
      console.log("Local stream details:", {
        audioTracks: audioTracks.map((t) => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
        videoTracks: videoTracks.map((t) => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          settings: t.getSettings(),
        })),
      })

      this.localStreams.set(callId, localStream)

      // Create peer connection
      const peerConnection = createPeerConnection()
      this.peerConnections.set(callId, peerConnection)

      // Add local stream tracks to peer connection with explicit handling
      localStream.getTracks().forEach((track) => {
        console.log(`Adding ${track.kind} track to peer connection:`, {
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
        })
        const sender = peerConnection.addTrack(track, localStream)
        console.log("Track sender:", sender)
      })

      // Handle remote stream with detailed logging
      peerConnection.ontrack = (event) => {
        console.log("Received remote track event:", {
          track: {
            id: event.track.id,
            kind: event.track.kind,
            enabled: event.track.enabled,
            readyState: event.track.readyState,
          },
          streams: event.streams.map((s) => ({
            id: s.id,
            tracks: s.getTracks().map((t) => ({ id: t.id, kind: t.kind, enabled: t.enabled })),
          })),
        })

        const remoteStream = event.streams[0]
        if (remoteStream) {
          this.remoteStreams.set(callId, remoteStream)
          this.onRemoteStream?.(callId, remoteStream)
        }
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate")
          this.sendSignal(roomId, callId, {
            type: "ice-candidate",
            data: event.candidate.toJSON(),
            from: localUserId,
            to: remoteUserId,
            timestamp: Date.now(),
          })
        }
      }

      // Monitor connection state
      peerConnection.onconnectionstatechange = () => {
        console.log("Connection state changed:", peerConnection.connectionState)
      }

      peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state changed:", peerConnection.iceConnectionState)
      }

      // Create and send offer with video constraints
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      })
      await peerConnection.setLocalDescription(offer)

      console.log("Sending offer with SDP:", offer.sdp?.substring(0, 200) + "...")
      await this.sendSignal(roomId, callId, {
        type: "offer",
        data: offer,
        from: localUserId,
        to: remoteUserId,
        timestamp: Date.now(),
      })

      // Listen for signals
      this.listenForSignals(roomId, callId, localUserId, remoteUserId)

      return localStream
    } catch (error) {
      console.error("Error starting WebRTC call:", error)
      throw error
    }
  }

  async answerCall(
    roomId: string,
    callId: string,
    localUserId: string,
    remoteUserId: string,
    isVideo = false,
  ): Promise<MediaStream> {
    try {
      console.log("Answering WebRTC call:", { callId, localUserId, remoteUserId, isVideo })

      // Request media permissions with explicit video constraints
      const localStream = await requestMediaPermissions(true, isVideo)
      if (!localStream) {
        throw new Error("Failed to get local media stream")
      }

      // Log detailed track information
      const audioTracks = localStream.getAudioTracks()
      const videoTracks = localStream.getVideoTracks()
      console.log("Local stream details:", {
        audioTracks: audioTracks.map((t) => ({ id: t.id, kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
        videoTracks: videoTracks.map((t) => ({
          id: t.id,
          kind: t.kind,
          enabled: t.enabled,
          readyState: t.readyState,
          settings: t.getSettings(),
        })),
      })

      this.localStreams.set(callId, localStream)

      // Create peer connection
      const peerConnection = createPeerConnection()
      this.peerConnections.set(callId, peerConnection)

      // Add local stream tracks to peer connection with explicit handling
      localStream.getTracks().forEach((track) => {
        console.log(`Adding ${track.kind} track to peer connection:`, {
          id: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
        })
        const sender = peerConnection.addTrack(track, localStream)
        console.log("Track sender:", sender)
      })

      // Handle remote stream with detailed logging
      peerConnection.ontrack = (event) => {
        console.log("Received remote track event:", {
          track: {
            id: event.track.id,
            kind: event.track.kind,
            enabled: event.track.enabled,
            readyState: event.track.readyState,
          },
          streams: event.streams.map((s) => ({
            id: s.id,
            tracks: s.getTracks().map((t) => ({ id: t.id, kind: t.kind, enabled: t.enabled })),
          })),
        })

        const remoteStream = event.streams[0]
        if (remoteStream) {
          this.remoteStreams.set(callId, remoteStream)
          this.onRemoteStream?.(callId, remoteStream)
        }
      }

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate")
          this.sendSignal(roomId, callId, {
            type: "ice-candidate",
            data: event.candidate.toJSON(),
            from: localUserId,
            to: remoteUserId,
            timestamp: Date.now(),
          })
        }
      }

      // Monitor connection state
      peerConnection.onconnectionstatechange = () => {
        console.log("Connection state changed:", peerConnection.connectionState)
      }

      peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE connection state changed:", peerConnection.iceConnectionState)
      }

      // Listen for signals first
      this.listenForSignals(roomId, callId, localUserId, remoteUserId)

      return localStream
    } catch (error) {
      console.error("Error answering WebRTC call:", error)
      throw error
    }
  }

  private async sendSignal(roomId: string, callId: string, signal: WebRTCSignal): Promise<void> {
    try {
      if (!database) return

      const signalRef = ref(database, `webrtc/${roomId}/${callId}/signals`)
      await push(signalRef, signal)
    } catch (error) {
      console.error("Error sending WebRTC signal:", error)
    }
  }

  private listenForSignals(roomId: string, callId: string, localUserId: string, remoteUserId: string): void {
    if (!database) return

    const signalsRef = ref(database, `webrtc/${roomId}/${callId}/signals`)

    const unsubscribe = onValue(signalsRef, async (snapshot) => {
      const signals = snapshot.val()
      if (!signals) return

      const peerConnection = this.peerConnections.get(callId)
      if (!peerConnection) return

      // Process new signals
      for (const signalId in signals) {
        const signal: WebRTCSignal = signals[signalId]

        // Only process signals meant for this user
        if (signal.to !== localUserId) continue

        try {
          // Remove signal right away to avoid re-processing if an error occurs
          const processedRef = ref(database, `webrtc/${roomId}/${callId}/signals/${signalId}`)
          await remove(processedRef).catch(console.error)

          switch (signal.type) {
            /* ---------- REMOTE OFFER ---------- */
            case "offer": {
              // We can only process an offer when the PC is stable
              if (peerConnection.signalingState !== "stable") {
                console.warn("Ignoring offer: unexpected signalingState", peerConnection.signalingState)
                break
              }

              console.log("Received offer with SDP:", signal.data.sdp?.substring(0, 200) + "...")
              await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data))

              // Create answer with video constraints
              const answer = await peerConnection.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true,
              })
              await peerConnection.setLocalDescription(answer)

              console.log("Sending answer with SDP:", answer.sdp?.substring(0, 200) + "...")
              await this.sendSignal(roomId, callId, {
                type: "answer",
                data: answer,
                from: localUserId,
                to: remoteUserId,
                timestamp: Date.now(),
              })
              break
            }

            /* ---------- REMOTE ANSWER ---------- */
            case "answer": {
              // Only accept an answer when we're in the "have-local-offer" state
              if (peerConnection.signalingState !== "have-local-offer" || peerConnection.remoteDescription) {
                console.warn("Ignoring answer: unexpected signalingState", peerConnection.signalingState)
                break
              }

              console.log("Received answer with SDP:", signal.data.sdp?.substring(0, 200) + "...")
              await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.data))
              break
            }

            /* ---------- ICE CANDIDATE ---------- */
            case "ice-candidate": {
              console.log("Received ICE candidate")
              await peerConnection.addIceCandidate(new RTCIceCandidate(signal.data))
              break
            }
          }
        } catch (error) {
          console.error("Error processing WebRTC signal:", error)
        }
      }
    })

    this.signalListeners.set(callId, unsubscribe)
  }

  endCall(callId: string): void {
    console.log("Ending WebRTC call:", callId)

    // Stop local stream
    const localStream = this.localStreams.get(callId)
    if (localStream) {
      stopMediaStream(localStream)
      this.localStreams.delete(callId)
    }

    // Stop remote stream
    const remoteStream = this.remoteStreams.get(callId)
    if (remoteStream) {
      stopMediaStream(remoteStream)
      this.remoteStreams.delete(callId)
    }

    // Close peer connection
    const peerConnection = this.peerConnections.get(callId)
    if (peerConnection) {
      peerConnection.close()
      this.peerConnections.delete(callId)
    }

    // Remove signal listener
    const unsubscribe = this.signalListeners.get(callId)
    if (unsubscribe) {
      unsubscribe()
      this.signalListeners.delete(callId)
    }

    // Clean up Firebase data
    if (database) {
      const webrtcRef = ref(database, `webrtc/${callId}`)
      remove(webrtcRef).catch(console.error)
    }
  }

  getLocalStream(callId: string): MediaStream | null {
    return this.localStreams.get(callId) || null
  }

  getRemoteStream(callId: string): MediaStream | null {
    return this.remoteStreams.get(callId) || null
  }

  // Callback for when remote stream is received
  onRemoteStream?: (callId: string, stream: MediaStream) => void

  cleanup(): void {
    console.log("Cleaning up WebRTC signaling")

    // End all active calls
    for (const callId of this.peerConnections.keys()) {
      this.endCall(callId)
    }
  }
}
