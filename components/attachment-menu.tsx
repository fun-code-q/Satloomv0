"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { ImageIcon, Video, FileText, Mic, MapPin, User, Paperclip } from "lucide-react"

interface AttachmentMenuProps {
  onFileSelect: (type: string, file?: File) => void
}

export function AttachmentMenu({ onFileSelect }: AttachmentMenuProps) {
  const [isOpen, setIsOpen] = useState(false)

  const attachmentOptions = [
    {
      icon: ImageIcon,
      label: "Photo",
      type: "photo",
      accept: "image/*",
      action: () => triggerFileInput("image/*", "photo"),
    },
    {
      icon: Video,
      label: "Video",
      type: "video",
      accept: "video/*",
      action: () => triggerFileInput("video/*", "video"),
    },
    {
      icon: FileText,
      label: "Document",
      type: "document",
      accept: ".pdf,.doc,.docx,.txt,.xlsx,.pptx",
      action: () => triggerFileInput(".pdf,.doc,.docx,.txt,.xlsx,.pptx", "document"),
    },
    {
      icon: Mic,
      label: "Audio",
      type: "audio",
      accept: "audio/*",
      action: () => triggerFileInput("audio/*", "audio"),
    },
    {
      icon: MapPin,
      label: "Location",
      type: "location",
      action: () => shareLocation(),
    },
    {
      icon: User,
      label: "Contact",
      type: "contact",
      action: () => shareContact(),
    },
  ]

  const triggerFileInput = (accept: string, type: string) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = accept
    input.multiple = type !== "document" // Allow multiple files except for documents

    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files) {
        Array.from(files).forEach((file) => {
          onFileSelect(type, file)
        })
      }
    }
    input.click()
    setIsOpen(false)
  }

  const shareLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          }
          onFileSelect("location", location as any)
        },
        (error) => {
          console.error("Error getting location:", error)
          alert("Could not get location. Please check your location permissions.")
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        },
      )
    } else {
      alert("Geolocation is not supported by this browser")
    }
    setIsOpen(false)
  }

  const shareContact = async () => {
    try {
      // Check if Contact Picker API is supported
      if ("contacts" in navigator && "ContactsManager" in window) {
        const contacts = await (navigator as any).contacts.select(["name", "tel", "email"], { multiple: false })
        if (contacts.length > 0) {
          const contact = contacts[0]
          onFileSelect("contact", {
            name: contact.name?.[0] || "Unknown",
            phone: contact.tel?.[0] || "",
            email: contact.email?.[0] || "",
          } as any)
        }
      } else {
        // Fallback: Create a sample contact or show input dialog
        const name = prompt("Enter contact name:")
        const phone = prompt("Enter phone number:")
        if (name && phone) {
          onFileSelect("contact", {
            name,
            phone,
            email: "",
          } as any)
        }
      }
    } catch (error) {
      console.error("Error accessing contacts:", error)
      alert("Could not access contacts. Please check your permissions.")
    }
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="text-gray-400 hover:text-white hover:bg-slate-700"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Paperclip className="w-4 h-4" />
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Attachment Menu */}
          <div className="absolute bottom-12 left-0 z-50 bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-2xl p-4 shadow-2xl">
            <div className="grid grid-cols-3 gap-4 w-64">
              {attachmentOptions.map((option, index) => (
                <button
                  key={index}
                  onClick={option.action}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-slate-700/50 transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-cyan-500 flex items-center justify-center group-hover:bg-cyan-400 transition-colors">
                    <option.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-white text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
