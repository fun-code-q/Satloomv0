"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Gamepad2, Users, Bot, Mic, Settings, Palette } from "lucide-react"

export interface GameConfig {
  gameType: "dots-and-boxes"
  mode: "single" | "double" | "multi"
  gridSize: number
  difficulty: "easy" | "medium" | "hard"
  voiceChatEnabled: boolean
  sharedGameId?: string // Add this line
  players: Array<{
    id: string
    name: string
    color: string
    isAI?: boolean
  }>
}

interface PlaygroundSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onStartGame: (config: GameConfig) => void
}

const PLAYER_COLORS = [
  "#3b82f6", // blue
  "#ef4444", // red
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#84cc16", // lime
  "#f97316", // orange
]

export function PlaygroundSetupModal({ isOpen, onClose, onStartGame }: PlaygroundSetupModalProps) {
  const [gameType] = useState<"dots-and-boxes">("dots-and-boxes")
  const [mode, setMode] = useState<"single" | "double" | "multi">("single")
  const [gridSize, setGridSize] = useState(4)
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium")
  const [voiceChatEnabled, setVoiceChatEnabled] = useState(false)
  const [players, setPlayers] = useState([{ id: "player1", name: "You", color: PLAYER_COLORS[0], isAI: false }])

  const handleModeChange = (newMode: "single" | "double" | "multi") => {
    setMode(newMode)

    if (newMode === "single") {
      setPlayers([{ id: "player1", name: "You", color: PLAYER_COLORS[0], isAI: false }])
    } else if (newMode === "double") {
      setPlayers([
        { id: "player1", name: "You", color: PLAYER_COLORS[0], isAI: false },
        { id: "player2", name: "Player 2", color: PLAYER_COLORS[1], isAI: false },
      ])
    } else {
      setPlayers([
        { id: "player1", name: "You", color: PLAYER_COLORS[0], isAI: false },
        { id: "player2", name: "Player 2", color: PLAYER_COLORS[1], isAI: false },
        { id: "player3", name: "Player 3", color: PLAYER_COLORS[2], isAI: false },
      ])
    }
  }

  const addPlayer = () => {
    if (players.length < 6) {
      const newPlayer = {
        id: `player${players.length + 1}`,
        name: `Player ${players.length + 1}`,
        color: PLAYER_COLORS[players.length % PLAYER_COLORS.length],
        isAI: false,
      }
      setPlayers([...players, newPlayer])
    }
  }

  const removePlayer = (index: number) => {
    if (players.length > 2 && index > 0) {
      setPlayers(players.filter((_, i) => i !== index))
    }
  }

  const updatePlayer = (index: number, field: string, value: any) => {
    const updatedPlayers = [...players]
    updatedPlayers[index] = { ...updatedPlayers[index], [field]: value }
    setPlayers(updatedPlayers)
  }

  const handleStartGame = () => {
    const config: GameConfig = {
      gameType,
      mode,
      gridSize,
      difficulty,
      voiceChatEnabled,
      players,
    }
    onStartGame(config)
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-800 border-slate-700 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-cyan-400">
            <Gamepad2 className="w-5 h-5" />
            Game Setup
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="game" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-slate-700">
            <TabsTrigger value="game" className="data-[state=active]:bg-slate-600">
              Game
            </TabsTrigger>
            <TabsTrigger value="players" className="data-[state=active]:bg-slate-600">
              Players
            </TabsTrigger>
            <TabsTrigger value="settings" className="data-[state=active]:bg-slate-600">
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="game" className="space-y-4">
            <Card className="bg-slate-700 border-slate-600">
              <CardHeader>
                <CardTitle className="text-white">Game Mode</CardTitle>
                <CardDescription className="text-gray-300">Choose how you want to play</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button
                    variant={mode === "single" ? "default" : "outline"}
                    className={`h-20 flex flex-col gap-2 ${
                      mode === "single" ? "bg-cyan-500 hover:bg-cyan-600" : "border-slate-600 hover:bg-slate-600"
                    }`}
                    onClick={() => handleModeChange("single")}
                  >
                    <Bot className="w-6 h-6" />
                    <span>vs AI</span>
                  </Button>

                  <Button
                    variant={mode === "double" ? "default" : "outline"}
                    className={`h-20 flex flex-col gap-2 ${
                      mode === "double" ? "bg-cyan-500 hover:bg-cyan-600" : "border-slate-600 hover:bg-slate-600"
                    }`}
                    onClick={() => handleModeChange("double")}
                  >
                    <Users className="w-6 h-6" />
                    <span>1v1 Online</span>
                  </Button>

                  <Button
                    variant={mode === "multi" ? "default" : "outline"}
                    className={`h-20 flex flex-col gap-2 ${
                      mode === "multi" ? "bg-cyan-500 hover:bg-cyan-600" : "border-slate-600 hover:bg-slate-600"
                    }`}
                    onClick={() => handleModeChange("multi")}
                  >
                    <Users className="w-6 h-6" />
                    <span>Multiplayer</span>
                  </Button>
                </div>

                <div className="space-y-2">
                  <Label className="text-white">Grid Size</Label>
                  <Select value={gridSize.toString()} onValueChange={(value) => setGridSize(Number.parseInt(value))}>
                    <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-700 border-slate-600">
                      <SelectItem value="4">4x4 (Beginner)</SelectItem>
                      <SelectItem value="5">5x5 (Intermediate)</SelectItem>
                      <SelectItem value="6">6x6 (Advanced)</SelectItem>
                      <SelectItem value="7">7x7 (Expert)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {mode === "single" && (
                  <div className="space-y-2">
                    <Label className="text-white">AI Difficulty</Label>
                    <Select
                      value={difficulty}
                      onValueChange={(value: "easy" | "medium" | "hard") => setDifficulty(value)}
                    >
                      <SelectTrigger className="bg-slate-600 border-slate-500 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-700 border-slate-600">
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="players" className="space-y-4">
            <Card className="bg-slate-700 border-slate-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Players ({players.length})
                </CardTitle>
                <CardDescription className="text-gray-300">
                  {mode === "single" && "Playing against AI"}
                  {mode === "double" && "1v1 match with another player"}
                  {mode === "multi" && "Multiplayer game with up to 6 players"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {players.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-4 p-3 bg-slate-600 rounded-lg">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                      style={{ backgroundColor: player.color }}
                    >
                      {player.name[0]}
                    </div>

                    <div className="flex-1">
                      <Input
                        value={player.name}
                        onChange={(e) => updatePlayer(index, "name", e.target.value)}
                        className="bg-slate-500 border-slate-400 text-white"
                        disabled={index === 0} // Can't change host name
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-gray-400" />
                      <Select value={player.color} onValueChange={(value) => updatePlayer(index, "color", value)}>
                        <SelectTrigger className="w-12 h-8 p-0 border-0">
                          <div className="w-6 h-6 rounded-full mx-auto" style={{ backgroundColor: player.color }} />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-700 border-slate-600">
                          {PLAYER_COLORS.map((color) => (
                            <SelectItem key={color} value={color}>
                              <div className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
                                <span className="text-white">{color}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {mode === "multi" && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={player.isAI}
                          onCheckedChange={(checked) => updatePlayer(index, "isAI", checked)}
                          disabled={index === 0} // Host can't be AI
                        />
                        <Label className="text-sm text-gray-300">AI</Label>
                      </div>
                    )}

                    {index === 0 && <Badge variant="secondary">Host</Badge>}

                    {mode === "multi" && index > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removePlayer(index)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                ))}

                {mode === "multi" && players.length < 6 && (
                  <Button
                    variant="outline"
                    onClick={addPlayer}
                    className="w-full border-slate-600 hover:bg-slate-600 text-white bg-transparent"
                  >
                    Add Player
                  </Button>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="bg-slate-700 border-slate-600">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Game Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(mode === "double" || mode === "multi") && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-white flex items-center gap-2">
                        <Mic className="w-4 h-4" />
                        Voice Chat
                      </Label>
                      <p className="text-sm text-gray-400">Enable voice communication during the game</p>
                    </div>
                    <Switch checked={voiceChatEnabled} onCheckedChange={setVoiceChatEnabled} />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-white">Game Rules</Label>
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>• Connect dots to form boxes</p>
                    <p>• Complete a box to score a point</p>
                    <p>• Get another turn when you complete a box</p>
                    <p>• Player with most boxes wins</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
          <Button variant="outline" onClick={onClose} className="border-slate-600 hover:bg-slate-700 bg-transparent">
            Cancel
          </Button>
          <Button onClick={handleStartGame} className="bg-cyan-500 hover:bg-cyan-600">
            Start Game
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
