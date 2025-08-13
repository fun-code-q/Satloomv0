"use client"

import { Button } from "@/components/ui/button"
import { Gamepad2, X } from "lucide-react"

interface GameInvite {
  id: string
  roomId: string
  hostId: string
  hostName: string
  gameConfig: {
    gameType: string
    difficulty?: string
  }
  timestamp: number
}

interface GameInviteNotificationProps {
  invite: GameInvite
  onAccept: () => void
  onDecline: () => void
}

export function GameInviteNotification({ invite, onAccept, onDecline }: GameInviteNotificationProps) {
  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds} seconds ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
    return "Over an hour ago"
  }

  return (
    <div
      className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl max-w-sm animate-in slide-in-from-right-5"
      role="alert"
      aria-label="Game invitation"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Gamepad2 className="w-6 h-6 text-purple-400" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-white font-semibold mb-1">Game Invitation</h3>
          <p className="text-gray-300 text-sm mb-1">
            <span className="font-medium text-purple-400">{invite.hostName}</span> invited you to play{" "}
            <span className="font-medium">{invite.gameConfig.gameType}</span>
            {invite.gameConfig.difficulty && (
              <>
                {" "}
                on <span className="font-medium">{invite.gameConfig.difficulty}</span> difficulty
              </>
            )}
          </p>
          <p className="text-gray-400 text-xs mb-3">{formatTimeAgo(invite.timestamp)}</p>

          <div className="flex gap-2">
            <Button
              onClick={onAccept}
              size="sm"
              className="bg-purple-500 hover:bg-purple-600 text-white flex-1"
              aria-label="Join game"
            >
              Join Game
            </Button>
            <Button
              onClick={onDecline}
              variant="outline"
              size="sm"
              className="border-slate-600 text-gray-300 bg-transparent hover:bg-slate-700 hover:text-white"
              aria-label="Decline invitation"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
