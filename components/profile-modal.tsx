"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { User, Upload } from "lucide-react"

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (profile: { name: string; avatar?: string }) => void
  defaultProfile?: { name: string; avatar?: string }
}

export function ProfileModal({ isOpen, onClose, onSave, defaultProfile }: ProfileModalProps) {
  const [name, setName] = useState(defaultProfile?.name || `User-${Math.floor(Math.random() * 1000)}`)
  const [avatar, setAvatar] = useState<string | undefined>(defaultProfile?.avatar)

  useEffect(() => {
    if (defaultProfile) {
      setName(defaultProfile.name || `User-${Math.floor(Math.random() * 1000)}`)
      setAvatar(defaultProfile.avatar)
    }
  }, [defaultProfile])

  const handleSave = () => {
    if (!name.trim()) {
      alert("Please enter a name")
      return
    }
    onSave({ name: name.trim(), avatar })
    onClose()
  }

  const handleSkip = () => {
    if (!name.trim()) {
      setName(`User-${Math.floor(Math.random() * 1000)}`)
    }
    onSave({ name: name.trim() })
    onClose()
  }

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith("image/")) {
        alert("Please select an image file")
        return
      }

      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert("File size must be less than 5MB")
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const result = e.target?.result as string
        if (result) {
          setAvatar(result)
        }
      }
      reader.onerror = () => {
        alert("Error reading file. Please try again.")
      }
      reader.readAsDataURL(file)
    }
  }

  const triggerFileUpload = () => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "image/*"
    input.onchange = handleAvatarUpload
    input.click()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-cyan-400 flex items-center justify-center gap-2">
            <User className="w-5 h-5" />
            Set Up Your Profile
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center space-y-6 py-4">
          <div className="relative">
            <div className="w-24 h-24 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-slate-700 overflow-hidden">
              {avatar ? (
                <img
                  src={avatar || "/placeholder.svg"}
                  alt="Avatar preview"
                  className="w-full h-full object-cover"
                  onError={() => {
                    console.error("Error loading avatar image")
                    setAvatar(undefined)
                  }}
                />
              ) : (
                <User className="w-12 h-12 text-gray-400" />
              )}
            </div>
            {avatar && (
              <button
                onClick={() => setAvatar(undefined)}
                className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white text-xs"
                title="Remove photo"
              >
                ×
              </button>
            )}
          </div>

          <Button
            variant="outline"
            className="border-slate-600 text-white hover:bg-slate-700 bg-transparent"
            onClick={triggerFileUpload}
            type="button"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Photo
          </Button>

          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-slate-700 border-slate-600 text-white"
            placeholder="Enter your name"
            maxLength={50}
          />

          <div className="flex gap-4">
            <Button onClick={handleSave} className="bg-cyan-500 hover:bg-cyan-600">
              Save
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-700 bg-transparent"
            >
               Skip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
