"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { X, Film, Youtube, Music, Video } from "lucide-react"

interface TheaterSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateSession: (videoUrl: string, videoType: "direct" | "youtube" | "vimeo" | "soundcloud") => void
}

export function TheaterSetupModal({ isOpen, onClose, onCreateSession }: TheaterSetupModalProps) {
  const [videoUrl, setVideoUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  if (!isOpen) return null

  // Auto-detect platform from URL
  const detectPlatform = (url: string): "direct" | "youtube" | "vimeo" | "soundcloud" => {
    if (url.match(/(youtube\.com|youtu\.be)/)) return "youtube"
    if (url.match(/vimeo\.com/)) return "vimeo"
    if (url.match(/soundcloud\.com/)) return "soundcloud"
    return "direct"
  }

  const validateUrl = (url: string): boolean => {
    if (!url.trim()) return false

    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  const handleCreateSession = async () => {
    if (!validateUrl(videoUrl)) {
      alert("Please enter a valid URL")
      return
    }

    setIsLoading(true)
    try {
      const platform = detectPlatform(videoUrl)
      await onCreateSession(videoUrl, platform)
      setVideoUrl("")
      onClose()
    } catch (error) {
      console.error("Error creating theater session:", error)
      alert("Failed to create theater session")
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleCreateSession()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
              <Film className="w-5 h-5 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Movie Theater</h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <Label htmlFor="video-url" className="text-white mb-2 block">
              Video URL
            </Label>
            <Input
              id="video-url"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Paste video URL here..."
              className="bg-slate-700 border-slate-600 text-white placeholder-gray-400"
              disabled={isLoading}
            />
          </div>

          {/* Supported Platforms Footer */}
          <div className="bg-slate-700/50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-2">Supported platforms:</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Youtube className="w-4 h-4 text-red-500" />
                <span className="text-xs text-gray-300">YouTube</span>
              </div>
              <div className="flex items-center gap-1">
                <Video className="w-4 h-4 text-blue-500" />
                <span className="text-xs text-gray-300">Vimeo</span>
              </div>
              <div className="flex items-center gap-1">
                <Music className="w-4 h-4 text-orange-500" />
                <span className="text-xs text-gray-300">SoundCloud</span>
              </div>
              <div className="flex items-center gap-1">
                <Film className="w-4 h-4 text-green-500" />
                <span className="text-xs text-gray-300">Direct Media</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 border-slate-600 text-white hover:bg-slate-700 bg-transparent"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white"
              disabled={!validateUrl(videoUrl) || isLoading}
            >
              {isLoading ? "Creating..." : "Start Theater"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
