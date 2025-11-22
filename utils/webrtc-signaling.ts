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
  private roomIds: Map<string, string> = new Map()
  private candidateQueues: Map<string, RTCIceCandidate[]> = new Map()

  static getInstance(): WebRTCSignaling {
    if (!WebRTCSignaling.instance) {
      WebRTCSignaling.instance = new WebRTCSignaling()
    }
    return WebRTCSignaling.instance
  }

  private async handleIceCandidate(callId: string, candidate: RTCIceCandidate) {
    const peerConnection = this.peerConnections.get(callId)
    if (!peerConnection) return

    if (!peerConnection.remoteDescription && peerConnection.signalingState !== "stable") {
      console.log("Buffering ICE candidate (remote description not set)")
      const queue = this.candidateQueues.get(callId) || []
      queue.push(candidate)
      this.candidateQueues.set(callId, queue)
    } else {
      console.log("Adding ICE candidate immediately")
      await peerConnection.addIceCandidate(candidate).catch((e) => console.error("Error adding candidate:", e))
    }
  }

  private async flushCandidateQueue(callId: string) {
    const peerConnection = this.peerConnections.get(callId)
    const queue = this.candidateQueues.get(callId)

    if (peerConnection && queue && queue.length > 0) {
      console.log(`Flushing ${queue.length} buffered ICE candidates`)
      for (const candidate of queue) {
        await peerConnection
          .addIceCandidate(candidate)
          .catch((e) => console.error("Error adding buffered candidate:", e))
      }
      this.candidateQueues.delete(callId)
    }
  }

  async startCall(
    roomId: string,
    callId: string,
    localUserId: string,
    remoteUserId: string,
    isVideo = false,
  ): Promise<MediaStream> {
    let localStream: MediaStream | null = null

    try {
      if (this.peerConnections.has(callId)) {
        console.log("WebRTC call already started:", callId)
        const existingStream = this.localStreams.get(callId)
        if (existingStream) return existingStream
      }

      console.log("Starting WebRTC call:", { callId, localUserId, remoteUserId, isVideo })

      // Request media permissions with explicit video constraints
      localStream = await requestMediaPermissions(true, isVideo, "user")
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
      this.roomIds.set(callId, roomId)

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
        if (peerConnection.connectionState === "failed") {
          console.warn("Connection failed - network issues likely")
        }
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
      // Cleanup local stream if an error occurs during setup
      if (localStream) {
        stopMediaStream(localStream)
        this.localStreams.delete(callId)
      }
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
    let localStream: MediaStream | null = null

    try {
      if (this.peerConnections.has(callId)) {
        console.log("WebRTC call already answered:", callId)
        const existingStream = this.localStreams.get(callId)
        if (existingStream) return existingStream
      }

      console.log("Answering WebRTC call:", { callId, localUserId, remoteUserId, isVideo })

      // Request media permissions with explicit video constraints
      localStream = await requestMediaPermissions(true, isVideo, "user")
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
      this.roomIds.set(callId, roomId)

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
      // Cleanup local stream if an error occurs during setup
      if (localStream) {
        stopMediaStream(localStream)
        this.localStreams.delete(callId)
      }
      throw error
    }
  }

  async switchCamera(callId: string, facingMode: "user" | "environment"): Promise<MediaStream> {
    try {
      const peerConnection = this.peerConnections.get(callId)
      const currentStream = this.localStreams.get(callId)

      if (!peerConnection || !currentStream) {
        throw new Error("Call not found or stream not available")
      }

      console.log("Switching camera to:", facingMode)

      // Stop existing video track
      currentStream.getVideoTracks().forEach((track) => {
        track.stop()
        currentStream.removeTrack(track)
      })

      // Request new video track
      const newStream = await requestMediaPermissions(false, true, facingMode)
      if (!newStream) throw new Error("Failed to get new camera stream")

      const newVideoTrack = newStream.getVideoTracks()[0]
      if (!newVideoTrack) throw new Error("No video track found in new stream")

      // Replace track in peer connection
      const senders = peerConnection.getSenders()
      const videoSender = senders.find((s) => s.track?.kind === "video")

      if (videoSender) {
        console.log("Replacing video track in sender")
        await videoSender.replaceTrack(newVideoTrack)
      } else {
        console.log("Adding new video track to peer connection")
        peerConnection.addTrack(newVideoTrack, currentStream)
      }

      // Add new track to current stream (to keep audio track and reference same)
      currentStream.addTrack(newVideoTrack)

      // Clean up temp stream
      newStream.removeTrack(newVideoTrack)

      return currentStream
    } catch (error) {
      console.error("Error switching camera:", error)
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

              await this.flushCandidateQueue(callId)

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

              await this.flushCandidateQueue(callId)
              break
            }

            /* ---------- ICE CANDIDATE ---------- */
            case "ice-candidate": {
              console.log("Received ICE candidate")
              await this.handleIceCandidate(callId, new RTCIceCandidate(signal.data))
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

    this.candidateQueues.delete(callId)

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

    const roomId = this.roomIds.get(callId)

    // Clean up Firebase data
    if (database && roomId) {
      const webrtcRef = ref(database, `webrtc/${roomId}/${callId}`)
      remove(webrtcRef).catch(console.error)
    }

    this.roomIds.delete(callId)
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
