import { database } from "@/lib/firebase"
import { ref, set, onValue, remove, get, update, off } from "firebase/database"
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

  // Create a new multiplayer game
  async createMultiplayerGame(roomId: string, gameId: string, gameState: GameState): Promise<void> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    try {
      const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
      const cleanState = this.cleanGameState(gameState)

      console.log("🔥 Creating multiplayer game in Firebase:", {
        gameId: gameState.id,
        roomId,
        players: gameState.players.length,
        status: gameState.gameStatus,
        firebasePath: `multiplayer-games/${roomId}/${gameId}`,
      })

      await set(gameRef, {
        ...cleanState,
        createdAt: Date.now(),
        lastUpdated: Date.now(),
        hostId: gameState.players.find((p) => p.isHost)?.id,
        activePlayerIds: gameState.players.filter((p) => !p.isPlaceholder).map((p) => p.id),
      })

      console.log("✅ Multiplayer game created successfully in Firebase")
    } catch (error) {
      console.error("❌ Error creating multiplayer game:", error)
      throw error
    }
  }

  // Update game state with real-time synchronization
  async updateGameState(roomId: string, gameId: string, gameState: GameState): Promise<void> {
    if (!database) {
      console.warn("Firebase database not initialized, cannot update game")
      return
    }

    try {
      const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
      const cleanState = this.cleanGameState(gameState)

      console.log("🔄 Updating Firebase with game state:", {
        gameId,
        roomId,
        currentPlayerIndex: gameState.currentPlayerIndex,
        currentPlayer: gameState.players[gameState.currentPlayerIndex]?.name,
        gameStatus: gameState.gameStatus,
        lastMoveTimestamp: gameState.lastMove?.timestamp,
        players: gameState.players.map((p) => ({ id: p.id, name: p.name, isPlaceholder: p.isPlaceholder })),
        firebasePath: `multiplayer-games/${roomId}/${gameId}`,
      })

      await update(gameRef, {
        ...cleanState,
        lastUpdated: Date.now(),
        activePlayerIds: gameState.players.filter((p) => !p.isPlaceholder).map((p) => p.id),
      })

      console.log("✅ Firebase game state update successful")
    } catch (error) {
      console.error("❌ Firebase game state update failed:", error)
      throw error
    }
  }

  // Send a move to Firebase
  async sendMove(roomId: string, gameId: string, move: Move, gameState: GameState): Promise<void> {
    if (!database) return

    try {
      console.log("📤 Sending move to Firebase:", {
        gameId,
        roomId,
        move: `${move.type} ${move.row},${move.col}`,
        player: move.playerName,
        playerId: move.playerId,
        boxesCompleted: move.boxesCompleted,
      })

      const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
      const cleanState = this.cleanGameState(gameState)

      await update(gameRef, {
        ...cleanState,
        lastMove: move,
        lastUpdated: Date.now(),
      })

      console.log("✅ Move sent successfully")
    } catch (error) {
      console.error("❌ Error sending move:", error)
    }
  }

  // Join an existing multiplayer game
  async joinMultiplayerGame(roomId: string, gameId: string, playerId: string, playerName: string): Promise<boolean> {
    if (!database) {
      console.warn("Firebase database not initialized")
      return false
    }

    try {
      const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
      console.log("🔍 Looking for multiplayer game at Firebase path:", `multiplayer-games/${roomId}/${gameId}`)

      const snapshot = await get(gameRef)
      if (!snapshot.exists()) {
        console.log("❌ Multiplayer game not found in Firebase")
        return false
      }

      const gameState = snapshot.val()
      console.log("🎮 Joining existing multiplayer game:", {
        gameId,
        roomId,
        playerId,
        playerName,
        currentPlayers: gameState.players?.length || 0,
        existingPlayers: gameState.players?.map((p: any) => ({
          id: p.id,
          name: p.name,
          isPlaceholder: p.isPlaceholder,
        })),
      })

      // Find an available placeholder slot
      let playerAdded = false
      let slotIndex = -1
      const updatedPlayers = gameState.players.map((player: any, index: number) => {
        if (player.isPlaceholder && !player.isComputer && !playerAdded && player.id.startsWith("placeholder_")) {
          playerAdded = true
          slotIndex = index
          console.log("🔄 Updating player slot:", {
            slotIndex: index,
            oldPlayer: { id: player.id, name: player.name },
            newPlayer: { id: playerId, name: playerName },
          })
          return {
            ...player,
            id: playerId,
            name: playerName,
            initials: playerName.substring(0, 2).toUpperCase(),
            isPlaceholder: false,
            connected: true,
          }
        }
        // If the player is already in the game (rejoining), update their connection status
        if (player.id === playerId) {
          playerAdded = true
          return {
            ...player,
            name: playerName,
            connected: true,
          }
        }
        return player
      })

      if (!playerAdded) {
        console.log("❌ No available slots for new player")
        return false
      }

      // Update scores object with new player ID
      const updatedScores = { ...gameState.scores }
      if (slotIndex >= 0) {
        const oldPlayerId = gameState.players[slotIndex].id
        if (oldPlayerId !== playerId) {
          delete updatedScores[oldPlayerId]
          updatedScores[playerId] = 0
        }
      }

      const updatedGameState = {
        ...gameState,
        players: updatedPlayers,
        scores: updatedScores,
        activePlayerIds: updatedPlayers.filter((p: any) => !p.isPlaceholder).map((p: any) => p.id),
        lastUpdated: Date.now(),
      }

      console.log("🔄 Updating Firebase with joined player:", {
        gameId,
        roomId,
        playerId,
        playerName,
        slotIndex,
        updatedPlayers: updatedPlayers.map((p: any) => ({
          id: p.id,
          name: p.name,
          connected: p.connected,
          isPlaceholder: p.isPlaceholder,
        })),
      })

      await set(gameRef, updatedGameState)
      console.log("✅ Successfully joined multiplayer game and updated Firebase")
      return true
    } catch (error) {
      console.error("❌ Error joining multiplayer game:", error)
      return false
    }
  }

  // Listen for multiplayer game updates with real-time synchronization
  listenForMultiplayerGame(roomId: string, gameId: string, onUpdate: (gameState: GameState) => void): () => void {
    if (!database) {
      console.warn("Firebase database not initialized, game listening disabled")
      return () => {}
    }

    const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
    const listenerId = `multiplayer_${roomId}_${gameId}`
    const firebasePath = `multiplayer-games/${roomId}/${gameId}`

    console.log("🔗 Setting up Firebase listener for multiplayer game:", firebasePath)

    const unsubscribe = onValue(
      gameRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const gameState = snapshot.val()
          onUpdate(gameState)
        } else {
          console.log("❌ No multiplayer game state in Firebase snapshot for path:", firebasePath)
        }
      },
      (error) => {
        console.error("❌ Firebase multiplayer game listener error for path:", firebasePath, error)
      },
    )

    this.gameListeners.set(listenerId, unsubscribe)

    return () => {
      console.log("🔌 Unsubscribing from Firebase multiplayer game listener:", firebasePath)
      unsubscribe()
      this.gameListeners.delete(listenerId)
    }
  }

  // Update player connection status
  async updatePlayerConnection(roomId: string, gameId: string, playerId: string, connected: boolean): Promise<void> {
    if (!database) return

    try {
      const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
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
          activePlayerIds: updatedPlayers.filter((p: any) => !p.isPlaceholder).map((p: any) => p.id),
          lastUpdated: Date.now(),
        }

        await set(gameRef, updatedGameState)
        console.log(`🔗 Player ${playerId} connection status updated:`, connected)
      }
    } catch (error) {
      console.error("❌ Error updating player connection:", error)
    }
  }

  // Check if a multiplayer game exists
  async checkMultiplayerGameExists(roomId: string, gameId: string): Promise<boolean> {
    if (!database) return false

    try {
      const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
      const snapshot = await get(gameRef)
      return snapshot.exists()
    } catch (error) {
      console.error("❌ Error checking multiplayer game existence:", error)
      return false
    }
  }

  // Get multiplayer game state
  async getMultiplayerGameState(roomId: string, gameId: string): Promise<GameState | null> {
    if (!database) return null

    try {
      const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
      const snapshot = await get(gameRef)

      if (snapshot.exists()) {
        return snapshot.val()
      }
      return null
    } catch (error) {
      console.error("❌ Error getting multiplayer game state:", error)
      return null
    }
  }

  // End multiplayer game
  async endMultiplayerGame(roomId: string, gameId: string): Promise<void> {
    if (!database) return

    try {
      const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
      await remove(gameRef)
      console.log("🗑️ Multiplayer game removed from Firebase")
    } catch (error) {
      console.error("❌ Error ending multiplayer game:", error)
    }
  }

  // FIXED: Enhanced host disconnection detection
  listenForGameHostDisconnection(roomId: string, gameId: string, onHostLeft: () => void): () => void {
    if (!database) {
      console.warn("Firebase database not initialized")
      return () => {}
    }

    const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
    const listenerId = `host_disconnect_${roomId}_${gameId}`

    console.log("🔗 Setting up enhanced host disconnection listener for game:", gameId)

    const unsubscribe = onValue(
      gameRef,
      (snapshot) => {
        if (!snapshot.exists()) {
          // Game was deleted - host definitely left
          console.log("🗑️ Game deleted from Firebase - host left the game")
          onHostLeft()
          return
        }

        const gameState = snapshot.val()
        
        // Check if game has ended status
        if (gameState.gameStatus === 'ended' || gameState.gameStatus === 'cancelled') {
          console.log("🎮 Game ended by host - redirecting players")
          onHostLeft()
          return
        }

        // Check if host player exists and is connected
        const hostPlayer = gameState.players?.find((p: any) => p.isHost)
        
        if (!hostPlayer) {
          console.log("❌ No host player found in game - ending for all players")
          onHostLeft()
          return
        }

        // Check if host is disconnected
        if (hostPlayer.connected === false) {
          console.log("🔌 Host player disconnected - ending game for all players")
          onHostLeft()
          return
        }

        // Additional check: if host ID is not in active players
        if (gameState.activePlayerIds && !gameState.activePlayerIds.includes(hostPlayer.id)) {
          console.log("🚫 Host not in active players - game should end")
          onHostLeft()
          return
        }

        console.log("✅ Host is still connected and active")
      },
      (error) => {
        console.error("❌ Host disconnection listener error:", error)
      },
    )

    this.listeners.set(listenerId, unsubscribe)

    return () => {
      console.log("🔌 Unsubscribing from host disconnection listener")
      unsubscribe()
      this.listeners.delete(listenerId)
    }
  }

  // NEW: Method to handle host leaving gracefully
  async hostLeaveGame(roomId: string, gameId: string, hostPlayerId: string): Promise<void> {
    if (!database) return

    try {
      console.log("👋 Host is leaving the game, cleaning up...")
      
      // First mark host as disconnected
      await this.updatePlayerConnection(roomId, gameId, hostPlayerId, false)
      
      // Set game status to ended
      const gameRef = ref(database, `multiplayer-games/${roomId}/${gameId}`)
      await update(gameRef, {
        gameStatus: 'ended',
        endedBy: 'host',
        endTime: Date.now(),
        lastUpdated: Date.now()
      })
      
      console.log("✅ Host leave handled gracefully")
      
      // Remove the game after a short delay to allow clients to detect the change
      setTimeout(async () => {
        try {
          await this.endMultiplayerGame(roomId, gameId)
        } catch (error) {
          console.error("Error removing game after host left:", error)
        }
      }, 2000)
      
    } catch (error) {
      console.error("❌ Error handling host leave:", error)
    }
  }

  // Legacy methods for backward compatibility
  async createGame(roomId: string, gameState: GameState): Promise<void> {
    return this.createMultiplayerGame(roomId, gameState.id, gameState)
  }

  async updateGame(roomId: string, gameState: GameState): Promise<void> {
    return this.updateGameState(roomId, gameState.id, gameState)
  }

  async joinGame(roomId: string, gameId: string, playerId: string, playerName: string): Promise<boolean> {
    return this.joinMultiplayerGame(roomId, gameId, playerId, playerName)
  }

  listenForGame(roomId: string, gameId: string, onUpdate: (gameState: GameState) => void): () => void {
    return this.listenForMultiplayerGame(roomId, gameId, onUpdate)
  }

  async endGame(roomId: string, gameId: string): Promise<void> {
    return this.endMultiplayerGame(roomId, gameId)
  }

  // Clean game state for Firebase (remove functions and complex objects)
  private cleanGameState(gameState: GameState): any {
    try {
      const cleanState = JSON.parse(JSON.stringify(gameState))

      if (cleanState.winner === undefined) {
        cleanState.winner = null
      }

      return {
        ...cleanState,
        grid: cleanState.grid || [],
        horizontalLines: cleanState.horizontalLines || [],
        verticalLines: cleanState.verticalLines || [],
        boxes: cleanState.boxes || [],
        players: cleanState.players || [],
        scores: cleanState.scores || {},
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
