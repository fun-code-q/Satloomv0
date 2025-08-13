"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Gamepad2, Users, Clock, X } from "lucide-react"
import { useState } from "react"

interface GameInvite {
  id: string
  roomId: string
  hostId: string
  hostName: string
  gameConfig: {
    gameType: string
    difficulty?: string
    maxPlayers?: number
    players?: Array<{
      name: string
      isAI?: boolean
    }>
  }
  timestamp: number
  status?: "active" | "expired" | "full"
}

interface GameInviteNotificationProps {
  invite: GameInvite
  onAccept: () => void
  onDecline: () => void
}

export function GameInviteNotification({ invite, onAccept, onDecline }: GameInviteNotificationProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds} seconds ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
    return "Over an hour ago"
  }

  const getGameTypeDisplay = (gameType: string) => {
    switch (gameType) {
      case "dots-and-boxes":
        return "Dots & Boxes"
      case "tic-tac-toe":
        return "Tic Tac Toe"
      case "chess":
        return "Chess"
      default:
        return gameType.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())
    }
  }

  const getPlayerInfo = () => {
    if (!invite.gameConfig.players) return "Multiplayer"

    const humanPlayers = invite.gameConfig.players.filter((p) => !p.isAI)
    const aiPlayers = invite.gameConfig.players.filter((p) => p.isAI)

    if (aiPlayers.length === 0) {
      return `${humanPlayers.length} Players`
    } else if (humanPlayers.length === 1) {
      return `vs ${aiPlayers.length} AI`
    } else {
      return `${humanPlayers.length} Players + ${aiPlayers.length} AI`
    }
  }

  const handleAccept = async () => {
    setIsProcessing(true)
    try {
      await onAccept()
    } catch (error) {
      console.error("Error accepting invite:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDecline = async () => {
    setIsProcessing(true)
    try {
      await onDecline()
    } catch (error) {
      console.error("Error declining invite:", error)
    } finally {
      setIsProcessing(false)
    }
  }

  // Check if invite is expired (5 minutes)
  const isExpired = Date.now() - invite.timestamp > 300000

  return (
    <div
      className="fixed top-4 right-4 z-50 bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-sm border border-purple-500/30 rounded-2xl p-6 shadow-2xl max-w-sm animate-in slide-in-from-right-5"
      role="alert"
      aria-label="Game invitation"
    >
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Gamepad2 className="w-6 h-6 text-purple-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold">Game Invitation</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDecline}
              disabled={isProcessing}
              className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-white/10"
              aria-label="Close invitation"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <p className="text-gray-300 text-sm mb-3">
            <span className="font-medium text-purple-400">{invite.hostName}</span> invited you to play{" "}
            <span className="font-medium text-white">{getGameTypeDisplay(invite.gameConfig.gameType)}</span>
          </p>

          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="secondary" className="bg-purple-500/20 text-purple-200 border-purple-400/30">
              <Users className="w-3 h-3 mr-1" />
              {getPlayerInfo()}
            </Badge>

            {invite.gameConfig.difficulty && (
              <Badge variant="secondary" className="bg-blue-500/20 text-blue-200 border-blue-400/30">
                {invite.gameConfig.difficulty}
              </Badge>
            )}

            <Badge variant="secondary" className="bg-gray-500/20 text-gray-200 border-gray-400/30">
              <Clock className="w-3 h-3 mr-1" />
              {formatTimeAgo(invite.timestamp)}
            </Badge>
          </div>

          {isExpired ? (
            <div className="text-center">
              <p className="text-red-300 text-sm mb-2">This invitation has expired</p>
              <Button
                onClick={handleDecline}
                variant="outline"
                size="sm"
                disabled={isProcessing}
                className="w-full border-red-400/30 text-red-300 hover:bg-red-500/20 hover:text-red-200 bg-transparent"
              >
                {isProcessing ? "Dismissing..." : "Dismiss"}
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleAccept}
                size="sm"
                disabled={isProcessing}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white flex-1 border-0"
                aria-label="Join game"
              >
                {isProcessing ? "Joining..." : "Join Game"}
              </Button>
              <Button
                onClick={handleDecline}
                variant="outline"
                size="sm"
                disabled={isProcessing}
                className="border-purple-500/30 text-purple-200 hover:bg-purple-500/10 hover:text-white bg-transparent"
                aria-label="Decline invitation"
              >
                {isProcessing ? "..." : "Decline"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
