"use client"

import type React from "react"
import { Mic, MicOff, Phone, PhoneOff, Volume2, VolumeX, Minimize2, Maximize2 } from "lucide-react"
import { CallSignaling, type CallData } from "@/utils/call-signaling"
import { CallSounds } from "@/utils/call-sounds"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"

interface AudioCallModalProps {
  isOpen: boolean
  onClose: () => void
  roomId: string
  currentUser: string
  currentUserId: string
  callData: CallData | null
  isIncoming?: boolean
}

export function AudioCallModal({
  isOpen,
  onClose,
  roomId,
  currentUser,
  currentUserId,
  callData,
  isIncoming = false,
}: AudioCallModalProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [isSpeakerOn, setIsSpeakerOn] = useState(true)
  const [isMinimized, setIsMinimized] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [connectionStatus, setConnectionStatus] = useState<string>("Connecting...")
  const [isAnswering, setIsAnswering] = useState(false)

  const modalRef = useRef<HTMLDivElement>(null)
  const localAudioRef = useRef<HTMLAudioElement>(null)
  const remoteAudioRef = useRef<HTMLAudioElement>(null)
  const callTimerRef = useRef<NodeJS.Timeout>()
  const callSignaling = CallSignaling.getInstance()

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
        console.log("AudioCallModal unmounting with active call, cleaning up...")
        CallSounds.getInstance().stopAll()
        callSignaling.endCall(roomIdRef.current, activeCall.id).catch(console.error)
      }
    }
  }, [])

  useEffect(() => {
    if (isOpen && callData?.status === "answered") {
      // Stop any ringing sounds when call connects
      CallSounds.getInstance().stopAll()

      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else if (isOpen && !isIncoming && callData?.status === "ringing") {
      // Play ringback tone for outgoing calls
      CallSounds.getInstance().playRingback()
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
      // Ensure sounds stop if modal closes while ringing
      if (callData?.status === "ringing") {
        CallSounds.getInstance().stopAll()
      }
    }
  }, [isOpen, callData?.status, isIncoming])

  // Handle media streams
  useEffect(() => {
    if (!callData || !isOpen) return

    const setupMediaStreams = async () => {
      try {
        // Set up remote stream callback
        callSignaling.setRemoteStreamCallback((callId: string, stream: MediaStream) => {
          if (callId === callData.id && remoteAudioRef.current) {
            console.log("Setting remote audio stream")
            remoteAudioRef.current.srcObject = stream
            remoteAudioRef.current.play().catch(console.error)
            setConnectionStatus("Connected")
          }
        })

        // Get local stream if call is answered
        if (callData.status === "answered") {
          const localStream = callSignaling.getLocalStream(callData.id)
          if (localStream && localAudioRef.current) {
            console.log("Setting local audio stream")
            localAudioRef.current.srcObject = localStream
            localAudioRef.current.muted = true // Always mute local audio to prevent feedback
          }

          const remoteStream = callSignaling.getRemoteStream(callData.id)
          if (remoteStream && remoteAudioRef.current) {
            console.log("Setting existing remote audio stream")
            remoteAudioRef.current.srcObject = remoteStream
            remoteAudioRef.current.play().catch(console.error)
            setConnectionStatus("Connected")
          }
        }
      } catch (error) {
        console.error("Error setting up media streams:", error)
        setConnectionStatus("Connection failed")
      }
    }

    setupMediaStreams()
  }, [callData, isOpen])

  // Handle mute/unmute
  useEffect(() => {
    if (callData) {
      const localStream = callSignaling.getLocalStream(callData.id)
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0]
        if (audioTrack) {
          audioTrack.enabled = !isMuted
        }
      }
    }
  }, [isMuted, callData])

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
    onClose()
  }

  const handleAnswerCall = async () => {
    if (callData && !isAnswering) {
      try {
        setIsAnswering(true)
        setConnectionStatus("Connecting...")
        await callSignaling.answerCall(roomId, callData.id, currentUserId)
      } catch (error) {
        console.error("Error answering call:", error)
        setConnectionStatus("Connection failed")
        setIsAnswering(false)
      }
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
    const maxX = window.innerWidth - 200
    const maxY = window.innerHeight - 100

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
    const maxX = window.innerWidth - 200
    const maxY = window.innerHeight - 100

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

  useEffect(() => {
    if (callData?.status === "answered") {
      setIsAnswering(false)
    }
  }, [callData?.status])

  if (!isOpen) return null

  const otherParticipant = callData?.participants.find((p) => p !== currentUserId) || callData?.caller || "Unknown"

  if (isMinimized) {
    return (
      <div
        ref={modalRef}
        className="fixed z-50 bg-slate-800 border border-slate-700 rounded-2xl p-3 shadow-2xl cursor-move select-none"
        style={{
          left: position.x,
          top: position.y,
          width: "200px",
        }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
              <Phone className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <p className="text-white text-sm font-medium truncate">{otherParticipant}</p>
              <p className="text-gray-400 text-xs">{formatDuration(callDuration)}</p>
            </div>
          </div>

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-gray-400 hover:text-white"
              onClick={() => setIsMinimized(false)}
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-6 h-6 text-red-400 hover:text-red-300"
              onClick={handleEndCall}
            >
              <PhoneOff className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        ref={modalRef}
        className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-md mx-auto"
      >
        {/* Hidden audio elements */}
        <audio ref={localAudioRef} autoPlay muted playsInline />
        <audio ref={remoteAudioRef} autoPlay playsInline />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-white font-semibold">Audio Call</h2>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            onClick={() => setIsMinimized(true)}
          >
            <Minimize2 className="w-4 h-4" />
          </Button>
        </div>

        {/* Call Info */}
        <div className="p-6 text-center">
          <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl text-white font-semibold">{otherParticipant.charAt(0).toUpperCase()}</span>
          </div>

          <h3 className="text-xl font-semibold text-white mb-2">{otherParticipant}</h3>

          <p className="text-gray-400 mb-4">
            {callData?.status === "ringing"
              ? isIncoming
                ? "Incoming call..."
                : "Calling..."
              : callData?.status === "answered"
                ? `${formatDuration(callDuration)} • ${connectionStatus}`
                : connectionStatus}
          </p>

          {/* Incoming Call Actions */}
          {isIncoming && callData?.status === "ringing" && (
            <div className="flex gap-4 justify-center mb-6">
              <Button onClick={handleEndCall} className="bg-red-500 hover:bg-red-600 text-white rounded-full w-16 h-16">
                <PhoneOff className="w-6 h-6" />
              </Button>
              <Button
                onClick={handleAnswerCall}
                disabled={isAnswering}
                className="bg-green-500 hover:bg-green-600 text-white rounded-full w-16 h-16 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Phone className="w-6 h-6" />
              </Button>
            </div>
          )}

          {/* Active Call Controls */}
          {callData?.status === "answered" && (
            <div className="flex gap-4 justify-center mb-6">
              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-12 h-12 ${
                  isMuted ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-white"
                }`}
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`rounded-full w-12 h-12 ${
                  isSpeakerOn ? "bg-blue-500/20 text-blue-400" : "bg-slate-700 text-white"
                }`}
                onClick={() => setIsSpeakerOn(!isSpeakerOn)}
              >
                {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>

              <Button onClick={handleEndCall} className="bg-red-500 hover:bg-red-600 text-white rounded-full w-12 h-12">
                <PhoneOff className="w-5 h-5" />
              </Button>
            </div>
          )}

          {/* Outgoing Call Controls */}
          {!isIncoming && callData?.status === "ringing" && (
            <div className="flex justify-center">
              <Button onClick={handleEndCall} className="bg-red-500 hover:bg-red-600 text-white rounded-full w-16 h-16">
                <PhoneOff className="w-6 h-6" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
