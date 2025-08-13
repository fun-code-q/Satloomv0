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
  const [gameTime, setGameTime] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [showPauseMenu, setShowPauseMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [isMultiplayer, setIsMultiplayer] = useState(false)

  // Dot selection state
  const [selectedDot, setSelectedDot] = useState<{ row: number; col: number } | null>(null)

  // Voice chat state
  const [isMicMuted, setIsMicMuted] = useState(true)
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false)
  const [isVoiceChatActive, setIsVoiceChatActive] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameTimerRef = useRef<NodeJS.Timeout | null>(null)
  const aiTimerRef = useRef<NodeJS.Timeout | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const gameListenerRef = useRef<(() => void) | null>(null)
  const localGameRef = useRef<DotsAndBoxesGame | null>(null)

  const gameSignaling = GameSignaling.getInstance()
  const gameSounds = GameSounds.getInstance()
  const notificationSystem = NotificationSystem.getInstance()

  const gameId = useRef(
    gameConfig.sharedGameId || `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  ).current

  // Constants - Fixed canvas size
  const CANVAS_SIZE = 400
  const GRID_SIZE = gameConfig?.gridSize || 4
  const BOX_SIZE = (CANVAS_SIZE - 80) / GRID_SIZE
  const PADDING = 40
  const DOT_RADIUS = 15

  // Initialize game
  useEffect(() => {
    console.log("🎮 Initializing game with config:", gameConfig)
    initializeGame()

    return () => {
      cleanup()
    }
  }, [gameConfig, roomId, currentUserId])

  const initializeGame = async () => {
    if (gameConfig.mode === "single") {
      // Single player mode
      initializeSinglePlayerGame()
    } else {
      // Multiplayer mode
      await initializeMultiplayerGame()
    }

    if (gameConfig.voiceChatEnabled) {
      setupVoiceChat()
    }

    startGameTimer()
    gameSounds.playGameStart()
  }

  const initializeSinglePlayerGame = () => {
    console.log("🎮 Initializing single player game")

    const players: Player[] = [
      {
        id: currentUserId,
        name: gameConfig.players[0]?.name || "You",
        color: "#3b82f6",
        isComputer: false,
        isHost: true,
        initials: (gameConfig.players[0]?.name || "You").substring(0, 2).toUpperCase(),
        connected: true,
      },
      {
        id: "computer",
        name: "AI",
        color: "#1e40af",
        isComputer: true,
        isHost: false,
        initials: "AI",
        connected: true,
      },
    ]

    const newGame = new DotsAndBoxesGame(gameId, roomId, players, gameConfig.gridSize, gameConfig.voiceChatEnabled)
    setGame(newGame)
    localGameRef.current = newGame
    newGame.startGame()
    setGameState(newGame.getGameState())
    setIsHost(true)
    setIsMultiplayer(false)
  }

  const initializeMultiplayerGame = async () => {
    console.log("🎮 Initializing multiplayer game")
    setIsMultiplayer(true)

    // Check if we're the host (first player) or joining
    const isGameHost = gameConfig.players[0]?.id === currentUserId || !gameConfig.sharedGameId
    setIsHost(isGameHost)

    if (isGameHost) {
      // Host creates the game
      await createMultiplayerGame()
    } else {
      // Player joins existing game
      await joinMultiplayerGame()
    }
  }

  const createMultiplayerGame = async () => {
    console.log("👑 Creating multiplayer game as host")

    const players: Player[] = gameConfig.players.map((player, index) => {
      if (index === 0) {
        // Host player
        return {
          id: currentUserId,
          name: player.name,
          color: player.color,
          isComputer: false,
          isHost: true,
          initials: player.name.substring(0, 2).toUpperCase(),
          connected: true,
        }
      } else if (player.isAI) {
        // AI player
        return {
          id: `ai_${index}`,
          name: player.name,
          color: player.color,
          isComputer: true,
          isHost: false,
          initials: player.name.substring(0, 2).toUpperCase(),
          connected: true,
        }
      } else {
        // Human player slot - create as placeholder
        return {
          id: `placeholder_${index}`,
          name: `Waiting for Player ${index + 1}`,
          color: player.color,
          isComputer: false,
          isHost: false,
          initials: "??",
          isPlaceholder: true,
          connected: false,
        }
      }
    })

    const newGame = new DotsAndBoxesGame(gameId, roomId, players, gameConfig.gridSize, gameConfig.voiceChatEnabled)
    setGame(newGame)
    localGameRef.current = newGame
    newGame.startGame()

    const initialState = newGame.getGameState()
    setGameState(initialState)

    // Create game in Firebase
    try {
      await gameSignaling.createMultiplayerGame(roomId, gameId, initialState)
      console.log("✅ Multiplayer game created in Firebase")
    } catch (error) {
      console.error("❌ Failed to create multiplayer game:", error)
      notificationSystem.error("Failed to create multiplayer game")
    }

    // Start listening for updates
    setupMultiplayerListener()
  }

  const joinMultiplayerGame = async () => {
    console.log("🤝 Joining multiplayer game")

    try {
      // Try to join the game
      const success = await gameSignaling.joinMultiplayerGame(
        roomId,
        gameId,
        currentUserId,
        gameConfig.players[0]?.name || "Player",
      )

      if (success) {
        console.log("✅ Successfully joined multiplayer game")

        // Get the updated game state
        const gameState = await gameSignaling.getMultiplayerGameState(roomId, gameId)
        if (gameState) {
          // Create local game instance with the current state
          const newGame = new DotsAndBoxesGame(
            gameId,
            roomId,
            gameState.players,
            gameConfig.gridSize,
            gameConfig.voiceChatEnabled,
          )

          // Sync the game state
          Object.assign(newGame.getGameState(), gameState)

          setGame(newGame)
          localGameRef.current = newGame
          setGameState(gameState)

          console.log("🎮 Local game instance created and synced")
        }

        // Start listening for updates
        setupMultiplayerListener()
      } else {
        console.log("❌ Failed to join multiplayer game")
        notificationSystem.error("Failed to join game - no available slots")
      }
    } catch (error) {
      console.error("❌ Error joining multiplayer game:", error)
      notificationSystem.error("Failed to join multiplayer game")
    }
  }

  const setupMultiplayerListener = () => {
    console.log("🔗 Setting up multiplayer game listener")

    const unsubscribe = gameSignaling.listenForMultiplayerGame(roomId, gameId, (updatedState) => {
      console.log("📡 Received multiplayer game state update:", {
        currentPlayerIndex: updatedState.currentPlayerIndex,
        gameStatus: updatedState.gameStatus,
        lastMove: updatedState.lastMove,
        playersCount: updatedState.players?.length,
        activePlayerIds: updatedState.activePlayerIds,
      })

      // Update local game state
      setGameState(updatedState)

      // Sync local game instance if it exists
      if (localGameRef.current) {
        try {
          // Update the local game instance with the new state
          const localGame = localGameRef.current
          const localState = localGame.getGameState()

          // Sync critical game state properties
          Object.assign(localState, {
            players: updatedState.players,
            currentPlayerIndex: updatedState.currentPlayerIndex,
            horizontalLines: updatedState.horizontalLines,
            verticalLines: updatedState.verticalLines,
            boxes: updatedState.boxes,
            scores: updatedState.scores,
            gameStatus: updatedState.gameStatus,
            winner: updatedState.winner,
            lastMove: updatedState.lastMove,
          })

          console.log("🔄 Local game instance synced with Firebase state")
        } catch (error) {
          console.error("❌ Error syncing local game instance:", error)
        }
      }

      // Play appropriate sounds for moves
      if (updatedState.lastMove && updatedState.lastMove.playerId !== currentUserId) {
        gameSounds.playLineDrawn()

        if (updatedState.lastMove.boxesCompleted > 0) {
          gameSounds.playBoxCompleted()
        } else {
          gameSounds.playTurnChange()
        }
      }

      // Check for game end
      if (updatedState.gameStatus === "finished") {
        gameSounds.playGameEnd()
      }
    })

    gameListenerRef.current = unsubscribe
  }

  // Handle AI turns for both single and multiplayer
  useEffect(() => {
    if (!gameState || gameState.gameStatus !== "playing" || isPaused) return

    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    if (!currentPlayer || !currentPlayer.isComputer) return

    console.log(`🤖 AI turn detected for ${currentPlayer.name}`)

    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current)
    }

    aiTimerRef.current = setTimeout(
      () => {
        makeAIMove(currentPlayer)
      },
      1000 + Math.random() * 1000,
    ) // 1-2 second delay
  }, [gameState, isPaused])

  // Canvas drawing
  useEffect(() => {
    drawGame()
  }, [gameState, selectedDot])

  const makeAIMove = useCallback(
    async (aiPlayer: Player) => {
      if (!localGameRef.current || !gameState) return

      console.log(`🤖 ${aiPlayer.name} is making a move...`)

      const localGame = localGameRef.current

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

      if (availableMoves.length === 0) {
        console.log("❌ No available moves for AI")
        return
      }

      // Smart AI strategy
      const completingMoves = availableMoves.filter((move) => wouldCompleteBox(move.type, move.row, move.col))
      let selectedMove

      if (completingMoves.length > 0) {
        selectedMove = completingMoves[0]
        console.log(`🎉 ${aiPlayer.name} found box-completing move:`, selectedMove)
      } else {
        const safeMoves = availableMoves.filter((move) => !wouldGiveOpponentBox(move.type, move.row, move.col))
        if (safeMoves.length > 0) {
          selectedMove = safeMoves[Math.floor(Math.random() * safeMoves.length)]
          console.log(`🛡️ ${aiPlayer.name} chose safe move:`, selectedMove)
        } else {
          selectedMove = availableMoves[Math.floor(Math.random() * availableMoves.length)]
          console.log(`🎲 ${aiPlayer.name} forced to make risky move:`, selectedMove)
        }
      }

      const success = localGame.makeMove(aiPlayer.id, selectedMove.type, selectedMove.row, selectedMove.col)
      if (success) {
        const updatedState = localGame.getGameState()
        setGameState(updatedState)

        // Sync with Firebase for multiplayer games
        if (isMultiplayer && isHost) {
          try {
            await gameSignaling.sendMove(roomId, gameId, updatedState.lastMove!, updatedState)
            console.log("📤 AI move synced to Firebase")
          } catch (error) {
            console.error("❌ Failed to sync AI move to Firebase:", error)
          }
        }

        gameSounds.playLineDrawn()

        if (updatedState.lastMove && updatedState.lastMove.boxesCompleted > 0) {
          console.log(`🎉 ${aiPlayer.name} completed ${updatedState.lastMove.boxesCompleted} box(es)!`)
          gameSounds.playBoxCompleted()
        } else {
          gameSounds.playTurnChange()
        }

        // Check game end
        if (updatedState.gameStatus === "finished") {
          gameSounds.playGameEnd()
        }
      }
    },
    [localGameRef, gameState, GRID_SIZE, isMultiplayer, isHost, roomId, gameId],
  )

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

    if (aiTimerRef.current) {
      clearTimeout(aiTimerRef.current)
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
    }
    peerConnectionsRef.current.forEach((pc) => pc.close())
    peerConnectionsRef.current.clear()

    if (gameListenerRef.current) {
      gameListenerRef.current()
    }

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
        if (player.id !== currentUserId && !player.isAI) {
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
    async (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameState || gameState.gameStatus !== "playing" || isPaused || !localGameRef.current) {
        console.log("❌ Cannot make move - game not ready")
        return
      }

      const currentPlayer = gameState.players[gameState.currentPlayerIndex]
      if (!currentPlayer) return

      // Skip placeholder players
      if (currentPlayer.isPlaceholder) {
        console.log("⏭️ Skipping placeholder player turn")
        return
      }

      // Don't allow moves during AI turn
      if (currentPlayer.isComputer) {
        console.log(`❌ It's ${currentPlayer.name}'s turn (AI)`)
        return
      }

      // In multiplayer, only allow moves for the current human player
      if (isMultiplayer && currentPlayer.id !== currentUserId) {
        console.log("❌ Not your turn")
        notificationSystem.info(`It's ${currentPlayer.name}'s turn`)
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

        console.log(`👤 ${currentPlayer.name} making move:`, lineInfo)
        const success = localGameRef.current.makeMove(currentPlayer.id, lineInfo.type, lineInfo.row, lineInfo.col)

        if (success) {
          console.log("✅ Player move successful!")
          const updatedState = localGameRef.current.getGameState()
          setGameState(updatedState)

          // Sync with Firebase for multiplayer games
          if (isMultiplayer) {
            try {
              await gameSignaling.sendMove(roomId, gameId, updatedState.lastMove!, updatedState)
              console.log("📤 Player move synced to Firebase")
            } catch (error) {
              console.error("❌ Failed to sync player move to Firebase:", error)
            }
          }

          gameSounds.playLineDrawn()

          // Check if player completed boxes
          if (updatedState.lastMove && updatedState.lastMove.boxesCompleted > 0) {
            console.log(`🎉 ${currentPlayer.name} completed ${updatedState.lastMove.boxesCompleted} box(es)!`)
            gameSounds.playBoxCompleted()
          } else {
            gameSounds.playTurnChange()
          }

          // Check game end
          if (updatedState.gameStatus === "finished") {
            gameSounds.playGameEnd()
          }
        } else {
          console.log("❌ Player move failed")
          gameSounds.playInvalidMove()
        }

        setSelectedDot(null)
      }
    },
    [selectedDot, gameState, localGameRef, isPaused, isMultiplayer, currentUserId, roomId, gameId],
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
    if (localGameRef.current) {
      localGameRef.current.startGame()
      const updatedState = localGameRef.current.getGameState()
      setGameState(updatedState)
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

  const getCurrentPlayerName = () => {
    if (!gameState || gameState.gameStatus !== "playing") return ""
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    return currentPlayer?.name || ""
  }

  const getStatusText = () => {
    if (!gameState) return "Loading..."

    if (gameState.gameStatus === "finished") {
      if (gameState.winner) {
        const winner = gameState.players.find((p) => p.id === gameState.winner)
        return `${winner?.name || "Unknown"} wins!`
      }
      return "Game ended in a tie!"
    }

    if (isPaused) return "Game Paused"

    const currentPlayer = gameState.players[gameState.currentPlayerIndex]
    if (!currentPlayer) return "Loading..."

    if (currentPlayer.isComputer) {
      return `${currentPlayer.name} is thinking...`
    }

    if (currentPlayer.isPlaceholder) {
      return `Waiting for ${currentPlayer.name}...`
    }

    return `${currentPlayer.name}'s turn`
  }

  const getGameModeText = () => {
    if (gameConfig.mode === "single") {
      return "vs AI"
    } else {
      const aiCount = gameConfig.players.filter((p) => p.isAI).length
      const humanCount = gameConfig.players.length - aiCount

      if (aiCount === 0) {
        return "Multiplayer"
      } else if (humanCount === 1) {
        return `vs ${aiCount} AI`
      } else {
        return `${humanCount} Players + ${aiCount} AI`
      }
    }
  }

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p>Loading game...</p>
          {isMultiplayer && <p className="text-sm text-gray-400 mt-2">Connecting to multiplayer game...</p>}
        </div>
      </div>
    )
  }

  const isGameFinished = gameState.gameStatus === "finished"
  const winner = isGameFinished ? gameState.players.find((p) => p.id === gameState.winner) : null

  return (
    <div className="h-full flex flex-col bg-slate-900 text-white relative">
      {/* Header - Mobile optimized */}
      <div className="flex flex-wrap items-center justify-between p-2 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2 w-full sm:w-auto mb-2 sm:mb-0">
          <h1 className="text-xl font-bold text-cyan-400">Dots & Boxes</h1>
          <span className="text-sm text-gray-400">- {getGameModeText()}</span>
          {isMultiplayer && <span className="text-xs text-cyan-400">{isHost ? "(Host)" : "(Player)"}</span>}

          {/* Current player info */}
          <div className="flex items-center gap-2 ml-auto sm:ml-4">
            <div
              className={`w-3 h-3 rounded-full`}
              style={{ backgroundColor: gameState.players[gameState.currentPlayerIndex]?.color || "#64748b" }}
            />
            <span className="font-medium text-sm">{getCurrentPlayerName()}</span>
            {gameState.players[gameState.currentPlayerIndex]?.isComputer && (
              <span className="text-xs text-gray-400">(AI)</span>
            )}
            {gameState.players[gameState.currentPlayerIndex]?.isPlaceholder && (
              <span className="text-xs text-yellow-400">(Waiting)</span>
            )}
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

      {/* Game Status */}
      <div className="p-4 bg-slate-800/50 text-center">
        <div className="text-lg font-medium">{getStatusText()}</div>

        {/* Scores */}
        <div className="flex justify-center gap-6 mt-2 flex-wrap">
          {gameState.players.map((player) => (
            <div key={player.id} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: player.color }} />
              <span className="text-sm">
                {player.name}: {gameState.scores[player.id] || 0}
                {player.isComputer && <span className="text-xs text-gray-400 ml-1">(AI)</span>}
                {player.isPlaceholder && <span className="text-xs text-yellow-400 ml-1">(Waiting)</span>}
                {!player.connected && !player.isPlaceholder && (
                  <span className="text-xs text-red-400 ml-1">(Disconnected)</span>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Game Canvas */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="relative">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`border-2 border-slate-600 rounded-lg bg-slate-800 ${
              gameState.players[gameState.currentPlayerIndex] &&
              !gameState.players[gameState.currentPlayerIndex].isComputer &&
              !gameState.players[gameState.currentPlayerIndex].isPlaceholder &&
              gameState.players[gameState.currentPlayerIndex].id === currentUserId &&
              !isPaused
                ? "cursor-pointer"
                : "cursor-not-allowed"
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

              {!isMultiplayer && (
                <Button
                  onClick={handleRestart}
                  className="w-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Restart Game
                </Button>
              )}

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

            <div className="space-y-2 mb-6">
              {gameState.players
                .sort((a, b) => (gameState.scores[b.id] || 0) - (gameState.scores[a.id] || 0))
                .map((player, index) => (
                  <div key={player.id} className="flex justify-between items-center text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-gray-400">#{index + 1}</span>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: player.color }} />
                      {player.name}
                      {player.isComputer && <span className="text-xs text-gray-400">(AI)</span>}
                    </span>
                    <span className="font-bold">{gameState.scores[player.id] || 0}</span>
                  </div>
                ))}
            </div>

            <div className="space-y-3">
              {!isMultiplayer && (
                <Button
                  onClick={handleRestart}
                  className="w-full bg-cyan-500 hover:bg-cyan-600 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Play Again
                </Button>
              )}

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
            // Reset game with new config - this would need to be implemented
            // For now, just close the modal
          }}
        />
      )}
    </div>
  )
}
