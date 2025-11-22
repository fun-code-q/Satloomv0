"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Phone, PhoneOff, User } from "lucide-react"
import type { CallData } from "@/utils/call-signaling"
import { CallSounds } from "@/utils/call-sounds"

interface IncomingCallNotificationProps {
  call: CallData
  onAnswer: () => void
  onDecline: () => void
}

export function IncomingCallNotification({ call, onAnswer, onDecline }: IncomingCallNotificationProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Play ringtone when component mounts
    CallSounds.getInstance().playRingtone()

    // Auto-hide after 30 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      onDecline()
    }, 30000)

    return () => {
      clearTimeout(timer)
      // Stop ringtone when component unmounts (answered, declined, or timed out)
      CallSounds.getInstance().stopAll()
    }
  }, [onDecline])

  if (!isVisible) return null

  return (
    <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-right-full">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full border-2 border-cyan-400 flex items-center justify-center bg-slate-700 animate-pulse">
          <User className="w-6 h-6 text-gray-400" />
        </div>

        {/* Call info */}
        <div className="flex-1">
          <div className="text-white font-medium">{call.caller}</div>
          <div className="text-gray-400 text-sm">Incoming audio call...</div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-full bg-green-500 hover:bg-green-600"
            onClick={onAnswer}
          >
            <Phone className="w-5 h-5 text-white" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-full bg-red-500 hover:bg-red-600"
            onClick={onDecline}
          >
            <PhoneOff className="w-5 h-5 text-white" />
          </Button>
        </div>
      </div>
    </div>
  )
}
