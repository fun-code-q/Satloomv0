"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  SkipBack,
  Youtube,
  Music,
  Video,
  Settings,
  Subtitles,
  FastForward,
  Rewind,
  RotateCcw,
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

interface RaiseHandNotification {
  id: string
  userName: string
  timestamp: number
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
  const [showSettings, setShowSettings] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [raiseHandCount, setRaiseHandCount] = useState(0)
  const [hasRaisedHand, setHasRaisedHand] = useState(false)
  const [raiseHandNotifications, setRaiseHandNotifications] = useState<RaiseHandNotification[]>([])
  const [quality, setQuality] = useState("auto")
  const [showSubtitles, setShowSubtitles] = useState(false)
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null)
  const [lastKnownTime, setLastKnownTime] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const youtubeRef = useRef<HTMLIFrameElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()
  const theaterSignaling = TheaterSignaling.getInstance()

  // Auto-hide controls after 3 seconds
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    setShowControls(true)
    controlsTimeoutRef.current = setTimeout(() => {
      if (!showSettings && !showQueue) {
        setShowControls(false)
      }
    }, 3000)
  }, [showSettings, showQueue])

  // Handle mouse movement to show controls
  const handleMouseMove = useCallback(() => {
    resetControlsTimeout()
  }, [resetControlsTimeout])

  // Initialize YouTube player
  useEffect(() => {
    if (session.platform === "youtube" && youtubeRef.current) {
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      document.head.appendChild(script)

      window.onYouTubeIframeAPIReady = () => {
        const player = new window.YT.Player(youtubeRef.current, {
          videoId: session.videoUrl.split("v=")[1]?.split("&")[0],
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            fs: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
          },
          events: {
            onReady: (event: any) => {
              setYoutubePlayer(event.target)
            },
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true)
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false)
              }
            },
          },
        })
      }

      return () => {
        document.head.removeChild(script)
      }
    }
  }, [session.platform, session.videoUrl])

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
            setLastKnownTime(action.currentTime || 0)

            if (session.platform === "youtube" && youtubePlayer) {
              youtubePlayer.seekTo(action.currentTime || 0, true)
              youtubePlayer.playVideo()
            } else if (videoRef.current && action.currentTime !== undefined) {
              videoRef.current.currentTime = action.currentTime
              videoRef.current.play()
            }
            break
          case "pause":
            setIsPlaying(false)
            setLastKnownTime(action.currentTime || 0)

            if (session.platform === "youtube" && youtubePlayer) {
              youtubePlayer.pauseVideo()
            } else if (videoRef.current) {
              videoRef.current.pause()
            }
            break
          case "seek":
            if (action.currentTime !== undefined) {
              setCurrentTime(action.currentTime)
              setLastKnownTime(action.currentTime)

              if (session.platform === "youtube" && youtubePlayer) {
                youtubePlayer.seekTo(action.currentTime, true)
              } else if (videoRef.current) {
                videoRef.current.currentTime = action.currentTime
              }
            }
            break
          case "raise_hand":
            // Show raise hand notification
            const notification: RaiseHandNotification = {
              id: `hand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              userName: action.hostName,
              timestamp: Date.now(),
            }
            setRaiseHandNotifications((prev) => [...prev, notification])

            // Remove notification after 5 seconds
            setTimeout(() => {
              setRaiseHandNotifications((prev) => prev.filter((n) => n.id !== notification.id))
            }, 5000)
            break
          case "update_queue":
            if (action.nextVideos) {
              setQueue(
                action.nextVideos.map((video: any) => ({
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
  }, [session, roomId, currentUserId, theaterSignaling, youtubePlayer])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video || session.platform !== "direct") return

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      setLastKnownTime(video.currentTime)
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
  }, [session.platform])

  // YouTube player time tracking
  useEffect(() => {
    if (session.platform === "youtube" && youtubePlayer) {
      const interval = setInterval(() => {
        if (youtubePlayer.getCurrentTime) {
          const time = youtubePlayer.getCurrentTime()
          setCurrentTime(time)
          setLastKnownTime(time)

          if (youtubePlayer.getDuration) {
            setDuration(youtubePlayer.getDuration())
          }
        }
      }, 1000)

      return () => clearInterval(interval)
    }
  }, [youtubePlayer, session.platform])

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

  const getCurrentTime = () => {
    if (session.platform === "youtube" && youtubePlayer?.getCurrentTime) {
      return youtubePlayer.getCurrentTime()
    }
    if (session.platform === "direct" && videoRef.current) {
      return videoRef.current.currentTime
    }
    return lastKnownTime
  }

  const handlePlayPause = async () => {
    if (!isHost) return

    try {
      const time = getCurrentTime()

      if (isPlaying) {
        await theaterSignaling.sendAction(roomId, session.id, "pause", time, currentUserId, currentUser)

        if (session.platform === "youtube" && youtubePlayer) {
          youtubePlayer.pauseVideo()
        } else if (videoRef.current) {
          videoRef.current.pause()
        }
        setIsPlaying(false)
      } else {
        await theaterSignaling.sendAction(roomId, session.id, "play", time, currentUserId, currentUser)

        if (session.platform === "youtube" && youtubePlayer) {
          youtubePlayer.seekTo(time, true)
          youtubePlayer.playVideo()
        } else if (videoRef.current) {
          videoRef.current.currentTime = time
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

      if (session.platform === "youtube" && youtubePlayer) {
        youtubePlayer.seekTo(newTime, true)
      } else if (videoRef.current) {
        videoRef.current.currentTime = newTime
      }
      setCurrentTime(newTime)
      setLastKnownTime(newTime)
    } catch (error) {
      console.error("Error sending seek action:", error)
    }
  }

  const handleSkip = async (seconds: number) => {
    if (!isHost) return
    const newTime = Math.max(0, getCurrentTime() + seconds)
    handleSeek(newTime)
  }

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    if (session.platform === "youtube" && youtubePlayer) {
      youtubePlayer.setVolume(newVolume * 100)
    } else if (videoRef.current) {
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
    if (hasRaisedHand) return

    try {
      const time = getCurrentTime()
      await theaterSignaling.sendAction(roomId, session.id, "raise_hand", time, currentUserId, currentUser)
      setHasRaisedHand(true)
      setTimeout(() => setHasRaisedHand(false), 3000) // Reset after 3 seconds
    } catch (error) {
      console.error("Error raising hand:", error)
    }
  }

  const handleAddToQueue = async () => {
    if (!newVideoUrl.trim() || queue.length >= 3) return

    const platform = detectPlatform(newVideoUrl)
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
      const time = getCurrentTime()
      await theaterSignaling.sendAction(
        roomId,
        session.id,
        "update_queue",
        time,
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
      const time = getCurrentTime()
      await theaterSignaling.sendAction(
        roomId,
        session.id,
        "update_queue",
        time,
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

  const detectPlatform = (url: string): string => {
    if (url.match(/(youtube\.com|youtu\.be)/)) return "youtube"
    if (url.match(/vimeo\.com/)) return "vimeo"
    if (url.match(/soundcloud\.com/)) return "soundcloud"
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
                  ref={youtubeRef}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : session.platform === "vimeo" ? (
              <div className="w-full h-full">
                <iframe
                  src={`https://player.vimeo.com/video/${session.videoUrl.split("/").pop()}?autoplay=${isPlaying ? 1 : 0}&controls=0&title=0&byline=0&portrait=0`}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="autoplay; fullscreen"
                  allowFullScreen
                />
              </div>
            ) : session.platform === "soundcloud" ? (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-900 to-orange-600">
                <div className="w-full max-w-4xl px-8">
                  <iframe
                    width="100%"
                    height="300"
                    scrolling="no"
                    frameBorder="no"
                    allow="autoplay"
                    src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(session.videoUrl)}&color=%23ff5500&auto_play=${isPlaying}&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`}
                  />
                  <div className="mt-8 text-center">
                    <Music className="w-16 h-16 mx-auto mb-4 text-white/80" />
                    <h3 className="text-2xl font-bold text-white mb-2">SoundCloud Audio</h3>
                    <p className="text-white/80">Enjoying music together</p>
                  </div>
                </div>
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

          {/* Raise Hand Notifications */}
          <div className="absolute top-20 right-4 space-y-2 z-50">
            {raiseHandNotifications.map((notification) => (
              <div
                key={notification.id}
                className="bg-yellow-500/90 text-black px-4 py-2 rounded-lg shadow-lg animate-in slide-in-from-right-full duration-300"
              >
                <div className="flex items-center gap-2">
                  <Hand className="w-4 h-4" />
                  <span className="font-medium">{notification.userName} raised hand!</span>
                </div>
              </div>
            ))}
          </div>

          {/* Controls Overlay */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/60 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 bg-black/40 rounded-lg px-3 py-2 backdrop-blur-sm">
                  {getPlatformIcon(session.platform || "direct")}
                  <span className="text-white font-medium">
                    {session.platform?.charAt(0).toUpperCase() + session.platform?.slice(1)} Video
                  </span>
                </div>

                <Badge variant="secondary" className="bg-white/20 text-white backdrop-blur-sm">
                  <Users className="w-3 h-3 mr-1" />
                  {session.participants.length}
                </Badge>

                {raiseHandCount > 0 && (
                  <Badge variant="secondary" className="bg-yellow-500/30 text-yellow-200 backdrop-blur-sm">
                    <Hand className="w-3 h-3 mr-1" />
                    {raiseHandCount}
                  </Badge>
                )}

                {queue.length > 0 && (
                  <Badge variant="secondary" className="bg-blue-500/30 text-blue-200 backdrop-blur-sm">
                    Queue: {queue.length}/3
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 backdrop-blur-sm rounded-lg"
                  onClick={() => setShowSettings(!showSettings)}
                >
                  <Settings className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 backdrop-blur-sm rounded-lg"
                  onClick={() => setShowQueue(!showQueue)}
                >
                  {showQueue ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 backdrop-blur-sm rounded-lg"
                  onClick={handleFullscreenToggle}
                >
                  {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20 backdrop-blur-sm rounded-lg"
                  onClick={onClose}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Settings Panel */}
            {showSettings && (
              <div className="absolute top-16 right-4 w-64 bg-black/90 backdrop-blur-sm rounded-lg border border-white/20 p-4 z-40">
                <h3 className="text-white font-medium mb-3">Video Settings</h3>

                {session.platform === "youtube" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-white text-sm mb-1 block">Quality</label>
                      <Select value={quality} onValueChange={setQuality}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-600">
                          <SelectItem value="auto">Auto</SelectItem>
                          <SelectItem value="1080p">1080p</SelectItem>
                          <SelectItem value="720p">720p</SelectItem>
                          <SelectItem value="480p">480p</SelectItem>
                          <SelectItem value="360p">360p</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="subtitles"
                        checked={showSubtitles}
                        onChange={(e) => setShowSubtitles(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="subtitles" className="text-white text-sm flex items-center gap-1">
                        <Subtitles className="w-4 h-4" />
                        Subtitles
                      </label>
                    </div>
                  </div>
                )}

                {session.platform === "direct" && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="subtitles"
                        checked={showSubtitles}
                        onChange={(e) => setShowSubtitles(e.target.checked)}
                        className="rounded"
                      />
                      <label htmlFor="subtitles" className="text-white text-sm flex items-center gap-1">
                        <Subtitles className="w-4 h-4" />
                        Subtitles
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-6">
              {/* Progress Bar */}
              {(session.platform === "direct" || session.platform === "youtube") && duration > 0 && (
                <div className="mb-6">
                  <div className="relative w-full h-2 bg-white/20 rounded-full cursor-pointer group">
                    <div
                      className="absolute top-0 left-0 h-full bg-red-500 rounded-full transition-all"
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
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ left: `calc(${(currentTime / duration) * 100}% - 8px)` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-white/80 mt-2">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}

              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-6">
                {/* Left Controls */}
                <div className="flex items-center gap-4">
                  {isHost && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full w-12 h-12"
                        onClick={() => handleSkip(-10)}
                      >
                        <Rewind className="w-5 h-5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full w-12 h-12"
                        onClick={() => handleSkip(-5)}
                      >
                        <SkipBack className="w-5 h-5" />
                      </Button>
                    </>
                  )}

                  {/* Play/Pause Button */}
                  {isHost ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/30 backdrop-blur-sm rounded-full w-16 h-16 bg-white/10"
                      onClick={handlePlayPause}
                    >
                      {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                    </Button>
                  ) : (
                    <div className="w-16 h-16 flex items-center justify-center text-white/50 bg-white/10 rounded-full backdrop-blur-sm">
                      {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                    </div>
                  )}

                  {isHost && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full w-12 h-12"
                        onClick={() => handleSkip(5)}
                      >
                        <SkipForward className="w-5 h-5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-white hover:bg-white/20 backdrop-blur-sm rounded-full w-12 h-12"
                        onClick={() => handleSkip(10)}
                      >
                        <FastForward className="w-5 h-5" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Bottom Row Controls */}
              <div className="flex items-center justify-between mt-6">
                {/* Volume Controls */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 backdrop-blur-sm rounded-lg"
                    onClick={handleMuteToggle}
                  >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                  </Button>
                  <div className="w-24 flex items-center">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => handleVolumeChange(Number(e.target.value))}
                      className="w-full h-1 bg-white/20 rounded-lg appearance-none slider"
                    />
                  </div>
                </div>

                {/* Right Controls */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`text-white hover:bg-white/20 backdrop-blur-sm rounded-lg transition-all ${hasRaisedHand ? "bg-yellow-500/30 text-yellow-200" : ""}`}
                    onClick={handleRaiseHand}
                    disabled={hasRaisedHand}
                  >
                    <Hand className="w-5 h-5" />
                  </Button>

                  {queue.length > 0 && isHost && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20 backdrop-blur-sm rounded-lg"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Queue Panel */}
          {showQueue && (
            <div className="absolute top-0 right-0 w-80 h-full bg-black/95 backdrop-blur-sm border-l border-white/20 overflow-y-auto z-30">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-white font-medium">Queue ({queue.length}/3)</h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 rounded-lg"
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
                      className="bg-white/10 border-white/20 text-white placeholder-white/50 rounded-lg"
                      disabled={queue.length >= 3}
                    />
                    <Button
                      onClick={handleAddToQueue}
                      disabled={!newVideoUrl.trim() || queue.length >= 3}
                      className="bg-blue-500 hover:bg-blue-600 rounded-lg"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  {queue.length >= 3 && <p className="text-yellow-400 text-xs mt-1">Queue is full (max 3 videos)</p>}
                </div>

                {/* Queue Items */}
                <div className="space-y-2">
                  {queue.map((item, index) => (
                    <div key={item.id} className="bg-white/10 rounded-lg p-3 hover:bg-white/20 transition-colors">
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
                            className="text-white/70 hover:text-white hover:bg-white/20 ml-2 rounded-lg"
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
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
