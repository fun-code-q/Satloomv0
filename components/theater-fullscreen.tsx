"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
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
  List,
  Youtube,
  Music,
  Video,
  ExternalLink,
} from "lucide-react"
import { TheaterSignaling, type TheaterSession } from "@/utils/theater-signaling"

interface TheaterFullscreenProps {
  session: TheaterSession
  roomId: string
  userId: string
  userName: string
  isHost: boolean
  onClose: () => void
}

export function TheaterFullscreen({ session, roomId, userId, userName, isHost, onClose }: TheaterFullscreenProps) {
  const [isPlaying, setIsPlaying] = useState(session.status === "playing")
  const [currentTime, setCurrentTime] = useState(session.currentTime || 0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [showQueue, setShowQueue] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [raiseHandCount, setRaiseHandCount] = useState(session.raiseHands || 0)
  const [hasRaisedHand, setHasRaisedHand] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()
  const theaterSignaling = TheaterSignaling.getInstance()

  // Platform detection
  const getPlatform = (url: string) => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube"
    if (url.includes("vimeo.com")) return "vimeo"
    if (url.includes("soundcloud.com")) return "soundcloud"
    return "direct"
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

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    setShowControls(true)
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }, [])

  // Handle mouse movement
  const handleMouseMove = useCallback(() => {
    resetControlsTimeout()
  }, [resetControlsTimeout])

  // Listen for session updates
  useEffect(() => {
    const unsubscribe = theaterSignaling.listenForSession(roomId, session.id, (updatedSession) => {
      setIsPlaying(updatedSession.status === "playing")
      setCurrentTime(updatedSession.currentTime || 0)
      setRaiseHandCount(updatedSession.raiseHands || 0)

      // Handle host actions
      if (updatedSession.lastAction && updatedSession.lastAction.hostId !== userId) {
        const action = updatedSession.lastAction

        if (action.type === "play" && videoRef.current) {
          videoRef.current.currentTime = action.currentTime || 0
          videoRef.current.play()
        } else if (action.type === "pause" && videoRef.current) {
          videoRef.current.currentTime = action.currentTime || 0
          videoRef.current.pause()
        } else if (action.type === "seek" && videoRef.current) {
          videoRef.current.currentTime = action.currentTime || 0
        }
      }
    })

    return unsubscribe
  }, [roomId, session.id, userId, theaterSignaling])

  // Video event handlers
  const handlePlay = async () => {
    if (!isHost) return

    const time = videoRef.current?.currentTime || 0
    await theaterSignaling.sendAction(roomId, session.id, "play", time, userId, userName)
    setIsPlaying(true)
  }

  const handlePause = async () => {
    if (!isHost) return

    const time = videoRef.current?.currentTime || 0
    await theaterSignaling.sendAction(roomId, session.id, "pause", time, userId, userName)
    setIsPlaying(false)
  }

  const handleSeek = async (newTime: number) => {
    if (!isHost) return

    if (videoRef.current) {
      videoRef.current.currentTime = newTime
    }
    await theaterSignaling.sendAction(roomId, session.id, "seek", newTime, userId, userName)
    setCurrentTime(newTime)
  }

  const handleTimeUpdate = () => {
    if (videoRef.current && isHost) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  // Volume controls
  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0]
    setVolume(vol)
    if (videoRef.current) {
      videoRef.current.volume = vol
    }
    setIsMuted(vol === 0)
  }

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume
        setIsMuted(false)
      } else {
        videoRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }

  // Fullscreen controls
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Queue management
  const addToQueue = async () => {
    if (!isHost || !newVideoUrl.trim()) return

    const currentQueue = session.nextVideos || []
    if (currentQueue.length >= 3) {
      alert("Queue is full (maximum 3 videos)")
      return
    }

    const updatedQueue = [...currentQueue, newVideoUrl.trim()]
    await theaterSignaling.sendAction(roomId, session.id, "update_queue", currentTime, userId, userName, updatedQueue)
    setNewVideoUrl("")
  }

  const removeFromQueue = async (index: number) => {
    if (!isHost) return

    const currentQueue = session.nextVideos || []
    const updatedQueue = currentQueue.filter((_, i) => i !== index)
    await theaterSignaling.sendAction(roomId, session.id, "update_queue", currentTime, userId, userName, updatedQueue)
  }

  // Raise hand
  const raiseHand = async () => {
    if (hasRaisedHand) return

    await theaterSignaling.sendAction(roomId, session.id, "raise_hand", currentTime, userId, userName)
    setHasRaisedHand(true)

    // Reset after 5 seconds
    setTimeout(() => {
      setHasRaisedHand(false)
    }, 5000)
  }

  // Format time
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }

  // Cleanup
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [])

  // Initialize controls timeout
  useEffect(() => {
    resetControlsTimeout()
  }, [resetControlsTimeout])

  return (
    <div ref={containerRef} className="fixed inset-0 bg-black z-50 flex flex-col" onMouseMove={handleMouseMove}>
      {/* Video Container */}
      <div className="flex-1 relative flex items-center justify-center">
        {session.platform === "direct" ? (
          <video
            ref={videoRef}
            src={session.videoUrl}
            className="max-w-full max-h-full"
            onPlay={handlePlay}
            onPause={handlePause}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            controls={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white">
              <div className="flex items-center justify-center gap-2 mb-4">
                {getPlatformIcon(session.platform)}
                <span className="text-lg">External Video</span>
              </div>
              <p className="text-gray-400 mb-4">This video is hosted on {session.platform}</p>
              <Button
                onClick={() => window.open(session.videoUrl, "_blank")}
                variant="outline"
                className="text-white border-white hover:bg-white hover:text-black"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            </div>
          </div>
        )}

        {/* Click blocker for non-hosts */}
        {!isHost && <div className="absolute inset-0 bg-transparent cursor-not-allowed" />}

        {/* Top Bar */}
        <div
          className={`absolute top-0 left-0 right-0 bg-gradient-to-b from-black/50 to-transparent p-4 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button onClick={onClose} variant="ghost" size="sm" className="text-white hover:bg-white/20">
                <X className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                {getPlatformIcon(session.platform)}
                <span className="text-white font-medium">Theater Mode</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-white/20 text-white">
                <Users className="w-3 h-3 mr-1" />
                {session.participants?.length || 1}
              </Badge>

              {raiseHandCount > 0 && (
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
                  <Hand className="w-3 h-3 mr-1" />
                  {raiseHandCount}
                </Badge>
              )}

              {(session.nextVideos?.length || 0) > 0 && (
                <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
                  <List className="w-3 h-3 mr-1" />
                  {session.nextVideos?.length}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Controls */}
        {session.platform === "direct" && (
          <div
            className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4 transition-opacity duration-300 ${showControls ? "opacity-100" : "opacity-0"}`}
          >
            {/* Progress Bar */}
            <div className="mb-4">
              <Slider
                value={[currentTime]}
                max={duration}
                step={1}
                onValueChange={([value]) => handleSeek(value)}
                className="w-full"
                disabled={!isHost}
              />
              <div className="flex justify-between text-xs text-white/70 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isHost ? (
                  <Button
                    onClick={isPlaying ? handlePause : handlePlay}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                ) : (
                  <div className="text-white/50 text-sm">Host controls playback</div>
                )}

                <div className="flex items-center gap-2">
                  <Button onClick={toggleMute} variant="ghost" size="sm" className="text-white hover:bg-white/20">
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    max={1}
                    step={0.1}
                    onValueChange={handleVolumeChange}
                    className="w-20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={raiseHand}
                  variant="ghost"
                  size="sm"
                  className={`text-white hover:bg-white/20 ${hasRaisedHand ? "bg-yellow-500/20" : ""}`}
                  disabled={hasRaisedHand}
                >
                  <Hand className="w-4 h-4" />
                </Button>

                <Button
                  onClick={() => setShowQueue(!showQueue)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <List className="w-4 h-4" />
                </Button>

                <Button onClick={toggleFullscreen} variant="ghost" size="sm" className="text-white hover:bg-white/20">
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Queue Panel */}
      {showQueue && (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-black/90 backdrop-blur-sm border-l border-white/20">
          <Card className="h-full bg-transparent border-0">
            <CardContent className="p-4 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Queue ({session.nextVideos?.length || 0}/3)</h3>
                <Button
                  onClick={() => setShowQueue(false)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              {isHost && (
                <div className="mb-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newVideoUrl}
                      onChange={(e) => setNewVideoUrl(e.target.value)}
                      placeholder="Add video URL..."
                      className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded text-white placeholder-white/50 text-sm"
                      disabled={(session.nextVideos?.length || 0) >= 3}
                    />
                    <Button
                      onClick={addToQueue}
                      size="sm"
                      disabled={!newVideoUrl.trim() || (session.nextVideos?.length || 0) >= 3}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {session.nextVideos?.map((url, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-white/5 rounded">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getPlatformIcon(getPlatform(url))}
                        <span className="text-white text-sm truncate">{url}</span>
                      </div>
                      {isHost && (
                        <Button
                          onClick={() => removeFromQueue(index)}
                          variant="ghost"
                          size="sm"
                          className="text-red-400 hover:bg-red-500/20 flex-shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )) || (
                    <div className="text-center text-white/50 py-8">
                      <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No videos in queue</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
