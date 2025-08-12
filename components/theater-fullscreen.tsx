"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { TheaterSignaling, type TheaterSession } from "@/utils/theater-signaling"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Users,
  Hand,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  SkipForward,
  Youtube,
  Music,
  Video,
} from "lucide-react"

interface TheaterFullscreenProps {
  isOpen: boolean
  onClose: () => void
  session: TheaterSession
  roomId: string
  currentUser: string
  currentUserId: string
  isHost: boolean
}

interface QueueItem {
  id: string
  url: string
  platform: string
  title: string
  addedBy: string
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showQueue, setShowQueue] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [raiseHandCount, setRaiseHandCount] = useState(0)
  const [hasRaisedHand, setHasRaisedHand] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()
  const theaterSignaling = TheaterSignaling.getInstance()

  // Auto-hide controls after 3 seconds
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    setShowControls(true)
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }, [])

  // Handle mouse movement to show controls
  const handleMouseMove = useCallback(() => {
    resetControlsTimeout()
  }, [resetControlsTimeout])

  // Initialize theater session listener
  useEffect(() => {
    if (!session) return

    const unsubscribe = theaterSignaling.listenForSession(roomId, session.id, (updatedSession) => {
      // Update local state based on session changes
      if (updatedSession.lastAction && updatedSession.lastAction.hostId !== currentUserId) {
        const action = updatedSession.lastAction

        switch (action.type) {
          case "play":
            setIsPlaying(true)
            if (videoRef.current && action.currentTime !== undefined) {
              videoRef.current.currentTime = action.currentTime
              videoRef.current.play()
            }
            break
          case "pause":
            setIsPlaying(false)
            if (videoRef.current) {
              videoRef.current.pause()
            }
            break
          case "seek":
            if (videoRef.current && action.currentTime !== undefined) {
              videoRef.current.currentTime = action.currentTime
              setCurrentTime(action.currentTime)
            }
            break
          case "update_queue":
            if (action.nextVideos) {
              setQueue(
                action.nextVideos.map((video) => ({
                  id: video.id,
                  url: video.url,
                  platform: video.platform,
                  title: video.title || "Untitled Video",
                  addedBy: video.addedBy,
                })),
              )
            }
            break
        }
      }

      // Update raise hand count
      setRaiseHandCount(updatedSession.raiseHands || 0)
    })

    return unsubscribe
  }, [session, roomId, currentUserId, theaterSignaling])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
    }

    const handleDurationChange = () => {
      setDuration(video.duration)
    }

    const handlePlay = () => {
      setIsPlaying(true)
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    video.addEventListener("timeupdate", handleTimeUpdate)
    video.addEventListener("durationchange", handleDurationChange)
    video.addEventListener("play", handlePlay)
    video.addEventListener("pause", handlePause)

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate)
      video.removeEventListener("durationchange", handleDurationChange)
      video.removeEventListener("play", handlePlay)
      video.removeEventListener("pause", handlePause)
    }
  }, [])

  // Fullscreen handling
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange)
  }, [])

  // Initialize controls timeout
  useEffect(() => {
    resetControlsTimeout()
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [resetControlsTimeout])

  const handlePlayPause = async () => {
    if (!isHost) return

    try {
      if (isPlaying) {
        await theaterSignaling.sendAction(roomId, session.id, "pause", currentTime, currentUserId, currentUser)
        if (videoRef.current) {
          videoRef.current.pause()
        }
        setIsPlaying(false)
      } else {
        await theaterSignaling.sendAction(roomId, session.id, "play", currentTime, currentUserId, currentUser)
        if (videoRef.current) {
          videoRef.current.play()
        }
        setIsPlaying(true)
      }
    } catch (error) {
      console.error("Error sending play/pause action:", error)
    }
  }

  const handleSeek = async (newTime: number) => {
    if (!isHost) return

    try {
      await theaterSignaling.sendAction(roomId, session.id, "seek", newTime, currentUserId, currentUser)
      if (videoRef.current) {
        videoRef.current.currentTime = newTime
      }
      setCurrentTime(newTime)
    } catch (error) {
      console.error("Error sending seek action:", error)
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    if (videoRef.current) {
      videoRef.current.volume = newVolume
    }
    setIsMuted(newVolume === 0)
  }

  const handleMuteToggle = () => {
    if (isMuted) {
      handleVolumeChange(volume > 0 ? volume : 0.5)
    } else {
      handleVolumeChange(0)
    }
  }

  const handleFullscreenToggle = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const handleRaiseHand = async () => {
    try {
      await theaterSignaling.sendAction(roomId, session.id, "raise_hand", currentTime, currentUserId, currentUser)
      setHasRaisedHand(true)
      setTimeout(() => setHasRaisedHand(false), 3000) // Reset after 3 seconds
    } catch (error) {
      console.error("Error raising hand:", error)
    }
  }

  const handleAddToQueue = async () => {
    if (!newVideoUrl.trim() || queue.length >= 3) return

    const platform = theaterSignaling.detectPlatform(newVideoUrl)
    const newVideo: QueueItem = {
      id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: newVideoUrl.trim(),
      platform,
      title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Video`,
      addedBy: currentUser,
    }

    const updatedQueue = [...queue, newVideo]
    setQueue(updatedQueue)

    try {
      await theaterSignaling.sendAction(
        roomId,
        session.id,
        "update_queue",
        currentTime,
        currentUserId,
        currentUser,
        updatedQueue.map((item) => ({
          id: item.id,
          url: item.url,
          platform: item.platform,
          title: item.title,
          addedBy: item.addedBy,
          addedAt: Date.now(),
        })),
      )
      setNewVideoUrl("")
    } catch (error) {
      console.error("Error adding video to queue:", error)
    }
  }

  const handleRemoveFromQueue = async (videoId: string) => {
    if (!isHost) return

    const updatedQueue = queue.filter((item) => item.id !== videoId)
    setQueue(updatedQueue)

    try {
      await theaterSignaling.sendAction(
        roomId,
        session.id,
        "update_queue",
        currentTime,
        currentUserId,
        currentUser,
        updatedQueue.map((item) => ({
          id: item.id,
          url: item.url,
          platform: item.platform,
          title: item.title,
          addedBy: item.addedBy,
          addedAt: Date.now(),
        })),
      )
    } catch (error) {
      console.error("Error removing video from queue:", error)
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "youtube":
        return <Youtube className="w-4 h-4 text-red-500" />
      case "vimeo":
        return <Video className="w-4 h-4 text-blue-500" />
      case "soundcloud":
        return <Music className="w-4 h-4 text-orange-500" />
      default:
        return <Video className="w-4 h-4 text-gray-500" />
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-none w-full h-full p-0 bg-black border-none">
        <DialogTitle className="sr-only">Theater Mode - {session.videoUrl}</DialogTitle>
        <DialogDescription className="sr-only">
          Watch videos together in theater mode. Host can control playback, and all participants can see the same
          content in real-time.
        </DialogDescription>

        <div
          ref={containerRef}
          className="relative w-full h-full bg-black overflow-hidden"
          onMouseMove={handleMouseMove}
        >
          {/* Video Player */}
          <div className="relative w-full h-full flex items-center justify-center">
            {session.platform === "youtube" ? (
              <div className="w-full h-full">
                <iframe
                  src={`https://www.youtube.com/embed/${session.videoUrl.split("v=")[1]?.split("&")[0]}?autoplay=${isPlaying ? 1 : 0}&controls=0&disablekb=1&fs=0&modestbranding=1`}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : session.platform === "vimeo" ? (
              <div className="w-full h-full">
                <iframe
                  src={`https://player.vimeo.com/video/${session.videoUrl.split("/").pop()}?autoplay=${isPlaying ? 1 : 0}&controls=0`}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : (
              <video
                ref={videoRef}
                src={session.videoUrl}
                className="w-full h-full object-contain"
                crossOrigin="anonymous"
              />
            )}

            {/* Click blocker for non-hosts */}
            {!isHost && (
              <div
                className="absolute inset-0 bg-transparent cursor-not-allowed"
                title="Only the host can control playback"
              />
            )}
          </div>

          {/* Controls Overlay */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getPlatformIcon(session.platform || "direct")}
                  <span className="text-white font-medium">
                    {session.platform?.charAt(0).toUpperCase() + session.platform?.slice(1)} Video
                  </span>
                </div>

                <Badge variant="secondary" className="bg-white/20 text-white">
                  <Users className="w-3 h-3 mr-1" />
                  {session.participants.length}
                </Badge>

                {raiseHandCount > 0 && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
                    <Hand className="w-3 h-3 mr-1" />
                    {raiseHandCount}
                  </Badge>
                )}

                {queue.length > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                    Queue: {queue.length}/3
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setShowQueue(!showQueue)}
                >
                  {showQueue ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={handleFullscreenToggle}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>

                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={onClose}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {/* Progress Bar */}
              {session.platform === "direct" && duration > 0 && (
                <div className="mb-4">
                  <div className="relative w-full h-1 bg-white/30 rounded-full cursor-pointer">
                    <div
                      className="absolute top-0 left-0 h-full bg-red-500 rounded-full"
                      style={{ width: `${(currentTime / duration) * 100}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max={duration}
                      value={currentTime}
                      onChange={(e) => handleSeek(Number(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      disabled={!isHost}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-white/70 mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {isHost ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20"
                      onClick={handlePlayPause}
                    >
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    </Button>
                  ) : (
                    <div className="w-10 h-10 flex items-center justify-center text-white/50">
                      {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    </div>
                  )}

                  {session.platform === "direct" && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20"
                        onClick={handleMuteToggle}
                      >
                        {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </Button>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => handleVolumeChange(Number(e.target.value))}
                        className="w-20"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`text-white hover:bg-white/20 ${hasRaisedHand ? "bg-yellow-500/30" : ""}`}
                    onClick={handleRaiseHand}
                    disabled={hasRaisedHand}
                  >
                    <Hand className="w-4 h-4" />
                  </Button>

                  {queue.length > 0 && isHost && (
                    <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                      <SkipForward className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Queue Panel */}
          {showQueue && (
            <div className="absolute top-0 right-0 w-80 h-full bg-black/90 backdrop-blur-sm border-l border-white/20 p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Queue ({queue.length}/3)</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={() => setShowQueue(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {/* Add Video */}
              <div className="mb-4">
                <div className="flex gap-2">
                  <Input
                    value={newVideoUrl}
                    onChange={(e) => setNewVideoUrl(e.target.value)}
                    placeholder="Paste video URL..."
                    className="bg-white/10 border-white/20 text-white placeholder-white/50"
                    disabled={queue.length >= 3}
                  />
                  <Button
                    onClick={handleAddToQueue}
                    disabled={!newVideoUrl.trim() || queue.length >= 3}
                    className="bg-blue-500 hover:bg-blue-600"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {queue.length >= 3 && <p className="text-yellow-400 text-xs mt-1">Queue is full (max 3 videos)</p>}
              </div>

              {/* Queue Items */}
              <div className="space-y-2">
                {queue.map((item, index) => (
                  <div key={item.id} className="bg-white/10 rounded-lg p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getPlatformIcon(item.platform)}
                          <span className="text-white text-sm font-medium truncate">{item.title}</span>
                        </div>
                        <p className="text-white/70 text-xs">Added by {item.addedBy}</p>
                        <p className="text-white/50 text-xs truncate">{item.url}</p>
                      </div>
                      {isHost && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-white/70 hover:text-white hover:bg-white/20 ml-2"
                          onClick={() => handleRemoveFromQueue(item.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}

                {queue.length === 0 && (
                  <div className="text-center text-white/50 py-8">
                    <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No videos in queue</p>
                    <p className="text-xs">Add videos to watch next</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
