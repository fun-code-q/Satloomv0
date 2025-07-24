"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Mic, MicOff, Users } from "lucide-react"
import { TheaterSignaling, type TheaterSession, type TheaterAction } from "@/utils/theater-signaling"
import { createPeerConnection } from "@/lib/webrtc"

interface TheaterFullscreenProps {
  isOpen: boolean
  onClose: () => void
  session: TheaterSession
  roomId: string
  currentUser: string
  currentUserId: string
  isHost: boolean
}

export function TheaterFullscreen({
  isOpen,
  onClose,
  session,
  roomId,
  currentUser,
  currentUserId,
  isHost,
}: TheaterFullscreenProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false)
  const [isMicMuted, setIsMicMuted] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()
  const theaterSignaling = TheaterSignaling.getInstance()
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())

  // Setup WebRTC for push-to-talk
  useEffect(() => {
    setupPushToTalk()
    return () => cleanup()
  }, [])

  // Listen for theater session updates
  useEffect(() => {
    if (!session) return

    const unsubscribe = theaterSignaling.listenForSession(roomId, session.id, (updatedSession) => {
      // Handle session ended - close for all participants
      if (updatedSession.status === "ended") {
        setTimeout(() => {
          onClose()
        }, 1000)
        return
      }

      if (updatedSession.lastAction && updatedSession.lastAction.hostId !== currentUserId) {
        handleRemoteAction(updatedSession.lastAction)
      }
    })

    return () => unsubscribe()
  }, [session, roomId, currentUserId, onClose])

  // Auto-hide controls
  useEffect(() => {
    if (showControls) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [showControls])

  const setupPushToTalk = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      // Mute by default
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false
      })

      // Setup peer connections for other participants
      session.participants.forEach((participantId) => {
        if (participantId !== currentUserId) {
          setupPeerConnection(participantId)
        }
      })
    } catch (error) {
      console.error("Error setting up push-to-talk:", error)
    }
  }

  const setupPeerConnection = (participantId: string) => {
    const peerConnection = createPeerConnection()

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current!)
      })
    }

    peerConnection.ontrack = (event) => {
      const remoteAudio = new Audio()
      remoteAudio.srcObject = event.streams[0]
      remoteAudio.play()
    }

    peerConnectionsRef.current.set(participantId, peerConnection)
  }

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
    }

    peerConnectionsRef.current.forEach((pc) => pc.close())
    peerConnectionsRef.current.clear()
  }

  const handleRemoteAction = (action: TheaterAction) => {
    const video = videoRef.current
    if (!video) return

    switch (action.type) {
      case "play":
        if (action.currentTime !== undefined) {
          video.currentTime = action.currentTime
        }
        video.play()
        setIsPlaying(true)
        break
      case "pause":
        video.pause()
        setIsPlaying(false)
        break
      case "seek":
        if (action.currentTime !== undefined) {
          video.currentTime = action.currentTime
          setCurrentTime(action.currentTime)
        }
        break
    }
  }

  const handlePlay = async () => {
    if (!isHost) return

    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      await theaterSignaling.sendAction(roomId, session.id, "pause", video.currentTime, currentUserId, currentUser)
    } else {
      video.play()
      setIsPlaying(true)
      await theaterSignaling.sendAction(roomId, session.id, "play", video.currentTime, currentUserId, currentUser)
    }
  }

  const handleSeek = async (newTime: number) => {
    if (!isHost) return

    const video = videoRef.current
    if (!video) return

    video.currentTime = newTime
    setCurrentTime(newTime)
    await theaterSignaling.sendAction(roomId, session.id, "seek", newTime, currentUserId, currentUser)
  }

  const handleSkip = async (seconds: number) => {
    if (!isHost) return

    const video = videoRef.current
    if (!video) return

    const newTime = Math.max(0, Math.min(duration, currentTime + seconds))
    handleSeek(newTime)
  }

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current
    if (video) {
      video.volume = newVolume
      setVolume(newVolume)
      setIsMuted(newVolume === 0)
    }
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (video) {
      const newMuted = !isMuted
      video.muted = newMuted
      setIsMuted(newMuted)
    }
  }

  const handlePushToTalk = (active: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = active
      })
      setIsPushToTalkActive(active)
      setIsMicMuted(!active)
    }
  }

  const handleClose = async () => {
    if (isHost) {
      // Host ending session - notify all participants
      await theaterSignaling.endSession(roomId, session.id)
    }
    onClose()
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const handleMouseMove = () => {
    setShowControls(true)
  }

  const handleVideoLoad = () => {
    const video = videoRef.current
    if (video) {
      setDuration(video.duration)
      video.addEventListener("timeupdate", () => {
        setCurrentTime(video.currentTime)
      })
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black z-50 flex flex-col"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video Container */}
      <div className="flex-1 relative">
        {session.videoType === "direct" ? (
          <video
            ref={videoRef}
            src={session.videoUrl}
            className="w-full h-full object-contain"
            onLoadedMetadata={handleVideoLoad}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          <iframe
            ref={iframeRef}
            src={session.videoUrl}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}

        {/* Loading Overlay */}
        {session.status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4" />
              <p>Loading video...</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6 transition-opacity duration-300 ${
          showControls ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center gap-2 text-white text-sm mb-2">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>
          <div className="relative">
            <div className="w-full h-1 bg-gray-600 rounded">
              <div
                className="h-full bg-cyan-400 rounded"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            {isHost && (
              <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onChange={(e) => handleSeek(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            )}
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Push to Talk */}
            <Button
              variant="ghost"
              size="icon"
              className={`w-10 h-10 rounded-full ${
                isPushToTalkActive ? "bg-green-500 hover:bg-green-600" : "bg-slate-700 hover:bg-slate-600"
              }`}
              onMouseDown={() => handlePushToTalk(true)}
              onMouseUp={() => handlePushToTalk(false)}
              onMouseLeave={() => handlePushToTalk(false)}
              onTouchStart={() => handlePushToTalk(true)}
              onTouchEnd={() => handlePushToTalk(false)}
            >
              {isMicMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
            </Button>

            {/* Playback Controls (Host Only) */}
            {isHost && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600"
                  onClick={() => handleSkip(-10)}
                >
                  <SkipBack className="w-5 h-5 text-white" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-600"
                  onClick={handlePlay}
                >
                  {isPlaying ? <Pause className="w-6 h-6 text-white" /> : <Play className="w-6 h-6 text-white" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-full bg-slate-700 hover:bg-slate-600"
                  onClick={() => handleSkip(10)}
                >
                  <SkipForward className="w-5 h-5 text-white" />
                </Button>
              </>
            )}

            {!isHost && (
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Users className="w-4 h-4" />
                <span>Host controls playback</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Volume Control */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600"
                onClick={toggleMute}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={isMuted ? 0 : volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-20 h-1 bg-gray-600 rounded appearance-none slider"
              />
            </div>

            {/* Participants Count */}
            <div className="flex items-center gap-1 text-white text-sm">
              <Users className="w-4 h-4" />
              <span>{session.participants.length}</span>
            </div>

            {/* Exit Button */}
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600"
              onClick={handleClose}
            >
              <X className="w-5 h-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Host Indicator */}
      {isHost && (
        <div className="absolute top-4 left-4 bg-cyan-500 text-white px-3 py-1 rounded-full text-sm font-medium">
          Host
        </div>
      )}

      {/* Push to Talk Indicator */}
      {isPushToTalkActive && (
        <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse">
          🎤 Speaking
        </div>
      )}
    </div>
  )
}
