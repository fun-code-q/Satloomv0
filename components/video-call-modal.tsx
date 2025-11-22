"use client"

import type React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Minimize2, Maximize2, CameraOff, RefreshCw } from "lucide-react"
import { CallSignaling, type CallData } from "@/utils/call-signaling"
import { CallSounds } from "@/utils/call-sounds"

interface VideoCallModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  currentUser: string
  currentUserId: string
  callData: CallData | null
  isIncoming?: boolean
}

export function VideoCallModal({
  isOpen,
  onClose,
  roomId,
  currentUser,
  currentUserId,
  callData,
  isIncoming = false,
}: VideoCallModalProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isVideoOn, setIsVideoOn] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [connectionStatus, setConnectionStatus] = useState<string>("Connecting...")
  const [localStreamReady, setLocalStreamReady] = useState(false)
  const [remoteStreamReady, setRemoteStreamReady] = useState(false)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")

  const modalRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const callTimerRef = useRef<NodeJS.Timeout>()
  const callSignaling = CallSignaling.getInstance()
  const currentLocalStream = useRef<MediaStream | null>(null)
  const currentRemoteStream = useRef<MediaStream | null>(null)

  const callDataRef = useRef<CallData | null>(null)
  const roomIdRef = useRef<string>(roomId)

  useEffect(() => {
    callDataRef.current = callData
    roomIdRef.current = roomId
  }, [callData, roomId])

  // Ensure cleanup on unmount (e.g. closing tab or navigating away)
  useEffect(() => {
    return () => {
      const activeCall = callDataRef.current
      if (activeCall && (activeCall.status === "answered" || activeCall.status === "ringing")) {
        console.log("VideoCallModal unmounting with active call, cleaning up...")
        CallSounds.getInstance().stopAll()
        callSignaling.endCall(roomIdRef.current, activeCall.id).catch(console.error)

        // Also ensure local streams are stopped explicitly if needed
        if (currentLocalStream.current) {
          currentLocalStream.current.getTracks().forEach((t) => t.stop())
        }
      }
    }
  }, [])

  const handleMinimize = () => {
    setIsMinimized(true)
  }

  useEffect(() => {
    if (isOpen && callData?.status === "answered") {
      // Stop ringing when answered
      CallSounds.getInstance().stopAll()

      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else if (isOpen && !isIncoming && callData?.status === "ringing") {
      // Play ringback for outgoing calls
      CallSounds.getInstance().playRingback()
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
      // Cleanup sounds
      if (callData?.status === "ringing") {
        CallSounds.getInstance().stopAll()
      }
    }
  }, [isOpen, callData?.status, isIncoming])

  // Enhanced video setup function with better debugging
  const setupVideoElement = useCallback(
    async (videoElement: HTMLVideoElement, stream: MediaStream, isLocal = false) => {
      try {
        console.log(`Setting up ${isLocal ? "local" : "remote"} video element`)

        // Log stream details
        const videoTracks = stream.getVideoTracks()
        const audioTracks = stream.getAudioTracks()

        console.log(`${isLocal ? "Local" : "Remote"} stream details:`, {
          videoTracks: videoTracks.map((t) => ({
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState,
            settings: t.getSettings(),
          })),
          audioTracks: audioTracks.map((t) => ({
            id: t.id,
            enabled: t.enabled,
            readyState: t.readyState,
          })),
        })

        // Clear any existing stream
        if (videoElement.srcObject) {
          console.log(`Clearing existing ${isLocal ? "local" : "remote"} video stream`)
          const oldStream = videoElement.srcObject as MediaStream
          // Don't stop tracks here, just clear the srcObject
          videoElement.srcObject = null
        }

        // Set up video element properties
        videoElement.srcObject = stream
        videoElement.muted = isLocal // Always mute local video to prevent feedback
        videoElement.playsInline = true
        videoElement.autoplay = true

        // Add event listeners for debugging
        videoElement.onloadstart = () => console.log(`${isLocal ? "Local" : "Remote"} video load start`)
        videoElement.onloadedmetadata = () => {
          console.log(`${isLocal ? "Local" : "Remote"} video metadata loaded:`, {
            videoWidth: videoElement.videoWidth,
            videoHeight: videoElement.videoHeight,
            duration: videoElement.duration,
          })
        }
        videoElement.onloadeddata = () => console.log(`${isLocal ? "Local" : "Remote"} video data loaded`)
        videoElement.oncanplay = () => console.log(`${isLocal ? "Local" : "Remote"} video can play`)
        videoElement.onplaying = () => {
          console.log(`${isLocal ? "Local" : "Remote"} video is playing`)
          if (isLocal) {
            setLocalStreamReady(true)
          } else {
            setRemoteStreamReady(true)
            setConnectionStatus("Connected")
          }
        }
        videoElement.onerror = (e) => console.error(`${isLocal ? "Local" : "Remote"} video error:`, e)

        // Enhanced play handling
        const playVideo = async () => {
          try {
            console.log(`Attempting to play ${isLocal ? "local" : "remote"} video`)
            await videoElement.play()
            console.log(`${isLocal ? "Local" : "Remote"} video playing successfully`)
          } catch (error) {
            console.error(`Error playing ${isLocal ? "local" : "remote"} video:`, error)

            // Retry with user interaction for mobile
            if (error.name === "NotAllowedError" || error.name === "AbortError") {
              console.log("Waiting for user interaction to play video")
              const playOnInteraction = async () => {
                try {
                  await videoElement.play()
                  console.log(`${isLocal ? "Local" : "Remote"} video playing after user interaction`)
                  document.removeEventListener("touchstart", playOnInteraction)
                  document.removeEventListener("click", playOnInteraction)
                } catch (retryError) {
                  console.error("Retry play failed:", retryError)
                }
              }
              document.addEventListener("touchstart", playOnInteraction, { once: true })
              document.addEventListener("click", playOnInteraction, { once: true })
            }
          }
        }

        // Wait a bit for the stream to be ready, then play
        setTimeout(playVideo, 200)
      } catch (error) {
        console.error(`Error setting up ${isLocal ? "local" : "remote"} video:`, error)
      }
    },
    [],
  )

  // Restore video streams when maximizing
  const restoreVideoStreams = useCallback(async () => {
    if (!callData || !isOpen) return

    console.log("Restoring video streams after maximize")

    // Restore local stream
    if (currentLocalStream.current && localVideoRef.current) {
      await setupVideoElement(localVideoRef.current, currentLocalStream.current, true)
    }

    // Restore remote stream
    if (currentRemoteStream.current && remoteVideoRef.current) {
      await setupVideoElement(remoteVideoRef.current, currentRemoteStream.current, false)
    }
  }, [callData, isOpen, setupVideoElement])

  // Handle media streams
  useEffect(() => {
    if (!callData || !isOpen) return

    const setupMediaStreams = async () => {
      try {
        // Set up remote stream callback
        callSignaling.setRemoteStreamCallback(async (callId: string, stream: MediaStream) => {
          if (callId === callData.id) {
            console.log("Received remote video stream callback")
            currentRemoteStream.current = stream

            if (remoteVideoRef.current && !isMinimized) {
              await setupVideoElement(remoteVideoRef.current, stream, false)
            }
          }
        })

        // Get local stream if call is answered or we're making the call
        if (callData.status === "answered" || (!isIncoming && callData.status === "ringing")) {
          const localStream = callSignaling.getLocalStream(callData.id)
          if (localStream) {
            console.log("Setting up local video stream from signaling")
            currentLocalStream.current = localStream

            if (localVideoRef.current && !isMinimized) {
              await setupVideoElement(localVideoRef.current, localStream, true)
            }
          }

          const remoteStream = callSignaling.getRemoteStream(callData.id)
          if (remoteStream) {
            console.log("Setting up existing remote video stream from signaling")
            currentRemoteStream.current = remoteStream

            if (remoteVideoRef.current && !isMinimized) {
              await setupVideoElement(remoteVideoRef.current, remoteStream, false)
            }
          }
        }
      } catch (error) {
        console.error("Error setting up media streams:", error)
        setConnectionStatus("Connection failed")
      }
    }

    setupMediaStreams()
  }, [callData, isOpen, isMinimized, setupVideoElement])

  // Restore streams when maximizing
  useEffect(() => {
    if (!isMinimized && isOpen && callData) {
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        restoreVideoStreams()
      }, 100)
    }
  }, [isMinimized, isOpen, callData, restoreVideoStreams])

  // Handle mute/unmute and video on/off with better track management
  useEffect(() => {
    if (callData && currentLocalStream.current) {
      const audioTrack = currentLocalStream.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !isMuted
        console.log("Audio track enabled:", audioTrack.enabled)
      }

      const videoTrack = currentLocalStream.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = isVideoOn
        console.log("Video track enabled:", videoTrack.enabled, "readyState:", videoTrack.readyState)
      }
    }
  }, [isMuted, isVideoOn, callData])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleEndCall = async () => {
    // Play end call sound
    CallSounds.getInstance().playEndCall()

    if (callData) {
      await callSignaling.endCall(roomId, callData.id)
    }
    setCallDuration(0)
    setConnectionStatus("Connecting...")
    setLocalStreamReady(false)
    setRemoteStreamReady(false)
    setFacingMode("user")
    currentLocalStream.current = null
    currentRemoteStream.current = null
    onClose()
  }

  const handleAnswerCall = async () => {
    if (callData) {
      try {
        setConnectionStatus("Connecting...")
        await callSignaling.answerCall(roomId, callData.id, currentUserId)
      } catch (error) {
        console.error("Error answering call:", error)
        setConnectionStatus("Connection failed")
      }
    }
  }

  const handleMaximize = () => {
    setIsMinimized(false)
    // Streams will be restored by the useEffect
  }

  const handleSwitchCamera = async () => {
    if (!callData) return

    try {
      const newMode = facingMode === "user" ? "environment" : "user"
      const updatedStream = await callSignaling.switchCamera(callData.id, newMode)

      setFacingMode(newMode)
      currentLocalStream.current = updatedStream

      if (localVideoRef.current) {
        await setupVideoElement(localVideoRef.current, updatedStream, true)
      }
    } catch (error) {
      console.error("Failed to switch camera:", error)
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isMinimized) return

    setIsDragging(true)
    const rect = modalRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !isMinimized) return

    const newX = e.clientX - dragOffset.x
    const newY = e.clientY - dragOffset.y

    // Keep within viewport bounds
    const maxX = window.innerWidth - 250
    const maxY = window.innerHeight - 150

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMinimized) return

    const touch = e.touches[0]
    setIsDragging(true)
    const rect = modalRef.current?.getBoundingClientRect()
    if (rect) {
      setDragOffset({
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      })
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !isMinimized) return
    e.preventDefault()

    const touch = e.touches[0]
    const newX = touch.clientX - dragOffset.x
    const newY = touch.clientY - dragOffset.y

    // Keep within viewport bounds
    const maxX = window.innerWidth - 250
    const maxY = window.innerHeight - 150

    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    })
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleTouchMove, { passive: false })
      document.addEventListener("touchend", handleTouchEnd)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging])

  if (!isOpen) return null

  const otherParticipant = callData?.participants.find((p) => p !== currentUserId) || callData?.caller || "Unknown"

  if (isMinimized) {
    return (
      <div
        ref={modalRef}
        className="fixed z-50 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl cursor-move select-none overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: "250px",
          height: "150px",
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Mini video preview */}
        <div className="relative w-full h-full bg-slate-900">
          <video
            ref={localVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
            style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
          />

          {!isVideoOn && (
            <div className="absolute inset-0 bg-slate-700 flex items-center justify-center">
              <CameraOff className="w-8 h-8 text-gray-400" />
            </div>
          )}

          {/* Mini controls overlay */}
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
            <div className="text-white text-xs font-medium truncate">{otherParticipant}</div>

            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-gray-400 hover:text-white bg-black/50"
                onClick={handleMaximize}
              >
                <Maximize2 className="w-3 h-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-6 h-6 text-red-400 hover:text-red-300 bg-black/50"
                onClick={handleEndCall}
              >
                <PhoneOff className="w-3 h-3" />
              </Button>
            </div>
          </div>

          {/* Call duration */}
          <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1">
            <span className="text-white text-xs">{formatDuration(callDuration)}</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-slate-900 rounded-lg border border-slate-700 shadow-2xl w-full max-w-2xl h-full max-h-[70vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-slate-700 bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold text-sm">Video Call</h2>
            <span className="text-gray-400 text-sm">{otherParticipant}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">
              {callData?.status === "answered"
                ? `${formatDuration(callDuration)} • ${connectionStatus}`
                : connectionStatus}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white w-8 h-8"
              onClick={handleMinimize}
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 relative bg-black min-h-0">
          {/* Remote video (main) */}
          <video
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            style={{ backgroundColor: "#000" }}
          />

          {/* Local video (picture-in-picture) */}
          <div className="absolute top-3 right-3 w-20 h-15 sm:w-24 sm:h-18 bg-slate-800 rounded-lg overflow-hidden border border-slate-600 shadow-lg group">
            <video
              ref={localVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
              style={{
                backgroundColor: "#475569",
                transform: facingMode === "user" ? "scaleX(-1)" : "none", // only mirror for user facing camera
              }}
            />
            {!isVideoOn && (
              <div className="absolute inset-0 bg-slate-700 flex items-center justify-center">
                <CameraOff className="w-4 h-4 text-gray-400" />
              </div>
            )}

            {isVideoOn && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 rounded-full text-white hover:bg-white/20"
                  onClick={handleSwitchCamera}
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Call status overlay */}
          {callData?.status !== "answered" && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl text-white font-semibold">{otherParticipant.charAt(0).toUpperCase()}</span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{otherParticipant}</h3>
                <p className="text-gray-400 text-sm">
                  {callData?.status === "ringing"
                    ? isIncoming
                      ? "Incoming video call..."
                      : "Calling..."
                    : connectionStatus}
                </p>
              </div>
            </div>
          )}

          {/* Loading indicators */}
          {callData?.status === "answered" && (!localStreamReady || !remoteStreamReady) && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p className="text-white text-sm">Setting up video...</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-3 bg-slate-800/50 border-t border-slate-700 flex-shrink-0">
          <div className="flex justify-center gap-3 flex-wrap">
            {/* Incoming Call Actions */}
            {isIncoming && callData?.status === "ringing" && (
              <>
                <Button
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full w-10 h-10"
                >
                  <PhoneOff className="w-5 h-5" />
                </Button>
                <Button
                  onClick={handleAnswerCall}
                  className="bg-green-500 hover:bg-green-600 text-white rounded-full w-10 h-10"
                >
                  <Phone className="w-5 h-5" />
                </Button>
              </>
            )}

            {/* Active Call Controls */}
            {callData?.status === "answered" && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full w-10 h-10 ${
                    isMuted ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-white hover:bg-slate-600"
                  }`}
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className={`rounded-full w-10 h-10 ${
                    !isVideoOn ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-white hover:bg-slate-600"
                  }`}
                  onClick={() => setIsVideoOn(!isVideoOn)}
                >
                  {!isVideoOn ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full w-10 h-10 bg-slate-700 text-white hover:bg-slate-600 md:hidden"
                  onClick={handleSwitchCamera}
                  disabled={!isVideoOn}
                >
                  <RefreshCw className="w-5 h-5" />
                </Button>

                <Button
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full w-10 h-10"
                >
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </>
            )}

            {/* Outgoing Call Controls */}
            {!isIncoming && callData?.status === "ringing" && (
              <Button onClick={handleEndCall} className="bg-red-500 hover:bg-red-600 text-white rounded-full w-10 h-10">
                <PhoneOff className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
