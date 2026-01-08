"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, Minimize2, Maximize2, Camera, CameraOff } from "lucide-react"
import { CallSignaling, type CallData } from "@/utils/call-signaling"

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

  const modalRef = useRef<HTMLDivElement>(null)
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const callTimerRef = useRef<NodeJS.Timeout>()
  const callSignaling = CallSignaling.getInstance()

  useEffect(() => {
    if (isOpen && callData?.status === "answered") {
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current)
      }
    }
  }, [isOpen, callData?.status])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleEndCall = async () => {
    if (callData) {
      await callSignaling.endCall(roomId, callData.id)
    }
    setCallDuration(0)
    onClose()
  }

  const handleAnswerCall = async () => {
    if (callData) {
      await callSignaling.answerCall(roomId, callData.id, currentUserId)
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
          <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay muted playsInline />

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
                onClick={() => setIsMinimized(false)}
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
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div
        ref={modalRef}
        className="bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl w-full h-full max-w-4xl max-h-3xl mx-4 my-4 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <h2 className="text-white font-semibold">Video Call</h2>
            <span className="text-gray-400 text-sm">{otherParticipant}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">{formatDuration(callDuration)}</span>
            <Button
              variant="ghost"
              size="icon"
              className="text-gray-400 hover:text-white"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Video Area */}
        <div className="flex-1 relative bg-black">
          {/* Remote video (main) */}
          <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />

          {/* Local video (picture-in-picture) */}
          <div className="absolute top-4 right-4 w-48 h-36 bg-slate-800 rounded-lg overflow-hidden border border-slate-600">
            <video ref={localVideoRef} className="w-full h-full object-cover" autoPlay muted playsInline />

            {!isVideoOn && (
              <div className="absolute inset-0 bg-slate-700 flex items-center justify-center">
                <CameraOff className="w-8 h-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Call status overlay */}
          {callData?.status !== "answered" && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl text-white font-semibold">{otherParticipant.charAt(0).toUpperCase()}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{otherParticipant}</h3>
                <p className="text-gray-400">
                  {callData?.status === "ringing"
                    ? isIncoming
                      ? "Incoming video call..."
                      : "Calling..."
                    : "Connecting..."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-700">
          <div className="flex justify-center gap-4">
            {/* Incoming Call Actions */}
            {isIncoming && callData?.status === "ringing" && (
              <>
                <Button
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full w-14 h-14"
                >
                  <PhoneOff className="w-6 h-6" />
                </Button>
                <Button
                  onClick={handleAnswerCall}
                  className="bg-green-500 hover:bg-green-600 text-white rounded-full w-14 h-14"
                >
                  <Phone className="w-6 h-6" />
                </Button>
              </>
            )}

            {/* Active Call Controls */}
            {callData?.status === "answered" && (
              <>
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
                    !isVideoOn ? "bg-red-500/20 text-red-400" : "bg-slate-700 text-white"
                  }`}
                  onClick={() => setIsVideoOn(!isVideoOn)}
                >
                  {isVideoOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>

                <Button variant="ghost" size="icon" className="rounded-full w-12 h-12 bg-slate-700 text-white">
                  <Camera className="w-5 h-5" />
                </Button>

                <Button
                  onClick={handleEndCall}
                  className="bg-red-500 hover:bg-red-600 text-white rounded-full w-12 h-12"
                >
                  <PhoneOff className="w-5 h-5" />
                </Button>
              </>
            )}

            {/* Outgoing Call Controls */}
            {!isIncoming && callData?.status === "ringing" && (
              <Button onClick={handleEndCall} className="bg-red-500 hover:bg-red-600 text-white rounded-full w-14 h-14">
                <PhoneOff className="w-6 h-6" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
