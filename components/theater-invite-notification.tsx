"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Film, Check, X } from "lucide-react"
import type { TheaterInvite } from "@/utils/theater-signaling"

interface TheaterInviteNotificationProps {
  invite: TheaterInvite
  onAccept: () => void
  onDecline: () => void
}

export function TheaterInviteNotification({ invite, onAccept, onDecline }: TheaterInviteNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Auto-hide after 30 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      onDecline()
    }, 30000)

    return () => clearTimeout(timer)
  }, [onDecline])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-right-full max-w-sm">
      <div className="flex items-start gap-3">
        {/* Theater Icon */}
        <div className="w-12 h-12 rounded-full border-2 border-purple-400 flex items-center justify-center bg-slate-700 animate-pulse flex-shrink-0">
          <Film className="w-6 h-6 text-purple-400" />
        </div>

        {/* Invite Info */}
        <div className="flex-1 min-w-0">
          <div className="text-white font-medium">{invite.host}</div>
          <div className="text-gray-400 text-sm">invited you to watch</div>
          <div className="text-cyan-400 text-sm font-medium truncate">{invite.videoTitle}</div>
          <div className="text-gray-500 text-xs mt-1">Movie Theater Session</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-4">
        <Button
          variant="ghost"
          size="sm"
          className="flex-1 bg-green-500 hover:bg-green-600 text-white"
          onClick={onAccept}
        >
          <Check className="w-4 h-4 mr-2" />
          Join
        </Button>
        <Button variant="ghost" size="sm" className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={onDecline}>
          <X className="w-4 h-4 mr-2" />
          Decline
        </Button>
      </div>
    </div>
  )
}
