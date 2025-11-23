"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Music, ImageIcon, RotateCcw, Save } from "lucide-react"

export interface MoodConfig {
  backgroundImage?: string
  musicUrls: string[]
  loop: boolean
}

interface MoodModalProps {
  isOpen: boolean
  onClose: () => void
  currentMood: MoodConfig | null
  onSave: (mood: MoodConfig | null) => void
}

export function MoodModal({ isOpen, onClose, currentMood, onSave }: MoodModalProps) {
  const [backgroundImage, setBackgroundImage] = useState("")
  const [musicUrls, setMusicUrls] = useState<string[]>(["", "", "", "", ""])
  const [loop, setLoop] = useState(false)

  useEffect(() => {
    if (isOpen && currentMood) {
      setBackgroundImage(currentMood.backgroundImage || "")
      // Ensure we always have 5 slots
      const urls = [...(currentMood.musicUrls || [])]
      while (urls.length < 5) urls.push("")
      setMusicUrls(urls.slice(0, 5))
      setLoop(currentMood.loop || false)
    } else if (isOpen) {
      // Default / Reset state when opening without existing mood
      setBackgroundImage("")
      setMusicUrls(["", "", "", "", ""])
      setLoop(false)
    }
  }, [isOpen, currentMood])

  const handleMusicUrlChange = (index: number, value: string) => {
    const newUrls = [...musicUrls]
    newUrls[index] = value
    setMusicUrls(newUrls)
  }

  const handleSave = () => {
    const cleanMusicUrls = musicUrls.filter((url) => url.trim() !== "")

    // If everything is empty, save as null (reset)
    if (!backgroundImage.trim() && cleanMusicUrls.length === 0) {
      onSave(null)
    } else {
      onSave({
        backgroundImage: backgroundImage.trim(),
        musicUrls: cleanMusicUrls,
        loop,
      })
    }
    onClose()
  }

  const handleReset = () => {
    setBackgroundImage("")
    setMusicUrls(["", "", "", "", ""])
    setLoop(false)
    onSave(null) // Immediately reset
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-slate-900 border-slate-700 text-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2 text-cyan-400">
            <Music className="w-5 h-5" />
            Set Room Mood
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Background Image Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-lg font-medium">
              <ImageIcon className="w-5 h-5 text-cyan-400" />
              Background Theme
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bg-image">Image or GIF URL</Label>
              <Input
                id="bg-image"
                value={backgroundImage}
                onChange={(e) => setBackgroundImage(e.target.value)}
                placeholder="https://example.com/background.gif"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
              <p className="text-xs text-slate-400">Supports direct links to images (.jpg, .png) or animated GIFs.</p>
            </div>
          </div>

          {/* Music Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-lg font-medium">
                <Music className="w-5 h-5 text-cyan-400" />
                Background Music
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="loop-music" className="cursor-pointer">
                  Loop Playlist
                </Label>
                <Switch
                  id="loop-music"
                  checked={loop}
                  onCheckedChange={setLoop}
                  className="data-[state=checked]:bg-cyan-500"
                />
              </div>
            </div>

            <div className="grid gap-3">
              {musicUrls.map((url, index) => (
                <div key={index} className="grid gap-1">
                  <Label htmlFor={`music-${index}`} className="text-xs text-slate-400">
                    Track {index + 1}
                  </Label>
                  <Input
                    id={`music-${index}`}
                    value={url}
                    onChange={(e) => handleMusicUrlChange(index, e.target.value)}
                    placeholder="https://example.com/song.mp3"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              ))}
              <p className="text-xs text-slate-400">
                Supports direct audio links (mp3, wav). YouTube links may not work directly.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="destructive" onClick={handleReset} className="mr-auto">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="bg-transparent border-slate-600 hover:bg-slate-800 text-white"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} className="bg-cyan-500 hover:bg-cyan-600 text-white">
            <Save className="w-4 h-4 mr-2" />
            Save Mood
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
