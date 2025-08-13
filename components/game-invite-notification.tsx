"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Gamepad2, Users, X, Clock } from "lucide-react"

interface GameInvite {
  id: string
  roomId: string
  hostId: string
  hostName: string
  gameConfig: any
  timestamp: number
  status?: "active" | "expired" | "full"
}

interface GameInviteNotificationProps {
  invite: GameInvite
  onAccept: () => void
  onDecline: () => void
}

export function GameInviteNotification({ invite, onAccept, onDecline }: GameInviteNotificationProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleAccept = async () => {
    setIsLoading(true)
    try {
      await onAccept()
    } finally {
      setIsLoading(false)
    }
  }

  const handleDecline = async () => {
    setIsLoading(true)
    try {
      await onDecline()
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)

    if (minutes < 1) return "just now"
    if (minutes === 1) return "1 minute ago"
    return `${minutes} minutes ago`
  }

  const getGameModeText = () => {
    if (!invite.gameConfig) return "Game"

    const config = invite.gameConfig
    if (config.mode === "single") {
      return "Single Player Game"
    } else {
      const aiCount = config.players?.filter((p: any) => p.isAI).length || 0
      const humanCount = (config.players?.length || 0) - aiCount

      if (aiCount === 0) {
        return "Multiplayer Game"
      } else if (humanCount === 1) {
        return `vs ${aiCount} AI`
      } else {
        return `${humanCount} Players + ${aiCount} AI`
      }
    }
  }

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right-5">
      <Card className="w-80 bg-slate-800 border-slate-700 shadow-xl">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-cyan-500/20 rounded-full flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Game Invitation</h3>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(invite.timestamp)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={handleDecline}
              disabled={isLoading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-sm text-gray-300">
              <span className="font-medium text-cyan-400">{invite.hostName}</span> invited you to join a game
            </p>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Users className="w-3 h-3" />
              <span>{getGameModeText()}</span>
            </div>

            {invite.gameConfig && (
              <div className="text-xs text-gray-400">
                Grid: {invite.gameConfig.gridSize}x{invite.gameConfig.gridSize}
                {invite.gameConfig.voiceChatEnabled && " • Voice Chat"}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleDecline}
              variant="outline"
              size="sm"
              className="flex-1 border-slate-600 text-gray-300 hover:bg-slate-700 bg-transparent"
              disabled={isLoading}
            >
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              size="sm"
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? "Joining..." : "Join Game"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
