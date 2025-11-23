"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  X,
  Settings,
  List,
  Hand,
  Users,
  Youtube,
  Music,
  VideoIcon,
  Film,
  Plus,
  Trash2,
} from "lucide-react"
import { TheaterSignaling, type TheaterSession, type QueueVideo } from "@/utils/theater-signaling"
import { Input } from "@/components/ui/input"
import { CallSounds } from "@/utils/call-sounds"

interface TheaterFullscreenProps {
  isOpen: boolean
  onClose: () => void
  session: TheaterSession
  roomId: string
  currentUser: string
  currentUserId: string
  isHost: boolean
}

interface RaiseHandNotification {
  id: string
  userName: string
  timestamp: number
}

// Declare global YouTube API
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
    Vimeo: any
    SC: any
  }
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
  const [showQueue, setShowQueue] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [newVideoUrl, setNewVideoUrl] = useState("")
  const [queue, setQueue] = useState<QueueVideo[]>([])
  const [raiseHandCount, setRaiseHandCount] = useState(0)
  const [hasRaisedHand, setHasRaisedHand] = useState(false)
  const [raiseHandNotifications, setRaiseHandNotifications] = useState<RaiseHandNotification[]>([])
  const [showSubtitles, setShowSubtitles] = useState(false)
  const [youtubePlayer, setYoutubePlayer] = useState<any>(null)
  const [vimeoPlayer, setVimeoPlayer] = useState<any>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [currentVideoUrl, setCurrentVideoUrl] = useState(session.videoUrl)
  const [currentPlatform, setCurrentPlatform] = useState(session.platform)
  const [soundcloudWidget, setSoundcloudWidget] = useState<any>(null)
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const youtubePlayerRef = useRef<any>(null)
  const vimeoPlayerRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()
  const syncIntervalRef = useRef<NodeJS.Timeout>()
  const theaterSignaling = TheaterSignaling.getInstance()
  const isProgrammaticUpdate = useRef<boolean>(false)
  const callSounds = CallSounds.getInstance()

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

  // Mouse movement handler
  const handleMouseMove = useCallback(() => {
    resetControlsTimeout()
  }, [resetControlsTimeout])

  // Initialize player based on platform
  const initializePlayer = useCallback(async () => {
    if (!session.videoUrl) return

    const platform = session.platform || detectPlatform(session.videoUrl)

    try {
      switch (platform) {
        case "youtube":
          await initializeYouTubePlayer()
          break
        case "vimeo":
          await initializeVimeoPlayer()
          break
        case "soundcloud":
          await initializeSoundCloudPlayer()
          break
        default:
          initializeDirectPlayer()
          break
      }
    } catch (error) {
      console.error("Error initializing player:", error)
    }
  }, [session.videoUrl, session.platform])

  const detectPlatform = (url: string): string => {
    if (url.match(/(youtube\.com|youtu\.be)/)) return "youtube"
    if (url.match(/vimeo\.com/)) return "vimeo"
    if (url.match(/soundcloud\.com/)) return "soundcloud"
    return "direct"
  }

  const extractVideoId = (url: string, platform: string): string => {
    switch (platform) {
      case "youtube":
        const ytRegex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
        const ytMatch = url.match(ytRegex)
        return ytMatch ? ytMatch[1] : ""
      case "vimeo":
        const vimeoRegex = /(?:vimeo\.com\/|video\/)(\d+)/
        const vimeoMatch = url.match(vimeoRegex)
        return vimeoMatch ? vimeoMatch[1] : ""
      default:
        return url
    }
  }

  const initializeYouTubePlayer = async () => {
    const videoId = extractVideoId(session.videoUrl, "youtube")
    if (!videoId) return

    // Load YouTube API if not already loaded
    if (!(window as any).YT) {
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      document.head.appendChild(script)

      await new Promise((resolve) => {
        ;(window as any).onYouTubeIframeAPIReady = resolve
      })
    }

    // Wait for API to be ready
    if (!(window as any).YT || !(window as any).YT.Player) {
      setTimeout(() => initializeYouTubePlayer(), 100)
      return
    }

    try {
      youtubePlayerRef.current = new (window as any).YT.Player("youtube-player", {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          enablejsapi: 1,
        },
        events: {
          onReady: (event: any) => {
            setDuration(event.target.getDuration())
            setPlayerReady(true)
          },
          onStateChange: (event: any) => {
            const state = event.data
            if (state === (window as any).YT.PlayerState.PLAYING) {
              setIsPlaying(true)
              if (isHost) handlePlay(true)
            } else if (state === (window as any).YT.PlayerState.PAUSED) {
              setIsPlaying(false)
              if (isHost) handlePause(true)
            }
          },
        },
      })
    } catch (error) {
      console.error("Error creating YouTube player:", error)
    }
  }

  const initializeVimeoPlayer = async () => {
    const videoId = extractVideoId(session.videoUrl, "vimeo")
    if (!videoId) return

    // Load Vimeo Player API
    if (!(window as any).Vimeo) {
      const script = document.createElement("script")
      script.src = "https://player.vimeo.com/api/player.js"
      document.head.appendChild(script)

      await new Promise((resolve) => {
        script.onload = resolve
      })
    }

    try {
      const iframe = document.getElementById("vimeo-player") as HTMLIFrameElement
      if (iframe) {
        vimeoPlayerRef.current = new (window as any).Vimeo.Player(iframe)

        vimeoPlayerRef.current.on("play", () => {
          if (!isProgrammaticUpdate.current) {
            setIsPlaying(true)
            if (isHost) handlePlay(true)
          }
        })
        vimeoPlayerRef.current.on("pause", () => {
          if (!isProgrammaticUpdate.current) {
            setIsPlaying(false)
            if (isHost) handlePause(true)
          }
        })
        vimeoPlayerRef.current.on("loaded", () => {
          vimeoPlayerRef.current.getDuration().then((duration: number) => {
            setDuration(duration)
            setPlayerReady(true)
          })
        })

        vimeoPlayerRef.current.on("timeupdate", (data: any) => {
          setCurrentTime(data.seconds)
        })
      }
    } catch (error) {
      console.error("Error creating Vimeo player:", error)
    }
  }

  const initializeSoundCloudPlayer = async () => {
    // SoundCloud widget API
    if (!(window as any).SC) {
      const script = document.createElement("script")
      script.src = "https://w.soundcloud.com/player/api.js"
      document.head.appendChild(script)

      await new Promise((resolve) => {
        script.onload = resolve
      })
    }

    try {
      const iframe = document.getElementById("soundcloud-player") as HTMLIFrameElement
      if (iframe && (window as any).SC) {
        const widget = (window as any).SC.Widget(iframe)
        setSoundcloudWidget(widget)

        widget.bind((window as any).SC.Widget.Events.READY, () => {
          setPlayerReady(true)
          widget.getDuration((duration: number) => {
            setDuration(duration / 1000) // Convert to seconds
          })
        })

        widget.bind((window as any).SC.Widget.Events.PLAY, () => {
          if (!isProgrammaticUpdate.current) {
            setIsPlaying(true)
            if (isHost) handlePlay(true)
          }
        })
        widget.bind((window as any).SC.Widget.Events.PAUSE, () => {
          if (!isProgrammaticUpdate.current) {
            setIsPlaying(false)
            if (isHost) handlePause(true)
          }
        })

        widget.bind((window as any).SC.Widget.Events.PLAY_PROGRESS, (data: any) => {
          setCurrentTime(data.currentPosition / 1000) // Convert to seconds
        })
      }
    } catch (error) {
      console.error("Error initializing SoundCloud player:", error)
    }
  }

  const initializeDirectPlayer = () => {
    const video = videoRef.current
    if (!video) return

    video.src = session.videoUrl

    // Defined handlers to allow removal if needed, though mostly relying on React unmount
    video.onloadedmetadata = () => {
      setDuration(video.duration)
    }
    video.ontimeupdate = () => {
      setCurrentTime(video.currentTime)
    }
    video.onplay = () => {
      if (!isProgrammaticUpdate.current) {
        setIsPlaying(true)
        if (isHost) handlePlay(true)
      }
    }
    video.onpause = () => {
      if (!isProgrammaticUpdate.current) {
        setIsPlaying(false)
        if (isHost) handlePause(true)
      }
    }
  }

  // Sync with session updates
  useEffect(() => {
    if (session.status === "playing" && !isPlaying) {
      handlePlay(false)
    } else if (session.status === "paused" && isPlaying) {
      handlePause(false)
    }

    const timeDiff = Math.abs(currentTime - session.currentTime)

    // 1. If difference is > 2 seconds, do a hard seek (major drift or late join)
    // 2. If difference is between 0.5 and 2 seconds, use playback rate to catch up smoothly (minor drift)
    // 3. If difference is < 0.5 seconds, do nothing (acceptable jitter)
    if (timeDiff > 2) {
      handleSeek(session.currentTime, false)
    } else if (timeDiff > 0.5 && session.status === "playing") {
      const catchUpRate = currentTime < session.currentTime ? 1.05 : 0.95

      // Apply temporary playback rate
      if (videoRef.current) videoRef.current.playbackRate = catchUpRate
      if (youtubePlayerRef.current?.setPlaybackRate) youtubePlayerRef.current.setPlaybackRate(catchUpRate)
      if (vimeoPlayerRef.current?.setPlaybackRate) vimeoPlayerRef.current.setPlaybackRate(catchUpRate)

      // Reset to normal speed after 1 second
      setTimeout(() => {
        if (videoRef.current) videoRef.current.playbackRate = 1.0
        if (youtubePlayerRef.current?.setPlaybackRate) youtubePlayerRef.current.setPlaybackRate(1.0)
        if (vimeoPlayerRef.current?.setPlaybackRate) vimeoPlayerRef.current.setPlaybackRate(1.0)
      }, 1000)
    }

    if (!session.lastAction) return

    const action = session.lastAction

    // Only sync if action is recent (within 5 seconds)
    if (timeDiff > 5000) return

    // If I am the one who triggered the action, don't re-apply it from the server echo immediately
    if (action.hostId === currentUserId && timeDiff < 1000 && action.type !== "raise_hand") return

    isProgrammaticUpdate.current = true

    switch (action.type) {
      case "play":
        handlePlay(false)
        break
      case "pause":
        handlePause(false)
        break
      case "seek":
        if (action.currentTime !== undefined) {
          handleSeek(action.currentTime, false)
        }
        break
      case "raise_hand":
        handleRaiseHandNotification()
        break
    }

    setTimeout(() => {
      isProgrammaticUpdate.current = false
    }, 500)
  }, [session.lastAction, session.status, session.currentTime])

  // Update queue and raise hands
  useEffect(() => {
    setQueue(session.nextVideos || [])
    setRaiseHandCount(session.raiseHands || 0)
  }, [session.nextVideos, session.raiseHands])

  const handlePlay = async (sendAction = true) => {
    if (!playerReady) return

    if (!sendAction) isProgrammaticUpdate.current = true

    const platform = session.platform || detectPlatform(session.videoUrl)

    try {
      switch (platform) {
        case "youtube":
          if (youtubePlayerRef.current && youtubePlayerRef.current.playVideo) {
            youtubePlayerRef.current.playVideo()
          }
          break
        case "vimeo":
          if (vimeoPlayerRef.current && vimeoPlayerRef.current.play) {
            await vimeoPlayerRef.current.play()
          }
          break
        case "soundcloud":
          if (soundcloudWidget && soundcloudWidget.play) {
            soundcloudWidget.play()
          }
          break
        case "direct":
          if (videoRef.current) {
            await videoRef.current.play()
          }
          break
      }

      setIsPlaying(true)

      if (sendAction && isHost) {
        await theaterSignaling.sendAction(roomId, session.id, "play", currentTime, currentUserId, currentUser)
      }

      if (!sendAction) {
        setTimeout(() => {
          isProgrammaticUpdate.current = false
        }, 500)
      }
    } catch (error) {
      console.error("Error playing video:", error)
    }
  }

  const handlePause = async (sendAction = true) => {
    if (!playerReady) return

    if (!sendAction) isProgrammaticUpdate.current = true

    const platform = session.platform || detectPlatform(session.videoUrl)

    try {
      switch (platform) {
        case "youtube":
          if (youtubePlayerRef.current && youtubePlayerRef.current.pauseVideo) {
            youtubePlayerRef.current.pauseVideo()
          }
          break
        case "vimeo":
          if (vimeoPlayerRef.current && vimeoPlayerRef.current.pause) {
            await vimeoPlayerRef.current.pause()
          }
          break
        case "soundcloud":
          if (soundcloudWidget && soundcloudWidget.pause) {
            soundcloudWidget.pause()
          }
          break
        case "direct":
          if (videoRef.current) {
            videoRef.current.pause()
          }
          break
      }

      setIsPlaying(false)

      if (sendAction && isHost) {
        await theaterSignaling.sendAction(roomId, session.id, "pause", currentTime, currentUserId, currentUser)
      }

      if (!sendAction) {
        setTimeout(() => {
          isProgrammaticUpdate.current = false
        }, 500)
      }
    } catch (error) {
      console.error("Error pausing video:", error)
    }
  }

  const handleSeek = async (time: number, sendAction = true) => {
    if (!sendAction) isProgrammaticUpdate.current = true

    const platform = session.platform || detectPlatform(session.videoUrl)

    switch (platform) {
      case "youtube":
        youtubePlayerRef.current?.seekTo(time)
        break
      case "vimeo":
        vimeoPlayerRef.current?.setCurrentTime(time)
        break
      case "soundcloud":
        if (soundcloudWidget && soundcloudWidget.seekTo) {
          soundcloudWidget.seekTo(time * 1000) // Convert to milliseconds
        }
        break
      case "direct":
        if (videoRef.current) {
          videoRef.current.currentTime = time
        }
        break
    }

    setCurrentTime(time)

    if (sendAction && isHost) {
      await theaterSignaling.sendAction(roomId, session.id, "seek", time, currentUserId, currentUser)
    }

    if (!sendAction) {
      setTimeout(() => {
        isProgrammaticUpdate.current = false
      }, 500)
    }
  }

  const handleVolumeChange = (newVolume: number[]) => {
    const vol = newVolume[0]
    setVolume(vol)
    setIsMuted(vol === 0)

    const platform = session.platform || detectPlatform(session.videoUrl)

    switch (platform) {
      case "youtube":
        youtubePlayerRef.current?.setVolume(vol * 100)
        break
      case "vimeo":
        vimeoPlayerRef.current?.setVolume(vol)
        break
      case "soundcloud":
        if (soundcloudWidget && soundcloudWidget.setVolume) {
          soundcloudWidget.setVolume(vol * 100) // SoundCloud expects 0-100
        }
        break
      case "direct":
        if (videoRef.current) {
          videoRef.current.volume = vol
        }
        break
    }
  }

  const handleMute = () => {
    const newMuted = !isMuted
    setIsMuted(newMuted)

    const platform = session.platform || detectPlatform(session.videoUrl)

    switch (platform) {
      case "youtube":
        if (newMuted) {
          youtubePlayerRef.current?.mute()
        } else {
          youtubePlayerRef.current?.unMute()
        }
        break
      case "vimeo":
        vimeoPlayerRef.current?.setVolume(newMuted ? 0 : volume)
        break
      case "soundcloud":
        if (soundcloudWidget && soundcloudWidget.setVolume) {
          soundcloudWidget.setVolume(newMuted ? 0 : volume * 100)
        }
        break
      case "direct":
        if (videoRef.current) {
          videoRef.current.muted = newMuted
        }
        break
    }
  }

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current
        ?.requestFullscreen()
        .then(() => {
          setIsFullscreen(true)
        })
        .catch((err) => {
          console.error("Error attempting to enable fullscreen:", err)
        })
    } else {
      document
        .exitFullscreen()
        .then(() => {
          setIsFullscreen(false)
        })
        .catch((err) => {
          console.error("Error attempting to exit fullscreen:", err)
        })
    }
  }

  const handleRaiseHand = async () => {
    await theaterSignaling.sendAction(roomId, session.id, "raise_hand", currentTime, currentUserId, currentUser)
  }

  const handleRaiseHandNotification = () => {
    const message = isPlaying ? "STOP" : "CONTINUE"
    setNotificationMessage(message)
    callSounds.playBeep()

    // Hide notification after 2 seconds
    setTimeout(() => {
      setNotificationMessage(null)
    }, 2000)
  }

  const handleAddToQueue = async () => {
    if (!newVideoUrl.trim() || queue.length >= 3) return

    const platform = detectPlatform(newVideoUrl)
    const newVideo: QueueVideo = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url: newVideoUrl,
      platform,
      title: `${platform.charAt(0).toUpperCase() + platform.slice(1)} Video`,
      addedBy: currentUser,
      addedAt: Date.now(),
    }

    const updatedQueue = [...queue, newVideo]
    await theaterSignaling.sendAction(
      roomId,
      session.id,
      "update_queue",
      currentTime,
      currentUserId,
      currentUser,
      updatedQueue,
    )

    setNewVideoUrl("")
  }

  const handleRemoveFromQueue = async (videoId: string) => {
    if (!isHost) return

    const updatedQueue = (queue || []).filter((video) => video.id !== videoId)
    await theaterSignaling.sendAction(
      roomId,
      session.id,
      "update_queue",
      currentTime,
      currentUserId,
      currentUser,
      updatedQueue,
    )
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "youtube":
        return <Youtube className="w-4 h-4 text-red-500" />
      case "vimeo":
        return <VideoIcon className="w-4 h-4 text-blue-500" />
      case "soundcloud":
        return <Music className="w-4 h-4 text-orange-500" />
      default:
        return <Film className="w-4 h-4 text-green-500" />
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const copyRoomLink = () => {
    const roomLink = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`
    navigator.clipboard.writeText(roomLink).then(() => {
      // Show notification
    })
  }

  // Initialize player on mount
  useEffect(() => {
    if (isOpen && session.videoUrl) {
      const initPlayer = async () => {
        setPlayerReady(false)

        if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
          try {
            youtubePlayerRef.current.destroy()
          } catch (e) {}
          youtubePlayerRef.current = null
        }
        if (vimeoPlayerRef.current && vimeoPlayerRef.current.destroy) {
          try {
            vimeoPlayerRef.current.destroy()
          } catch (e) {}
          vimeoPlayerRef.current = null
        }

        await initializePlayer()
        setPlayerReady(true)
      }
      initPlayer()
    }

    return () => {
      // Cleanup players
      if (youtubePlayerRef.current && youtubePlayerRef.current.destroy) {
        try {
          youtubePlayerRef.current.destroy()
        } catch (e) {}
        youtubePlayerRef.current = null
      }
      if (vimeoPlayerRef.current && vimeoPlayerRef.current.destroy) {
        try {
          vimeoPlayerRef.current.destroy()
        } catch (e) {}
        vimeoPlayerRef.current = null
      }
      if (soundcloudWidget) {
        setSoundcloudWidget(null)
      }
    }
  }, [isOpen, session.videoUrl])

  // Set up mouse move listener
  useEffect(() => {
    if (isOpen) {
      resetControlsTimeout()
      document.addEventListener("mousemove", handleMouseMove)
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        if (controlsTimeoutRef.current) {
          clearTimeout(controlsTimeoutRef.current)
        }
      }
    }
  }, [isOpen, handleMouseMove, resetControlsTimeout])

  // Add fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
    }
  }, [])

  if (!isOpen) return null

  const platform = session.platform || detectPlatform(session.videoUrl)
  const videoId = extractVideoId(session.videoUrl, platform)

  return (
    <div
      ref={containerRef}
      className={`fixed inset-0 z-[100] bg-black flex flex-col ${isFullscreen ? "w-screen h-screen" : ""}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {/* Platform Players */}
        <div
          className={`relative w-full bg-black/50 backdrop-blur-sm overflow-hidden ${
            isFullscreen
              ? "h-full w-full rounded-none border-none"
              : "max-w-6xl mx-auto rounded-2xl shadow-2xl border border-white/10"
          }`}
        >
          {/* Video Player */}
          <div className={`relative bg-black ${isFullscreen ? "w-full h-full" : "aspect-video"}`}>
            {platform === "youtube" && <div id="youtube-player" className="w-full h-full" />}

            {platform === "vimeo" && (
              <iframe
                id="vimeo-player"
                src={`https://player.vimeo.com/video/${videoId}?background=1&autoplay=0&loop=0&byline=0&title=0&portrait=0&controls=0`}
                className="w-full h-full"
                frameBorder="0"
                allow="autoplay; fullscreen"
              />
            )}

            {platform === "soundcloud" && (
              <iframe
                id="soundcloud-player"
                src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(session.videoUrl)}&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=true&enable_api=true`}
                className="w-full h-full"
                frameBorder="0"
                allow="autoplay"
              />
            )}

            {platform === "direct" && (
              <video ref={videoRef} className="w-full h-full object-contain" controls={false} />
            )}
          </div>

          {/* Controls Overlay */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 transition-opacity duration-300 ${
              showControls ? "opacity-100" : "opacity-0"
            }`}
          >
            {/* Top Controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
              <div className="flex items-center gap-4 text-white">
                <div className="flex items-center gap-2">
                  {getPlatformIcon(platform)}
                  <span className="text-sm font-medium">{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Users className="w-5 h-5" />
                  <span className="text-sm">
                    {Array.isArray(session.participants) ? session.participants.length : 1}
                  </span>
                </div>
                {queue.length > 0 && (
                  <div className="flex items-center gap-1">
                    <List className="w-4 h-4" />
                    <span className="text-sm">Queue: {queue.length}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Raise Hand Button - moved to controls section */}
                <Button
                  onClick={handleRaiseHand}
                  className="bg-yellow-500/80 hover:bg-yellow-500 text-black backdrop-blur-sm"
                  size="sm"
                >
                  <Hand className="w-5 h-5 text-white" />
                  <span className="sr-only">Raise Hand</span>
                </Button>

                <Button
                  onClick={() => setShowSettings(!showSettings)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setShowQueue(!showQueue)}
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20"
                >
                  <List className="w-6 h-6" />
                </Button>
                <Button onClick={handleFullscreen} variant="ghost" size="sm" className="text-white hover:bg-white/20">
                  <Maximize className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
                  <X className="w-6 h-6" />
                </Button>
              </div>
            </div>

            {/* Bottom Controls */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
              {/* Progress Bar */}
              <div className="mb-4">
                <Slider
                  value={[currentTime]}
                  max={duration}
                  step={1}
                  onValueChange={(value) => isHost && handleSeek(value[0])}
                  className="w-full"
                  disabled={!isHost}
                />
                <div className="flex justify-between text-xs text-white/70 mt-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-center gap-4">
                {isHost ? (
                  <Button
                    onClick={() => (isPlaying ? handlePause() : handlePlay())}
                    className="bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm"
                    size="lg"
                  >
                    {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                  </Button>
                ) : (
                  <div className="text-white/70 text-sm">
                    {isPlaying ? "Playing" : "Paused"} • Host controls playback
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button onClick={handleMute} variant="ghost" size="sm" className="text-white hover:bg-white/20">
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
            </div>
          </div>
        </div>

        {/* Queue Sidebar */}
        {showQueue && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-80 bg-black/80 backdrop-blur-sm rounded-xl p-4 border border-white/10">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <List className="w-4 h-4" />
              Queue ({queue.length}/3)
            </h3>

            {/* Add to Queue */}
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
                  size="sm"
                  className="bg-purple-500 hover:bg-purple-600"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Queue List */}
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {queue.map((video, index) => (
                <div key={video.id} className="flex items-center gap-3 p-2 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    {getPlatformIcon(video.platform)}
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm truncate">{video.title}</div>
                      <div className="text-white/50 text-xs">Added by {video.addedBy}</div>
                    </div>
                  </div>
                  {isHost && (
                    <Button
                      onClick={() => handleRemoveFromQueue(video.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              ))}
              {queue.length === 0 && <div className="text-white/50 text-center py-4">No videos in queue</div>}
            </div>
          </div>
        )}
      </div>

      {notificationMessage && (
        <div className="absolute inset-0 flex items-center justify-center z-[60] pointer-events-none">
          <div className="bg-black/80 text-white px-8 py-4 rounded-xl border border-white/20 backdrop-blur-sm animate-in fade-in zoom-in duration-200">
            <h2 className="text-4xl font-bold tracking-widest">{notificationMessage}</h2>
          </div>
        </div>
      )}
    </div>
  )
}
