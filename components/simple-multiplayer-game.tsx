"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { SimpleDotsGame, type SimpleGameState, type SimpleMove } from "@/utils/simple-dots-game"
import { GameSignaling, type GameMove, type MultiplayerGameState } from "@/utils/game-signaling"
import { NotificationSystem } from "@/utils/notification-system"
import { X, Trophy, Clock, Users, Wifi, WifiOff } from "lucide-react"

interface SimpleMultiplayerGameProps {
  roomId: string
  currentUserId: string
  isHost: boolean
  gameId: string
  onExit: () => void
}

export function SimpleMultiplayerGame({ roomId, currentUserId, isHost, gameId, onExit }: SimpleMultiplayerGameProps) {
  const [localGame, setLocalGame] = useState<SimpleDotsGame>(new SimpleDotsGame(4))
  const [gameState, setGameState] = useState<SimpleGameState>(localGame.getState())
  const [multiplayerState, setMultiplayerState] = useState<MultiplayerGameState | null>(null)
  const [isMyTurn, setIsMyTurn] = useState(isHost)
  const [selectedDot, setSelectedDot] = useState<{ row: number; col: number } | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [gameTime, setGameTime] = useState(0)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null)
  const gameSignaling = GameSignaling.getInstance()
  const notificationSystem = NotificationSystem.getInstance()

  // Constants
  const CANVAS_SIZE = 400
  const GRID_SIZE = 4
  const BOX_SIZE = (CANVAS_SIZE - 80) / GRID_SIZE
  const PADDING = 40
  const DOT_RADIUS = 15

  // Player colors
  const COLORS = {
    host: "#3b82f6", // blue
    joiner: "#ef4444", // red
  }

  // Initialize multiplayer game
  useEffect(() => {
    const initializeGame = async () => {
      try {
        if (isHost) {
          console.log("🎮 HOST: Creating multiplayer game")
          await gameSignaling.createMultiplayerGame(roomId, gameId, currentUserId, "Host Player")
          localGame.startGame()
          setGameState(localGame.getState())
        } else {
          console.log("🎮 JOINER: Attempting to join game")
          const joined = await gameSignaling.joinMultiplayerGame(roomId, gameId, currentUserId, "Joiner Player")
          if (!joined) {
            notificationSystem.error("Failed to join game")
            onExit()
            return
          }
        }

        // Listen for multiplayer updates
        const unsubscribe = gameSignaling.listenForMultiplayerGame(roomId, gameId, (mpState) => {
          console.log("📡 Received multiplayer update:", mpState)
          setMultiplayerState(mpState)
          setIsOnline(true)

          // Convert multiplayer moves to local game moves
          const localMoves: SimpleMove[] = mpState.moves.map((move) => ({
            type: move.type,
            row: move.row,
            col: move.col,
            player: move.playerId === mpState.hostId ? "host" : "joiner",
          }))

          // Apply moves to local game
          localGame.applyMoves(localMoves)
          if (mpState.gameStatus === "playing") {
            localGame.startGame()
          }

          const newState = localGame.getState()
          setGameState(newState)

          // Update turn state
          const myRole = isHost ? "host" : "joiner"
          const currentTurn = mpState.currentTurn
          setIsMyTurn(currentTurn === myRole && mpState.gameStatus === "playing")
        })

        // Start game timer
        gameTimerRef.current = setInterval(() => {
          setGameTime((prev) => prev + 1)
        }, 1000)

        return () => {
          unsubscribe()
          if (gameTimerRef.current) {
            clearInterval(gameTimerRef.current)
          }
        }
      } catch (error) {
        console.error("❌ Error initializing game:", error)
        setIsOnline(false)
        notificationSystem.error("Failed to initialize multiplayer game")
      }
    }

    initializeGame()
  }, [roomId, gameId, currentUserId, isHost])

  // Canvas drawing
  useEffect(() => {
    drawGame()
  }, [gameState, selectedDot])

  const drawGame = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.fillStyle = "#1e293b"
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw grid guidelines
    ctx.strokeStyle = "#374151"
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])

    // Horizontal guidelines
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (!gameState.horizontalLines[row][col]) {
          const startX = col * BOX_SIZE + PADDING
          const startY = row * BOX_SIZE + PADDING
          const endX = (col + 1) * BOX_SIZE + PADDING
          const endY = row * BOX_SIZE + PADDING

          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.stroke()
        }
      }
    }

    // Vertical guidelines
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        if (!gameState.verticalLines[row][col]) {
          const startX = col * BOX_SIZE + PADDING
          const startY = row * BOX_SIZE + PADDING
          const endX = col * BOX_SIZE + PADDING
          const endY = (row + 1) * BOX_SIZE + PADDING

          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.stroke()
        }
      }
    }

    ctx.setLineDash([])
    ctx.lineWidth = 4
    ctx.lineCap = "round"

    // Draw completed horizontal lines
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (gameState.horizontalLines[row][col]) {
          ctx.strokeStyle = row % 2 === 0 ? COLORS.host : COLORS.joiner // Simplified coloring

          const startX = col * BOX_SIZE + PADDING
          const startY = row * BOX_SIZE + PADDING
          const endX = (col + 1) * BOX_SIZE + PADDING
          const endY = row * BOX_SIZE + PADDING

          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.stroke()
        }
      }
    }

    // Draw completed vertical lines
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        if (gameState.verticalLines[row][col]) {
          ctx.strokeStyle = col % 2 === 0 ? COLORS.host : COLORS.joiner // Simplified coloring

          const startX = col * BOX_SIZE + PADDING
          const startY = row * BOX_SIZE + PADDING
          const endX = col * BOX_SIZE + PADDING
          const endY = (row + 1) * BOX_SIZE + PADDING

          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.stroke()
        }
      }
    }

    // Draw completed boxes
    ctx.font = "bold 16px Arial"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const box = gameState.boxes[row][col]
        if (box.completed && box.owner) {
          const color = COLORS[box.owner]
          const boxX = col * BOX_SIZE + PADDING
          const boxY = row * BOX_SIZE + PADDING

          ctx.fillStyle = color + "40"
          ctx.fillRect(boxX, boxY, BOX_SIZE, BOX_SIZE)

          ctx.fillStyle = color
          ctx.fillText(box.owner[0].toUpperCase(), boxX + BOX_SIZE / 2, boxY + BOX_SIZE / 2)
        }
      }
    }

    // Draw dots
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        const dotX = col * BOX_SIZE + PADDING
        const dotY = row * BOX_SIZE + PADDING
        const isSelected = selectedDot && selectedDot.row === row && selectedDot.col === col

        if (isSelected) {
          ctx.strokeStyle = "#fbbf24"
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(dotX, dotY, DOT_RADIUS + 5, 0, Math.PI * 2)
          ctx.stroke()
        }

        ctx.fillStyle = isSelected ? "#fbbf24" : "#64748b"
        ctx.strokeStyle = "#1e293b"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(dotX, dotY, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }

  const handleCanvasClick = async (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isMyTurn || gameState.gameStatus !== "playing") {
      notificationSystem.info("Wait for your turn!")
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height
    const x = (event.clientX - rect.left) * scaleX
    const y = (event.clientY - rect.top) * scaleY

    // Find clicked dot
    const clickedDot = findDotAt(x, y)
    if (!clickedDot) return

    if (!selectedDot) {
      setSelectedDot(clickedDot)
    } else {
      if (selectedDot.row === clickedDot.row && selectedDot.col === clickedDot.col) {
        setSelectedDot(null)
        return
      }

      const lineInfo = getLineInfo(selectedDot, clickedDot)
      if (!lineInfo) {
        setSelectedDot(null)
        return
      }

      // Make the move
      const move: SimpleMove = {
        type: lineInfo.type,
        row: lineInfo.row,
        col: lineInfo.col,
        player: isHost ? "host" : "joiner",
      }

      const result = localGame.makeMove(move)
      if (result.success) {
        setGameState(localGame.getState())

        // Send move to Firebase
        const gameMove: GameMove = {
          type: lineInfo.type,
          row: lineInfo.row,
          col: lineInfo.col,
          playerId: currentUserId,
          playerName: isHost ? "Host Player" : "Joiner Player",
          timestamp: Date.now(),
        }

        try {
          await gameSignaling.makeMove(roomId, gameId, gameMove)
          console.log("✅ Move sent successfully")
        } catch (error) {
          console.error("❌ Failed to send move:", error)
          setIsOnline(false)
        }
      }

      setSelectedDot(null)
    }
  }

  const findDotAt = (x: number, y: number): { row: number; col: number } | null => {
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        const dotX = col * BOX_SIZE + PADDING
        const dotY = row * BOX_SIZE + PADDING
        const distance = Math.sqrt((x - dotX) ** 2 + (y - dotY) ** 2)

        if (distance <= DOT_RADIUS * 2) {
          return { row, col }
        }
      }
    }
    return null
  }

  const getLineInfo = (dot1: { row: number; col: number }, dot2: { row: number; col: number }) => {
    const rowDiff = Math.abs(dot1.row - dot2.row)
    const colDiff = Math.abs(dot1.col - dot2.col)

    if (rowDiff + colDiff !== 1) return null

    if (rowDiff === 1) {
      return {
        type: "vertical" as const,
        row: Math.min(dot1.row, dot2.row),
        col: dot1.col,
      }
    } else {
      return {
        type: "horizontal" as const,
        row: dot1.row,
        col: Math.min(dot1.col, dot2.col),
      }
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const getStatusText = () => {
    if (!multiplayerState) return "Connecting..."

    if (multiplayerState.gameStatus === "waiting") {
      return isHost ? "Waiting for joiner..." : "Joining game..."
    }

    if (multiplayerState.gameStatus === "finished") {
      if (gameState.winner === "tie") return "Game ended in a tie!"
      const winner = gameState.winner === "host" ? "Host" : "Joiner"
      const isWinner = (isHost && gameState.winner === "host") || (!isHost && gameState.winner === "joiner")
      return isWinner ? "You won!" : `${winner} wins!`
    }

    return isMyTurn ? "Your turn" : "Opponent's turn"
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-cyan-400">Dots & Boxes - Multiplayer</h1>

          <div className="flex items-center gap-2 text-sm">
            {isOnline ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-gray-300">{multiplayerState?.joinerId ? "2/2" : "1/2"} players</span>
            {isHost && <span className="text-xs text-yellow-400 ml-1">HOST</span>}
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-300">
            <Clock className="w-4 h-4" />
            {formatTime(gameTime)}
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={onExit} className="text-white hover:text-gray-300">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Game Status */}
      <div className="p-4 bg-slate-800/50 text-center">
        <div className="text-lg font-medium">{getStatusText()}</div>

        {/* Scores */}
        <div className="flex justify-center gap-8 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.host }} />
            <span className="text-sm">Host: {gameState.scores.host}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.joiner }} />
            <span className="text-sm">Joiner: {gameState.scores.joiner}</span>
          </div>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className={`border-2 border-slate-600 rounded-lg bg-slate-800 ${
            isMyTurn && gameState.gameStatus === "playing" ? "cursor-pointer" : "cursor-not-allowed"
          }`}
          style={{
            width: "100%",
            maxWidth: "400px",
            height: "auto",
            aspectRatio: "1/1",
          }}
        />
      </div>

      {/* Game Over Screen */}
      {gameState.gameStatus === "finished" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-xs mx-4 text-center">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>

            <h2 className="text-xl font-bold mb-2">Game Over!</h2>
            <p className="text-gray-300 mb-4">{getStatusText()}</p>

            <div className="flex justify-between text-sm text-gray-400 mb-6">
              <span>Host: {gameState.scores.host}</span>
              <span>Joiner: {gameState.scores.joiner}</span>
            </div>

            <Button onClick={onExit} className="w-full bg-cyan-500 hover:bg-cyan-600">
              Exit Game
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
