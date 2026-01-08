"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Film, Play, Youtube, Video } from "lucide-react"

interface TheaterSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateSession: (videoUrl: string, videoType: "direct" | "youtube" | "vimeo") => void
}

export function TheaterSetupModal({ isOpen, onClose, onCreateSession }: TheaterSetupModalProps) {
  const [videoUrl, setVideoUrl] = useState("")
  const [selectedType, setSelectedType] = useState<"direct" | "youtube" | "vimeo">("direct")
  const [isLoading, setIsLoading] = useState(false)

  const videoTypes = [
    {
      id: "direct" as const,
      label: "Direct Video",
      icon: Video,
      description: "MP4, WebM files",
    },
    {
      id: "youtube" as const,
      label: "YouTube",
      icon: Youtube,
      description: "YouTube videos",
    },
    {
      id: "vimeo" as const,
      label: "Vimeo",
      icon: Play,
      description: "Vimeo videos",
    },
  ]

  const handleLoadVideo = async () => {
    if (!videoUrl.trim()) return

    setIsLoading(true)
    try {
      // Validate URL based on type
      let processedUrl = videoUrl.trim()

      if (selectedType === "youtube") {
        // Convert YouTube URL to embed format
        const youtubeRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/
        const match = processedUrl.match(youtubeRegex)
        if (match) {
          processedUrl = `https://www.youtube.com/embed/${match[1]}?enablejsapi=1&origin=${window.location.origin}`
        }
      } else if (selectedType === "vimeo") {
        // Convert Vimeo URL to embed format
        const vimeoRegex = /vimeo\.com\/(\d+)/
        const match = processedUrl.match(vimeoRegex)
        if (match) {
          processedUrl = `https://player.vimeo.com/video/${match[1]}?api=1`
        }
      }

      onCreateSession(processedUrl, selectedType)
      onClose()
      setVideoUrl("")
    } catch (error) {
      console.error("Error loading video:", error)
      alert("Error loading video. Please check the URL and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setVideoUrl("")
    setSelectedType("direct")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-cyan-400 flex items-center justify-center gap-2">
            <Film className="w-5 h-5" />
            Select a Video
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Video Type Selection */}
          <div className="flex gap-2">
            {videoTypes.map((type) => (
              <Button
                key={type.id}
                variant={selectedType === type.id ? "default" : "outline"}
                className={`flex-1 h-auto p-3 flex flex-col gap-1 ${
                  selectedType === type.id
                    ? "bg-cyan-500 hover:bg-cyan-600"
                    : "border-slate-600 hover:bg-slate-700 bg-transparent"
                }`}
                onClick={() => setSelectedType(type.id)}
              >
                <type.icon className="w-4 h-4" />
                <span className="text-xs font-medium">{type.label}</span>
              </Button>
            ))}
          </div>

          {/* URL Input */}
          <div className="space-y-2">
            <Input
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder={
                selectedType === "direct"
                  ? "Paste direct video URL (MP4, WebM)"
                  : selectedType === "youtube"
                    ? "Paste YouTube URL"
                    : "Paste Vimeo URL"
              }
              className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
            />

            <p className="text-xs text-gray-400">Note: Video must be served with proper CORS headers</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center pt-4">
            <Button
              onClick={handleLoadVideo}
              disabled={!videoUrl.trim() || isLoading}
              className="bg-cyan-500 hover:bg-cyan-600 px-8"
            >
              <Film className="w-4 h-4 mr-2" />
              {isLoading ? "Loading..." : "Load Video"}
            </Button>
            <Button
              onClick={handleClose}
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-700 bg-transparent px-8"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
