"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { DotsAndBoxesGame, type GameState, type Player } from "@/utils/dots-and-boxes-game"
import { GameSignaling } from "@/utils/game-signaling"
import { GameSounds } from "@/utils/game-sounds"
import { createPeerConnection } from "@/lib/webrtc"
import { NotificationSystem } from "@/utils/notification-system"
import type { GameConfig } from "./playground-setup-modal"
import { Mic, MicOff, Volume2, VolumeX, X, Trophy, Clock, Pause, Play, RotateCcw, Settings } from "lucide-react"
import { PlaygroundSetupModal } from "./playground-setup-modal"

interface DotsAndBoxesGameComponentProps {
  gameConfig: GameConfig
  roomId: string
  currentUserId: string
  onExit: () => void
}

export function DotsAndBoxesGameComponent({
  gameConfig,
  roomId,
  currentUserId,
  onExit,
}: DotsAndBoxesGameComponentProps) {
  const [game, setGame] = useState<DotsAndBoxesGame | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isPlayerTurn, setIsPlayerTurn] = useState(true) // Simple boolean - true = player, false = computer
  const [gameTime, setGameTime] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showPauseMenu, setShowPauseMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Dot selection state
  const [selectedDot, setSelectedDot] = useState<{ row: number; col: number } | null>(null)

  // Voice chat state
  const [isMicMuted, setIsMicMuted] = useState(true)
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())

  const gameSignaling = GameSignaling.getInstance()
  const gameSounds = GameSounds.getInstance()
  const notificationSystem = NotificationSystem.getInstance()

  const gameId = useRef(`game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`).current

  // Constants - Fixed canvas size
  const CANVAS_SIZE = 400
  const GRID_SIZE = gameConfig?.gridSize || 4
  const BOX_SIZE = (CANVAS_SIZE - 80) / GRID_SIZE
  const PADDING = 40
  const DOT_RADIUS = 15

  // Get computer player
  const getComputerPlayer = useCallback(() => {
    if (!gameState) return null
    return gameState.players.find((p) => p.isComputer) || null
  }, [gameState])

  // Get human player
  const getHumanPlayer = useCallback(() => {
    if (!gameState) return null
    return gameState.players.find((p) => !p.isComputer) || null
  }, [gameState])

  // Check if a move would complete a box
  const wouldCompleteBox = useCallback(
    (type: "horizontal" | "vertical", row: number, col: number) => {
      if (!gameState) return false

      let boxesCompleted = 0

      if (type === "horizontal") {
        // Check box above
        if (row > 0) {
          const boxRow = row - 1
          const boxCol = col
          const top = gameState.horizontalLines[boxRow][boxCol].isDrawn
          const bottom = row === boxRow + 1 // This would be the line we're drawing
          const left = gameState.verticalLines[boxRow][boxCol].isDrawn
          const right = gameState.verticalLines[boxRow][boxCol + 1].isDrawn

          if (top && left && right) boxesCompleted++
        }

        // Check box below
        if (row < GRID_SIZE) {
          const boxRow = row
          const boxCol = col
          const top = row === boxRow // This would be the line we're drawing
          const bottom = gameState.horizontalLines[boxRow + 1][boxCol].isDrawn
          const left = gameState.verticalLines[boxRow][boxCol].isDrawn
          const right = gameState.verticalLines[boxRow][boxCol + 1].isDrawn

          if (bottom && left && right) boxesCompleted++
        }
      } else {
        // Check box to the left
        if (col > 0) {
          const boxRow = row
          const boxCol = col - 1
          const top = gameState.horizontalLines[boxRow][boxCol].isDrawn
          const bottom = gameState.horizontalLines[boxRow + 1][boxCol].isDrawn
          const left = gameState.verticalLines[boxRow][boxCol].isDrawn
          const right = col === boxCol + 1 // This would be the line we're drawing

          if (top && bottom && left) boxesCompleted++
        }

        // Check box to the right
        if (col < GRID_SIZE) {
          const boxRow = row
          const boxCol = col
          const top = gameState.horizontalLines[boxRow][boxCol].isDrawn
          const bottom = gameState.horizontalLines[boxRow + 1][boxCol].isDrawn
          const left = col === boxCol // This would be the line we're drawing
          const right = gameState.verticalLines[boxRow][boxCol + 1].isDrawn

          if (top && bottom && right) boxesCompleted++
        }
      }

      return boxesCompleted > 0
    },
    [gameState, GRID_SIZE],
  )

  // Check if a move would give opponent a box opportunity
  const wouldGiveOpponentBox = useCallback(
    (type: "horizontal" | "vertical", row: number, col: number) => {
      if (!gameState) return false

      // Simulate the move
      const tempState = JSON.parse(JSON.stringify(gameState))

      if (type === "horizontal") {
        tempState.horizontalLines[row][col].isDrawn = true
      } else {
        tempState.verticalLines[row][col].isDrawn = true
      }

      // Check all remaining moves to see if any would complete a box
      for (let r = 0; r <= GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          if (!tempState.horizontalLines[r][c].isDrawn) {
            // Check if this horizontal line would complete a box
            let wouldComplete = false

            // Check box above
            if (r > 0) {
              const boxRow = r - 1
              const boxCol = c
              const top = tempState.horizontalLines[boxRow][boxCol].isDrawn
              const bottom = true // This would be the line being checked
              const left = tempState.verticalLines[boxRow][boxCol].isDrawn
              const right = tempState.verticalLines[boxRow][boxCol + 1].isDrawn

              if (top && left && right) wouldComplete = true
            }

            // Check box below
            if (r < GRID_SIZE) {
              const boxRow = r
              const boxCol = c
              const top = true // This would be the line being checked
              const bottom = tempState.horizontalLines[boxRow + 1][boxCol].isDrawn
              const left = tempState.verticalLines[boxRow][boxCol].isDrawn
              const right = tempState.verticalLines[boxRow][boxCol + 1].isDrawn

              if (bottom && left && right) wouldComplete = true
            }

            if (wouldComplete) return true
          }
        }
      }

      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c <= GRID_SIZE; c++) {
          if (!tempState.verticalLines[r][c].isDrawn) {
            // Check if this vertical line would complete a box
            let wouldComplete = false

            // Check box to the left
            if (c > 0) {
              const boxRow = r
              const boxCol = c - 1
              const top = tempState.horizontalLines[boxRow][boxCol].isDrawn
              const bottom = tempState.horizontalLines[boxRow + 1][boxCol].isDrawn
              const left = tempState.verticalLines[boxRow][boxCol].isDrawn
              const right = true // This would be the line being checked

              if (top && bottom && left) wouldComplete = true
            }

            // Check box to the right
            if (c < GRID_SIZE) {
              const boxRow = r
              const boxCol = c
              const top = tempState.horizontalLines[boxRow][boxCol].isDrawn
              const bottom = tempState.horizontalLines[boxRow + 1][boxCol].isDrawn
              const left = true // This would be the line being checked
              const right = tempState.verticalLines[boxRow][boxCol + 1].isDrawn

              if (top && bottom && right) wouldComplete = true
            }

            if (wouldComplete) return true
          }
        }
      }

      return false
    },
    [gameState, GRID_SIZE],
  )

  // Smart computer move function
  const makeComputerMove = useCallback(() => {
    if (!game || !gameState || gameState.gameStatus !== "playing" || isPaused) {
      console.log("❌ Cannot make computer move - invalid state")
      return
    }

    if (isPlayerTurn) {
      console.log("❌ It's player turn, not computer turn")
      return
    }

    const computerPlayer = getComputerPlayer()
    if (!computerPlayer) {
      console.log("❌ No computer player found")
      return
    }

    console.log("🤖 AI is thinking strategically...")

    // Get all available moves
    const availableMoves = []

    // Check horizontal lines
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (!gameState.horizontalLines[row][col].isDrawn) {
          availableMoves.push({ type: "horizontal" as const, row, col })
        }
      }
    }

    // Check vertical lines
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        if (!gameState.verticalLines[row][col].isDrawn) {
          availableMoves.push({ type: "vertical" as const, row, col })
        }
      }
    }

    console.log(`🎯 Found ${availableMoves.length} available moves`)

    if (availableMoves.length === 0) {
      console.log("❌ No available moves for computer")
      return
    }

    // SMART AI STRATEGY:

    // 1. First priority: Complete a box if possible
    const completingMoves = availableMoves.filter((move) => wouldCompleteBox(move.type, move.row, move.col))
    if (completingMoves.length > 0) {
      const move = completingMoves[0]
      console.log(`🎉 AI found box-completing move:`, move)

      const success = game.makeMove(computerPlayer.id, move.type, move.row, move.col)
      if (success) {
        handleSuccessfulComputerMove()
        return
      }
    }

    // 2. Second priority: Avoid giving opponent a box
    const safeMoves = availableMoves.filter((move) => !wouldGiveOpponentBox(move.type, move.row, move.col))
    if (safeMoves.length > 0) {
      const move = safeMoves[Math.floor(Math.random() * safeMoves.length)]
      console.log(`🛡️ AI chose safe move:`, move)

      const success = game.makeMove(computerPlayer.id, move.type, move.row, move.col)
      if (success) {
        handleSuccessfulComputerMove()
        return
      }
    }

    // 3. Last resort: Random move (if all moves give opponent boxes)
    const move = availableMoves[Math.floor(Math.random() * availableMoves.length)]
    console.log(`🎲 AI forced to make risky move:`, move)

    const success = game.makeMove(computerPlayer.id, move.type, move.row, move.col)
    if (success) {
      handleSuccessfulComputerMove()
    } else {
      console.log("❌ Computer move failed")
      setIsPlayerTurn(true)
    }
  }, [game, gameState, isPaused, isPlayerTurn, getComputerPlayer, wouldCompleteBox, wouldGiveOpponentBox, GRID_SIZE])

  // Handle successful computer move
  const handleSuccessfulComputerMove = useCallback(() => {
    console.log("✅ Computer move successful!")
    const updatedState = game!.getGameState()
    setGameState(updatedState)

    gameSounds.playLineDrawn()

    const currentPlayer = updatedState.players[updatedState.currentPlayerIndex]

    if (updatedState.lastMove && updatedState.lastMove.boxesCompleted > 0) {
      console.log("🎉 Computer completed boxes! Gets another turn")
      gameSounds.playBoxCompleted()
      // Computer gets another turn - stay on computer turn
      setTimeout(() => makeComputerMove(), 300)
    } else {
      console.log("🔄 Turn switches to player")
      gameSounds.playTurnChange()
      setIsPlayerTurn(true)
    }

    // Check game end
    if (updatedState.gameStatus === "finished") {
      const winner = updatedState.players.find((p) => p.id === updatedState.winner)
      if (winner?.id === currentUserId) {
        gameSounds.playWin()
      } else {
        gameSounds.playLose()
      }
      gameSounds.playGameEnd()
    }
  }, [game, currentUserId, makeComputerMove])

  // Initialize game
  useEffect(() => {
    console.log("🎮 Initializing game...")

    const players: Player[] = [
      {
        id: currentUserId,
        name: gameConfig.players[0]?.name || "You",
        color: "#3b82f6", // Blue
        isComputer: false,
        isHost: true,
        initials: (gameConfig.players[0]?.name || "You").substring(0, 2).toUpperCase(),
      },
      {
        id: "computer",
        name: "AI",
        color: "#1e40af", // Darker blue
        isComputer: true,
        isHost: false,
        initials: "AI",
      },
    ]

    console.log("👥 Players:", players)

    const newGame = new DotsAndBoxesGame(gameId, roomId, players, gameConfig.gridSize, gameConfig.voiceChatEnabled)
    setGame(newGame)

    newGame.startGame()
    const updatedState = newGame.getGameState()
    setGameState(updatedState)

    // Player ALWAYS starts first
    setIsPlayerTurn(true)
    console.log("🎯 Player starts first")

    if (gameConfig.voiceChatEnabled) {
      setupVoiceChat()
    }

    startGameTimer()
    gameSounds.playGameStart()

    return () => {
      cleanup()
    }
  }, [gameConfig, roomId, currentUserId])

  // Watch for computer turn
  useEffect(() => {
    if (!isPlayerTurn && gameState?.gameStatus === "playing" && !isPaused) {
      console.log("⏰ Computer turn detected, making move...")
      setTimeout(() => makeComputerMove(), 200) // Slight delay for better UX
    }
  }, [isPlayerTurn, gameState?.gameStatus, isPaused, makeComputerMove])

  // Canvas drawing
  useEffect(() => {
    drawGame()
  }, [gameState, selectedDot])

  const startGameTimer = () => {
    gameTimerRef.current = setInterval(() => {
      if (!isPaused) {
        setGameTime((prev) => prev + 1)
      }
    }, 1000)
  }

  const cleanup = () => {
    if (gameTimerRef.current) {
      clearInterval(gameTimerRef.current)
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
    }
    peerConnectionsRef.current.forEach((pc) => pc.close())
    peerConnectionsRef.current.clear()

    gameSignaling.cleanup()
  }

  const setupVoiceChat = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      localStreamRef.current = stream

      stream.getAudioTracks().forEach((track) => {
        track.enabled = false
      })

      setIsVoiceChatActive(true)

      gameConfig.players.forEach((player) => {
        if (player.id !== currentUserId && !player.isComputer) {
          setupPeerConnection(player.id)
        }
      })
    } catch (error) {
      console.error("Error setting up voice chat:", error)
      notificationSystem.error("Could not access microphone for voice chat")
    }
  }

  const setupPeerConnection = (playerId: string) => {
    const peerConnection = createPeerConnection()

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStreamRef.current!)
      })
    }

    peerConnection.ontrack = (event) => {
      const remoteAudio = new Audio()
      remoteAudio.srcObject = event.streams[0]
      remoteAudio.muted = isSpeakerMuted
      remoteAudio.play()
    }

    peerConnectionsRef.current.set(playerId, peerConnection)
  }

  // Get dot position in canvas coordinates
  const getDotPosition = (row: number, col: number) => {
    return {
      x: col * BOX_SIZE + PADDING,
      y: row * BOX_SIZE + PADDING,
    }
  }

  // Get canvas coordinates
  const getCanvasCoordinates = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_SIZE / rect.width
    const scaleY = CANVAS_SIZE / rect.height

    const x = (event.clientX - rect.left) * scaleX
    const y = (event.clientY - rect.top) * scaleY

    return { x, y }
  }

  // Find dot at coordinates
  const findDotAt = (x: number, y: number): { row: number; col: number } | null => {
    if (!gameState) return null

    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        const dotPos = getDotPosition(row, col)
        const distance = Math.sqrt((x - dotPos.x) ** 2 + (y - dotPos.y) ** 2)

        if (distance <= DOT_RADIUS * 2) {
          return { row, col }
        }
      }
    }

    return null
  }

  // Check if two dots are adjacent
  const areDotsAdjacent = (dot1: { row: number; col: number }, dot2: { row: number; col: number }) => {
    const rowDiff = Math.abs(dot1.row - dot2.row)
    const colDiff = Math.abs(dot1.col - dot2.col)
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)
  }

  // Get line info between two adjacent dots
  const getLineInfo = (dot1: { row: number; col: number }, dot2: { row: number; col: number }) => {
    if (!areDotsAdjacent(dot1, dot2)) return null

    const rowDiff = dot2.row - dot1.row
    const colDiff = dot2.col - dot1.col

    if (rowDiff === 1 || rowDiff === -1) {
      // Vertical line
      return {
        type: "vertical" as const,
        row: Math.min(dot1.row, dot2.row),
        col: dot1.col,
      }
    } else {
      // Horizontal line
      return {
        type: "horizontal" as const,
        row: dot1.row,
        col: Math.min(dot1.col, dot2.col),
      }
    }
  }

  // Handle canvas click
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameState || gameState.gameStatus !== "playing" || isPaused || !game) {
        console.log("❌ Cannot make move - game not ready")
        return
      }

      if (!isPlayerTurn) {
        console.log("❌ Not player's turn")
        return
      }

      const coords = getCanvasCoordinates(event)
      if (!coords) return

      const clickedDot = findDotAt(coords.x, coords.y)
      if (!clickedDot) return

      if (!selectedDot) {
        // First click - select a dot
        setSelectedDot(clickedDot)
        console.log("🎯 Selected dot:", clickedDot)
      } else {
        // Second click - try to draw a line
        if (selectedDot.row === clickedDot.row && selectedDot.col === clickedDot.col) {
          // Clicked the same dot - deselect
          setSelectedDot(null)
          return
        }

        if (!areDotsAdjacent(selectedDot, clickedDot)) {
          setSelectedDot(null)
          return
        }

        const lineInfo = getLineInfo(selectedDot, clickedDot)
        if (!lineInfo) {
          setSelectedDot(null)
          return
        }

        const humanPlayer = getHumanPlayer()
        if (!humanPlayer) {
          console.log("❌ No human player found")
          setSelectedDot(null)
          return
        }

        console.log("👤 Player making move:", lineInfo)
        const success = game.makeMove(humanPlayer.id, lineInfo.type, lineInfo.row, lineInfo.col)

        if (success) {
          console.log("✅ Player move successful!")
          const updatedState = game.getGameState()
          setGameState(updatedState)

          gameSounds.playLineDrawn()

          // Check if player completed boxes
          if (updatedState.lastMove && updatedState.lastMove.boxesCompleted > 0) {
            console.log("🎉 Player completed boxes! Gets another turn")
            gameSounds.playBoxCompleted()
            // Player gets another turn - stay on player turn
          } else {
            console.log("🔄 Turn switches to computer")
            gameSounds.playTurnChange()
            setIsPlayerTurn(false) // Switch to computer turn
          }

          // Check game end
          if (updatedState.gameStatus === "finished") {
            const winner = updatedState.players.find((p) => p.id === updatedState.winner)
            if (winner?.id === currentUserId) {
              gameSounds.playWin()
            } else {
              gameSounds.playLose()
            }
            gameSounds.playGameEnd()
          }
        } else {
          console.log("❌ Player move failed")
          gameSounds.playInvalidMove()
        }

        setSelectedDot(null)
      }
    },
    [selectedDot, gameState, game, isPlayerTurn, isPaused, getHumanPlayer, currentUserId],
  )

  // Draw game
  const drawGame = () => {
    const canvas = canvasRef.current
    if (!canvas || !gameState) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set fixed canvas size
    canvas.width = CANVAS_SIZE
    canvas.height = CANVAS_SIZE

    // Clear canvas
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw background
    ctx.fillStyle = "#1e293b"
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw grid lines (faint)
    ctx.strokeStyle = "#374151"
    ctx.lineWidth = 1
    ctx.setLineDash([2, 2])

    // Horizontal grid lines
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (!gameState.horizontalLines[row][col].isDrawn) {
          const startPos = getDotPosition(row, col)
          const endPos = getDotPosition(row, col + 1)

          ctx.beginPath()
          ctx.moveTo(startPos.x, startPos.y)
          ctx.lineTo(endPos.x, endPos.y)
          ctx.stroke()
        }
      }
    }

    // Vertical grid lines
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        if (!gameState.verticalLines[row][col].isDrawn) {
          const startPos = getDotPosition(row, col)
          const endPos = getDotPosition(row + 1, col)

          ctx.beginPath()
          ctx.moveTo(startPos.x, startPos.y)
          ctx.lineTo(endPos.x, endPos.y)
          ctx.stroke()
        }
      }
    }

    ctx.setLineDash([])

    // Draw completed lines
    ctx.lineWidth = 4
    ctx.lineCap = "round"

    // Horizontal lines
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const line = gameState.horizontalLines[row][col]
        if (line.isDrawn) {
          const player = gameState.players.find((p) => p.id === line.playerId)
          ctx.strokeStyle = player?.color || "#3b82f6"

          const startPos = getDotPosition(row, col)
          const endPos = getDotPosition(row, col + 1)

          ctx.beginPath()
          ctx.moveTo(startPos.x, startPos.y)
          ctx.lineTo(endPos.x, endPos.y)
          ctx.stroke()
        }
      }
    }

    // Vertical lines
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        const line = gameState.verticalLines[row][col]
        if (line.isDrawn) {
          const player = gameState.players.find((p) => p.id === line.playerId)
          ctx.strokeStyle = player?.color || "#3b82f6"

          const startPos = getDotPosition(row, col)
          const endPos = getDotPosition(row + 1, col)

          ctx.beginPath()
          ctx.moveTo(startPos.x, startPos.y)
          ctx.lineTo(endPos.x, endPos.y)
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
        if (box.isCompleted && box.playerId) {
          const player = gameState.players.find((p) => p.id === box.playerId)
          if (player) {
            const boxX = col * BOX_SIZE + PADDING
            const boxY = row * BOX_SIZE + PADDING

            ctx.fillStyle = player.color + "40"
            ctx.fillRect(boxX, boxY, BOX_SIZE, BOX_SIZE)

            ctx.fillStyle = player.color
            ctx.fillText(player.initials, boxX + BOX_SIZE / 2, boxY + BOX_SIZE / 2)
          }
        }
      }
    }

    // Draw dots
    for (let row = 0; row <= GRID_SIZE; row++) {
      for (let col = 0; col <= GRID_SIZE; col++) {
        const pos = getDotPosition(row, col)
        const isSelected = selectedDot && selectedDot.row === row && selectedDot.col === col

        // Draw selection highlight
        if (isSelected) {
          ctx.strokeStyle = "#fbbf24"
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.arc(pos.x, pos.y, DOT_RADIUS + 5, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Draw dot
        ctx.fillStyle = isSelected ? "#fbbf24" : "#64748b"
        ctx.strokeStyle = "#1e293b"
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(pos.x, pos.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }

  const toggleMicrophone = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled
      })
      setIsMicMuted(!isMicMuted)
    }
  }

  const toggleSpeaker = () => {
    setIsSpeakerMuted(!isSpeakerMuted)
    document.querySelectorAll("audio").forEach((audio) => {
      audio.muted = !isSpeakerMuted
    })
  }

  const handlePause = () => {
    setIsPaused(!isPaused)
    setShowPauseMenu(!isPaused)
    gameSounds.playTurnChange()
  }

  const handleResume = () => {
    setIsPaused(false)
    setShowPauseMenu(false)
    gameSounds.playTurnChange()
  }

  const handleRestart = () => {
    if (game) {
      game.startGame()
      const updatedState = game.getGameState()
      setGameState(updatedState)
      setIsPlayerTurn(true) // Player always starts first
      setGameTime(0)
      setIsPaused(false)
      setShowPauseMenu(false)
      gameSounds.playGameStart()
    }
  }

  const handleSettings = () => {
    setShowSettingsModal(true)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading game...</p>
        </div>
      </div>
    )
  }

  const currentPlayerName = isPlayerTurn ? "Your Turn" : "AI's Turn"
  const isGameFinished = gameState.gameStatus === "finished"
  const winner = isGameFinished ? gameState.players.find((p) => p.id === gameState.winner) : null

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white relative">
      {/* Header - Mobile optimized */}
      <div className="flex flex-wrap items-center justify-between p-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2 w-full sm:w-auto mb-2 sm:mb-0">
          <h1 className="text-xl font-bold text-cyan-400">Dots & Boxes</h1>

          {/* Player info - Simplified for mobile */}
          <div className="flex items-center gap-2 ml-auto sm:ml-4">
            <div className={`w-3 h-3 rounded-full ${isPlayerTurn ? "bg-blue-500" : "bg-blue-700"}`} />
            <span className="font-medium text-sm">{currentPlayerName}</span>
          </div>
        </div>

        {/* Controls - Moved to right side */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Timer - Moved from left to right */}
          <div className="flex items-center gap-1 text-sm text-gray-400 mr-2">
            <Clock className="w-4 h-4" />
            <span>{formatTime(gameTime)}</span>
          </div>

          {gameConfig.voiceChatEnabled && isVoiceChatActive && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={`w-8 h-8 rounded-full ${
                  isMicMuted ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"
                }`}
                onClick={toggleMicrophone}
              >
                {isMicMuted ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-white" />}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className={`w-8 h-8 rounded-full ${
                  isSpeakerMuted ? "bg-yellow-500 hover:bg-yellow-600" : "bg-slate-700 hover:bg-slate-600"
                }`}
                onClick={toggleSpeaker}
              >
                {isSpeakerMuted ? (
                  <VolumeX className="w-4 h-4 text-white" />
                ) : (
                  <Volume2 className="w-4 h-4 text-white" />
                )}
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600"
            onClick={handlePause}
          >
            {isPaused ? <Play className="w-4 h-4 text-white" /> : <Pause className="w-4 h-4 text-white" />}
          </Button>
        </div>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`border-2 border-slate-600 rounded-lg bg-slate-800 ${
              isPlayerTurn && !isPaused ? "cursor-pointer" : "cursor-not-allowed"
            }`}
            style={{
              width: "100%",
              maxWidth: "400px",
              height: "auto",
              aspectRatio: "1/1",
            }}
          />

          {isPaused && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <Pause className="w-12 h-12 text-white mx-auto mb-2" />
                <p className="text-white font-medium">Game Paused</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pause Menu */}
      {showPauseMenu && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-xs mx-4">
            <h2 className="text-xl font-bold text-center mb-6">Game Paused</h2>

            <div className="space-y-3">
              <Button
                onClick={handleResume}
                className="w-full bg-cyan-500 hover:bg-cyan-600 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" /> Resume Game
              </Button>

              <Button
                onClick={handleRestart}
                className="w-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Restart Game
              </Button>

              <Button
                onClick={handleSettings}
                className="w-full bg-slate-600 hover:bg-slate-700 flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" /> Game Settings
              </Button>

              <Button
                onClick={onExit}
                className="w-full bg-red-500 hover:bg-red-600 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Exit Game
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {isGameFinished && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-full max-w-xs mx-4">
            <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>

            <h2 className="text-xl font-bold text-center mb-2">Game Over!</h2>

            <p className="text-center text-gray-300 mb-4">{winner ? `${winner.name} wins!` : "It's a draw!"}</p>

            <div className="flex justify-between text-sm text-gray-400 mb-6">
              {gameState.players.map((player) => (
                <span key={player.id}>
                  {player.name}: {gameState.scores[player.id] || 0}
                </span>
              ))}
            </div>

            <div className="space-y-3">
              <Button
                onClick={handleRestart}
                className="w-full bg-cyan-500 hover:bg-cyan-600 flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" /> Play Again
              </Button>

              <Button
                onClick={handleSettings}
                className="w-full bg-slate-600 hover:bg-slate-700 flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" /> Game Settings
              </Button>

              <Button
                onClick={onExit}
                className="w-full bg-red-500 hover:bg-red-600 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> Exit Game
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <PlaygroundSetupModal
          isOpen={showSettingsModal}
          onClose={() => setShowSettingsModal(false)}
          onStartGame={(newConfig) => {
            setShowSettingsModal(false)
            // Reset game with new config
            cleanup()
            const players: Player[] = [
              {
                id: currentUserId,
                name: newConfig.players[0]?.name || "You",
                color: "#3b82f6",
                isComputer: false,
                isHost: true,
                initials: (newConfig.players[0]?.name || "You").substring(0, 2).toUpperCase(),
              },
              {
                id: "computer",
                name: "AI",
                color: "#1e40af",
                isComputer: true,
                isHost: false,
                initials: "AI",
              },
            ]
            const newGame = new DotsAndBoxesGame(
              `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              roomId,
              players,
              newConfig.gridSize,
              newConfig.voiceChatEnabled,
            )
            setGame(newGame)
            newGame.startGame()
            setGameState(newGame.getGameState())
            setIsPlayerTurn(true)
            setGameTime(0)
            setIsPaused(false)
            setShowPauseMenu(false)
            gameSounds.playGameStart()
          }}
        />
      )}
    </div>
  )
}
