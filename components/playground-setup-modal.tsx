"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Gamepad2, Users, User, Bot, Mic, MicOff } from "lucide-react"

interface PlaygroundSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onStartGame: (config: GameConfig) => void
}

export interface GameConfig {
  gameType: "single" | "double" | "multi"
  players: Array<{
    id: string
    name: string
    isComputer: boolean
    isHost: boolean
    color: string
  }>
  gridSize: number
  difficulty: "easy" | "medium" | "hard"
  voiceChatEnabled: boolean
}

const playerColors = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4"]

export function PlaygroundSetupModal({ isOpen, onClose, onStartGame }: PlaygroundSetupModalProps) {
  const [gameType, setGameType] = useState<"single" | "double" | "multi">("single")
  const [gridSize, setGridSize] = useState(5)
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(false)
  const [playerNames, setPlayerNames] = useState<string[]>(["Player 1", "Computer"])
  const [computerPlayers, setComputerPlayers] = useState<boolean[]>([false, true])
  const [nameErrors, setNameErrors] = useState<string[]>([])

  const handleGameTypeChange = (type: "single" | "double" | "multi") => {
    setGameType(type)

    switch (type) {
      case "single":
        setPlayerNames(["Player 1", "Computer"])
        setComputerPlayers([false, true])
        break
      case "double":
        setPlayerNames(["Player 1", "Player 2"])
        setComputerPlayers([false, false])
        break
      case "multi":
        setPlayerNames(["Player 1", "Player 2", "Player 3"])
        setComputerPlayers([false, false, false])
        break
    }
    setNameErrors([])
  }

  const handlePlayerNameChange = (index: number, name: string) => {
    const newNames = [...playerNames]
    newNames[index] = name
    setPlayerNames(newNames)

    // Validate name
    const errors = [...nameErrors]
    errors[index] = name.trim() === "" ? "Name cannot be empty" : ""
    setNameErrors(errors)
  }

  const toggleComputerPlayer = (index: number) => {
    if (gameType === "single" && index === 1) return // Computer must be player 2 in single player

    const newComputerPlayers = [...computerPlayers]
    newComputerPlayers[index] = !newComputerPlayers[index]
    setComputerPlayers(newComputerPlayers)
  }

  const addPlayer = () => {
    if (playerNames.length < 6) {
      setPlayerNames([...playerNames, `Player ${playerNames.length + 1}`])
      setComputerPlayers([...computerPlayers, false])
      setNameErrors([...nameErrors, ""])
    }
  }

  const removePlayer = (index: number) => {
    if (playerNames.length > 2) {
      const newNames = playerNames.filter((_, i) => i !== index)
      const newComputers = computerPlayers.filter((_, i) => i !== index)
      const newErrors = nameErrors.filter((_, i) => i !== index)
      setPlayerNames(newNames)
      setComputerPlayers(newComputers)
      setNameErrors(newErrors)
    }
  }

  const handleStartGame = () => {
    // Validate names
    const errors = playerNames.map((name, index) =>
      name.trim() === "" ? "Name cannot be empty" : playerNames.indexOf(name) !== index ? "Names must be unique" : ""
    )
    setNameErrors(errors)
    if (errors.some((error) => error !== "")) return

    const players = playerNames.map((name, index) => ({
      id: `player_${index}_${Date.now()}`,
      name: name || `Player ${index + 1}`,
      isComputer: computerPlayers[index],
      isHost: index === 0,
      color: playerColors[index % playerColors.length],
    }))

    const difficulty = gridSize <= 4 ? "easy" : gridSize <= 6 ? "medium" : "hard"
    const config: GameConfig = {
      gameType,
      players,
      gridSize,
      difficulty,
      voiceChatEnabled,
    }

    onStartGame(config)
  }

  const getMaxPlayers = () => {
    switch (gameType) {
      case "single":
        return 2
      case "double":
        return 2
      case "multi":
        return 6
      default:
        return 2
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto pt-8" aria-label="Game setup modal">
        <DialogHeader></DialogHeader>

        <div className="space-y-6 py-4">
          {/* Game Type Selection */}
          <div>
            <h3 className="text-white font-medium mb-3">Game Type</h3>
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant={gameType === "single" ? "default" : "outline"}
                className={`p-4 h-auto flex flex-col gap-2 ${
                  gameType === "single"
                    ? "bg-cyan-500 hover:bg-cyan-600"
                    : "border-slate-600 hover:bg-slate-700 bg-transparent"
                }`}
                onClick={() => handleGameTypeChange("single")}
                aria-label="Select single player mode (vs Computer)"
              >
                <User className="w-6 h-6" />
                <span className="text-sm">Single Player</span>
                <span className="text-xs opacity-70">vs Computer</span>
              </Button>

              <Button
                variant={gameType === "double" ? "default" : "outline"}
                className={`p-4 h-auto flex flex-col gap-2 ${
                  gameType === "double"
                    ? "bg-cyan-500 hover:bg-cyan-600"
                    : "border-slate-600 hover:bg-slate-700 bg-transparent"
                }`}
                onClick={() => handleGameTypeChange("double")}
                aria-label="Select double player mode (online)"
              >
                <Users className="w-6 h-6" />
                <span className="text-sm">Double Player</span>
                <span className="text-xs opacity-70">Online</span>
              </Button>

              <Button
                variant={gameType === "multi" ? "default" : "outline"}
                className={`p-4 h-auto flex flex-col gap-2 ${
                  gameType === "multi"
                    ? "bg-cyan-500 hover:bg-cyan-600"
                    : "border-slate-600 hover:bg-slate-700 bg-transparent"
                }`}
                onClick={() => handleGameTypeChange("multi")}
                aria-label="Select multiplayer mode (up to 6 players)"
              >
                <Gamepad2 className="w-6 h-6" />
                <span className="text-sm">Multi Player</span>
                <span className="text-xs opacity-70">Up to 6 players</span>
              </Button>
            </div>
          </div>

          {/* Grid Size&Voice Chat */}
          <div className="flex gap-8">
            <div className="flex-1">
              <h3 className="text-white font-medium mb-3">Grid Size</h3>
              <div className="flex gap-3">
                {[4, 5, 6, 7, 8].map((size) => (
                  <Button
                    key={size}
                    variant={gridSize === size ? "default" : "outline"}
                    className={`${
                      gridSize === size
                        ? "bg-cyan-500 hover:bg-cyan-600"
                        : "border-slate-600 hover:bg-slate-700 bg-transparent"
                    }`}
                    onClick={() => setGridSize(size)}
                    aria-label={`Select ${size}x${size} grid size`}
                  >
                    {size}×{size}
                  </Button>
                ))}
              </div>
            </div>

            {(gameType === "double" || gameType === "multi") && (
              <div className="flex-1">
                <h3 className="text-white font-medium mb-3">Voice Chat</h3>
                <div className="flex gap-3">
                  <Button
                    variant={voiceChatEnabled ? "default" : "outline"}
                    className={`flex items-center gap-2 ${
                      voiceChatEnabled
                        ? "bg-cyan-500 hover:bg-cyan-600"
                        : "border-slate-600 hover:bg-slate-700 bg-transparent"
                    }`}
                    onClick={() => setVoiceChatEnabled(true)}
                    aria-label="Enable voice chat"
                  >
                    <Mic className="w-4 h-4" />
                    Enabled
                  </Button>
                  <Button
                    variant={!voiceChatEnabled ? "default" : "outline"}
                    className={`flex items-center gap-2 ${
                      !voiceChatEnabled
                        ? "bg-cyan-500 hover:bg-cyan-600"
                        : "border-slate-600 hover:bg-slate-700 bg-transparent"
                    }`}
                    onClick={() => setVoiceChatEnabled(false)}
                    aria-label="Disable voice chat"
                  >
                    <MicOff className="w-4 h-4" />
                    Disabled
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Players Configuration */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-medium">Players</h3>
              {gameType === "multi" && playerNames.length < getMaxPlayers() && (
                <Button
                  variant="outline"
                  size="icon"
                  className="border-slate-600 hover:bg-slate-700 bg-transparent"
                  onClick={addPlayer}
                  aria-label="Add new player"
                >
                  +
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {playerNames.map((name, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-slate-700/50 rounded-lg flex-1 min-w-0">
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white"
                    style={{ backgroundColor: playerColors[index % playerColors.length] }}
                  />

                  <div className="flex-1">
                    <Input
                      value={name}
                      onChange={(e) => handlePlayerNameChange(index, e.target.value)}
                      className="bg-slate-600 border-slate-500 text-white"
                      placeholder={`Player ${index + 1}`}
                      aria-label={`Player ${index + 1} name`}
                    />
                    {nameErrors[index] && (
                      <span className="text-red-400 text-xs">{nameErrors[index]}</span>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className={`${
                      computerPlayers[index]
                        ? "text-orange-400 hover:text-orange-300"
                        : "text-gray-400 hover:text-white"
                    }`}
                    onClick={() => toggleComputerPlayer(index)}
                    disabled={gameType === "single" && index === 1}
                    aria-label={`Toggle computer player for Player ${index + 1}`}
                  >
                    <Bot className="w-4 h-4" />
                  </Button>

                  {gameType === "multi" && playerNames.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-300"
                      onClick={() => removePlayer(index)}
                      aria-label={`Remove Player ${index + 1}`}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center pt-4">
            <Button onClick={handleStartGame} className="bg-cyan-500 hover:bg-cyan-600 px-8" aria-label="Start game">
              Start Game
            </Button>
            <Button
              onClick={onClose}
              variant="outline"
              className="border-slate-600 text-white hover:bg-slate-700 bg-transparent px-8"
              aria-label="Cancel setup"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
