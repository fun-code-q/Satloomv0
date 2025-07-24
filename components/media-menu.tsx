"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Mic, Video, Camera, Plus } from "lucide-react"

interface MediaMenuProps {
  onSelectMedia: (mode: "audio" | "video" | "photo") => void
}

export function MediaMenu({ onSelectMedia }: MediaMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleSelect = (mode: "audio" | "video" | "photo") => {
    onSelectMedia(mode)
    setIsOpen(false)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-slate-700">
          <Plus className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="bg-slate-800 border-slate-700 text-white" sideOffset={5}>
        <DropdownMenuItem onClick={() => handleSelect("audio")} className="hover:bg-slate-700 cursor-pointer">
          <Mic className="w-4 h-4 mr-3" />
          Record Audio
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSelect("video")} className="hover:bg-slate-700 cursor-pointer">
          <Video className="w-4 h-4 mr-3" />
          Record Video
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSelect("photo")} className="hover:bg-slate-700 cursor-pointer">
          <Camera className="w-4 h-4 mr-3" />
          Take Photo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
