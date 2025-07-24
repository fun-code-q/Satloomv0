import { database } from "@/lib/firebase"
import { ref, set, onValue, remove, push, get } from "firebase/database"
import type { GameState, Move } from "./dots-and-boxes-game"

export class GameSignaling {
  private static instance: GameSignaling
  private gameListeners: Map<string, () => void> = new Map()
  private listeners: Map<string, () => void> = new Map()

  static getInstance(): GameSignaling {
    if (!GameSignaling.instance) {
      GameSignaling.instance = new GameSignaling()
    }
    return GameSignaling.instance
  }

  // Create a new game
  async createGame(roomId: string, gameState: GameState): Promise<void> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    try {
      const gameRef = ref(database, `games/${roomId}/${gameState.id}`)
      const cleanState = this.cleanGameState(gameState)

      console.log("🔥 Creating game in Firebase:", {
        gameId: gameState.id,
        roomId,
        players: gameState.players.length,
        status: gameState.gameStatus,
        gameMode: gameState.gameMode,
        firebasePath: `games/${roomId}/${gameState.id}`,
      })

      await set(gameRef, cleanState)
      console.log("✅ Game created successfully in Firebase")
    } catch (error) {
      console.error("❌ Error creating game:", error)
      throw error
    }
  }

  // Update game state with real-time synchronization
  async updateGame(roomId: string, gameState: GameState): Promise<void> {
    if (!database) {
      console.warn("Firebase database not initialized, cannot update game")
      return
    }

    try {
      const gameRef = ref(database, `games/${roomId}/${gameState.id}`)
      const cleanState = this.cleanGameState(gameState)

      console.log("🔄 Updating Firebase with game state:", {
        gameId: gameState.id,
        roomId,
        currentPlayerIndex: gameState.currentPlayerIndex,
        gameStatus: gameState.gameStatus,
        lastMoveTimestamp: gameState.lastMove?.timestamp,
        gameMode: gameState.gameMode,
        firebasePath: `games/${roomId}/${gameState.id}`,
      })

      await set(gameRef, cleanState)
      console.log("✅ Firebase update successful")
    } catch (error) {
      console.error("❌ Firebase update failed:", error)
      throw error
    }
  }

  // Join an existing game
  async joinGame(roomId: string, gameId: string, playerId: string, playerName: string): Promise<boolean> {
    if (!database) {
      console.warn("Firebase database not initialized")
      return false
    }

    try {
      const gameRef = ref(database, `games/${roomId}/${gameId}`)
      console.log("🔍 Looking for game at Firebase path:", `games/${roomId}/${gameId}`)

      // Try to get the game state with retries
      let gameState = null
      let attempts = 0
      const maxAttempts = 10

      while (!gameState && attempts < maxAttempts) {
        attempts++
        console.log(`🔄 Attempt ${attempts}/${maxAttempts} to find game`)

        const snapshot = await get(gameRef)
        if (snapshot.exists()) {
          gameState = snapshot.val()
          console.log("✅ Found game in Firebase:", {
            gameId: gameState.id,
            roomId: gameState.roomId,
            playersCount: gameState.players?.length,
            gameMode: gameState.gameMode,
          })
        } else {
          console.log(`❌ Game not found, waiting 500ms before retry...`)
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }

      if (!gameState) {
        console.error("❌ Game not found in Firebase after all retries")
        return false
      }

      console.log("🎮 Joining game:", {
        gameId,
        roomId,
        playerId,
        playerName,
        currentPlayers: gameState.players?.length || 0,
        gameMode: gameState.gameMode,
      })

      // Find an available slot (player that's not computer and not host)
      let playerAdded = false
      const updatedPlayers = gameState.players.map((player: any) => {
        if (
          !player.isComputer &&
          !player.isHost &&
          !playerAdded &&
          (!player.connected || player.id === "placeholder")
        ) {
          playerAdded = true
          console.log("🔄 Updating player slot:", {
            oldPlayer: { id: player.id, name: player.name },
            newPlayer: { id: playerId, name: playerName },
          })
          return {
            ...player,
            id: playerId,
            name: playerName,
            initials: playerName.substring(0, 2).toUpperCase(),
            connected: true,
          }
        }
        return player
      })

      if (!playerAdded) {
        console.error("❌ No available slots in game")
        return false
      }

      const updatedGameState = {
        ...gameState,
        players: updatedPlayers,
      }

      console.log("🔄 Updating Firebase with joined player:", {
        gameId,
        roomId,
        playerId,
        playerName,
        updatedPlayers: updatedPlayers.map((p: any) => ({ id: p.id, name: p.name, connected: p.connected })),
      })

      await set(gameRef, this.cleanGameState(updatedGameState))
      console.log("✅ Successfully joined game and updated Firebase")
      return true
    } catch (error) {
      console.error("❌ Error joining game:", error)
      return false
    }
  }

  // Listen for game updates with real-time synchronization
  listenForGame(roomId: string, gameId: string, onUpdate: (gameState: GameState) => void): () => void {
    if (!database) {
      console.warn("Firebase database not initialized, game listening disabled")
      return () => {}
    }

    const gameRef = ref(database, `games/${roomId}/${gameId}`)
    const listenerId = `${roomId}_${gameId}`
    const firebasePath = `games/${roomId}/${gameId}`

    console.log("🔗 Setting up Firebase listener for:", firebasePath)

    const unsubscribe = onValue(
      gameRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const gameState = snapshot.val()
          console.log("📡 Firebase update received:", {
            firebasePath,
            gameId: gameState.id,
            roomId: gameState.roomId,
            currentPlayerIndex: gameState.currentPlayerIndex,
            gameStatus: gameState.gameStatus,
            gameMode: gameState.gameMode,
            playersCount: gameState.players?.length || 0,
            lastMoveTimestamp: gameState.lastMove?.timestamp,
            lastMovePlayer: gameState.lastMove?.playerName,
          })
          onUpdate(gameState)
        } else {
          console.log("❌ No game state in Firebase snapshot for path:", firebasePath)
        }
      },
      (error) => {
        console.error("❌ Firebase listener error for path:", firebasePath, error)
      },
    )

    // Store the unsubscribe function
    this.gameListeners.set(listenerId, unsubscribe)

    return () => {
      console.log("🔌 Unsubscribing from Firebase listener:", firebasePath)
      unsubscribe()
      this.gameListeners.delete(listenerId)
    }
  }

  // Send a move with real-time synchronization
  async sendMove(roomId: string, gameId: string, move: Move): Promise<void> {
    if (!database) return

    try {
      console.log("📤 Sending move to Firebase:", {
        gameId,
        roomId,
        move: `${move.type} ${move.row},${move.col}`,
        player: move.playerName,
        boxesCompleted: move.boxesCompleted,
      })

      const moveRef = push(ref(database, `games/${roomId}/${gameId}/moves`))
      await set(moveRef, move)
      console.log("✅ Move sent successfully")
    } catch (error) {
      console.error("❌ Error sending move:", error)
    }
  }

  // Update player connection status
  async updatePlayerConnection(roomId: string, gameId: string, playerId: string, connected: boolean): Promise<void> {
    if (!database) return

    try {
      const gameRef = ref(database, `games/${roomId}/${gameId}`)
      const snapshot = await get(gameRef)

      if (snapshot.exists()) {
        const gameState = snapshot.val()
        const updatedPlayers = gameState.players.map((player: any) => {
          if (player.id === playerId) {
            return { ...player, connected }
          }
          return player
        })

        const updatedGameState = {
          ...gameState,
          players: updatedPlayers,
        }

        await set(gameRef, this.cleanGameState(updatedGameState))
        console.log(`🔗 Player ${playerId} connection status updated:`, connected)
      }
    } catch (error) {
      console.error("❌ Error updating player connection:", error)
    }
  }

  // Listen for moves with real-time synchronization
  listenForMoves(roomId: string, gameId: string, onMove: (move: Move) => void): () => void {
    if (!database) {
      console.warn("Firebase database not initialized, move listening disabled")
      return () => {}
    }

    const movesRef = ref(database, `games/${roomId}/${gameId}/moves`)
    const listenerId = `${roomId}_${gameId}_moves`

    console.log("🔗 Setting up move listener for:", `games/${roomId}/${gameId}/moves`)

    const unsubscribe = onValue(movesRef, (snapshot) => {
      const moves = snapshot.val()
      if (moves) {
        // Get the latest move
        const moveKeys = Object.keys(moves)
        const latestMoveKey = moveKeys[moveKeys.length - 1]
        const latestMove = moves[latestMoveKey]

        console.log("📡 New move received:", {
          move: `${latestMove.type} ${latestMove.row},${latestMove.col}`,
          player: latestMove.playerName,
          boxesCompleted: latestMove.boxesCompleted,
        })

        onMove(latestMove)
      }
    })

    this.gameListeners.set(listenerId, unsubscribe)
    return () => {
      console.log("🔌 Unsubscribing from move listener")
      unsubscribe()
      this.gameListeners.delete(listenerId)
    }
  }

  // End game
  async endGame(roomId: string, gameId: string): Promise<void> {
    if (!database) return

    try {
      const gameRef = ref(database, `games/${roomId}/${gameId}`)
      await remove(gameRef)
      console.log("🗑️ Game removed from Firebase")
    } catch (error) {
      console.error("❌ Error ending game:", error)
    }
  }

  // Clean game state for Firebase (remove functions and complex objects)
  private cleanGameState(gameState: GameState): any {
    try {
      // Create a deep copy of the game state
      const cleanState = JSON.parse(JSON.stringify(gameState))

      // Handle undefined winner property
      if (cleanState.winner === undefined) {
        cleanState.winner = null // Replace undefined with null for Firebase
      }

      // Ensure all nested objects are properly serializable
      return {
        ...cleanState,
        grid: cleanState.grid || [],
        horizontalLines: cleanState.horizontalLines || [],
        verticalLines: cleanState.verticalLines || [],
        boxes: cleanState.boxes || [],
        players: cleanState.players || [],
        scores: cleanState.scores || {},
        gameMode: cleanState.gameMode || "single",
      }
    } catch (error) {
      console.error("❌ Error cleaning game state:", error)
      return gameState
    }
  }

  // Clean up all listeners
  cleanup(): void {
    console.log("🧹 Cleaning up all game listeners")
    this.gameListeners.forEach((unsubscribe, listenerId) => {
      try {
        console.log("🔌 Cleaning up listener:", listenerId)
        unsubscribe()
      } catch (error) {
        console.error("Error cleaning up listener:", error)
      }
    })
    this.gameListeners.clear()

    this.listeners.forEach((unsubscribe, listenerId) => {
      try {
        console.log("🔌 Cleaning up listener:", listenerId)
        unsubscribe()
      } catch (error) {
        console.error("Error cleaning up listener:", error)
      }
    })
    this.listeners.clear()
  }
}
