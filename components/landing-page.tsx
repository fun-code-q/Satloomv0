"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AnimatedLogo } from "./animated-logo"
import { LoadingBars } from "./loading-bars"
import { SpaceBackground } from "./space-background"
import { Users, LogIn, AlertCircle } from "lucide-react"

interface LandingPageProps {
  onCreateRoom: () => void
  onJoinRoom: (roomId: string) => void
  error?: string
}

export function LandingPage({ onCreateRoom, onJoinRoom, error }: LandingPageProps) {
  const [roomId, setRoomId] = useState("")
  const [currentTime, setCurrentTime] = useState(new Date())

  // Update time every second after mount
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleJoinRoom = () => {
    if (roomId.trim()) {
      onJoinRoom(roomId.trim())
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleJoinRoom()
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative">
      <SpaceBackground />

      <div className="w-full max-w-2xl mx-auto">
        {/* Main Content */}
        <div className="bg-slate-800/60 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
          <div className="text-center mb-8">
            <AnimatedLogo className="justify-center mb-4" />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {/* Room Input */}
          <div className="mb-8">
            <Input
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter Room ID"
              className="w-full bg-slate-700 border-slate-600 text-white placeholder-gray-400 text-center py-3 text-lg"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center mb-12">
            <Button
              onClick={onCreateRoom}
              className="bg-cyan-500 hover:bg-cyan-600 text-white px-6 py-3 rounded-lg font-medium"
            >
              <Users className="w-4 h-4 mr-2" />
              Create Room
            </Button>
            <Button
              onClick={handleJoinRoom}
              disabled={!roomId.trim()}
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-700 px-6 py-3 rounded-lg font-medium bg-transparent"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Join Room
            </Button>
          </div>

          {/* Loading Animation */}
          <LoadingBars />
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-400 text-sm">SatLoom v2.0.0 | Powered by SatLoom Developers</div>
      </div>
    </div>
  )
}
