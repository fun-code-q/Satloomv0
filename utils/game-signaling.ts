import { database } from "@/lib/firebase"
import { ref, set, onValue, remove, push, serverTimestamp } from "firebase/database"
import type { GameState, Move } from "./dots-and-boxes-game"

export class GameSignaling {
  private static instance: GameSignaling
  private gameListeners: Array<() => void> = []

  static getInstance(): GameSignaling {
    if (!GameSignaling.instance) {
      GameSignaling.instance = new GameSignaling()
    }
    return GameSignaling.instance
  }

  // Create a new game
  async createGame(roomId: string, gameId: string, gameState: GameState): Promise<void> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const gameRef = ref(database, `games/${roomId}/${gameId}`)
    const cleanedState = this.cleanGameState(gameState)

    // Add host status information
    await set(gameRef, {
      ...cleanedState,
      hostActive: true,
      lastUpdated: serverTimestamp(),
    })
  }

  // Update game state
  async updateGame(roomId: string, gameId: string, gameState: GameState): Promise<void> {
    if (!database) return

    const gameRef = ref(database, `games/${roomId}/${gameId}`)
    const cleanedState = this.cleanGameState(gameState)

    await set(gameRef, {
      ...cleanedState,
      lastUpdated: serverTimestamp(),
    })
  }

  // Set host status (active/inactive)
  async setHostStatus(roomId: string, gameId: string, isActive: boolean): Promise<void> {
    if (!database) return

    const hostStatusRef = ref(database, `games/${roomId}/${gameId}/hostActive`)
    await set(hostStatusRef, isActive)
  }

  // Listen for host status changes
  listenForHostStatus(roomId: string, gameId: string, onStatusChange: (isActive: boolean) => void) {
    if (!database) {
      console.warn("Firebase database not initialized, host status listening disabled")
      return () => {}
    }

    const hostStatusRef = ref(database, `games/${roomId}/${gameId}/hostActive`)

    const unsubscribe = onValue(hostStatusRef, (snapshot) => {
      const isActive = snapshot.val()
      onStatusChange(isActive)
    })

    this.gameListeners.push(unsubscribe)
    return unsubscribe
  }

  // Send a move
  async sendMove(roomId: string, gameId: string, move: Move): Promise<void> {
    if (!database) return

    const moveRef = push(ref(database, `games/${roomId}/${gameId}/moves`))
    await set(moveRef, move)
  }

  // Listen for game updates
  listenForGame(roomId: string, gameId: string, onUpdate: (gameState: GameState) => void) {
    if (!database) {
      console.warn("Firebase database not initialized, game listening disabled")
      return () => {}
    }

    const gameRef = ref(database, `games/${roomId}/${gameId}`)

    const unsubscribe = onValue(gameRef, (snapshot) => {
      const gameState = snapshot.val()
      if (gameState) {
        // Remove Firebase-specific fields before passing to game logic
        const { hostActive, lastUpdated, ...cleanGameState } = gameState
        onUpdate(cleanGameState as GameState)
      }
    })

    this.gameListeners.push(unsubscribe)
    return unsubscribe
  }

  // Listen for moves
  listenForMoves(roomId: string, gameId: string, onMove: (move: Move) => void) {
    if (!database) {
      console.warn("Firebase database not initialized, move listening disabled")
      return () => {}
    }

    const movesRef = ref(database, `games/${roomId}/${gameId}/moves`)

    const unsubscribe = onValue(movesRef, (snapshot) => {
      const moves = snapshot.val()
      if (moves) {
        // Get the latest move
        const moveKeys = Object.keys(moves)
        const latestMoveKey = moveKeys[moveKeys.length - 1]
        const latestMove = moves[latestMoveKey]
        onMove(latestMove)
      }
    })

    this.gameListeners.push(unsubscribe)
    return unsubscribe
  }

  // End game
  async endGame(roomId: string, gameId: string): Promise<void> {
    if (!database) return

    const gameRef = ref(database, `games/${roomId}/${gameId}`)
    await remove(gameRef)
  }

  // Clean game state for Firebase (remove functions and complex objects)
  private cleanGameState(gameState: GameState): any {
    // Create a deep copy of the game state
    const cleanState = JSON.parse(JSON.stringify(gameState))

    // Handle undefined winner property
    if (cleanState.winner === undefined) {
      cleanState.winner = null // Replace undefined with null for Firebase
    }

    // Add moveCount if it doesn't exist
    if (cleanState.moveCount === undefined) {
      cleanState.moveCount = 0
    }

    // Ensure all nested objects are properly serializable
    return {
      ...cleanState,
      grid: cleanState.grid,
      horizontalLines: cleanState.horizontalLines,
      verticalLines: cleanState.verticalLines,
      boxes: cleanState.boxes,
    }
  }

  // Clean up listeners
  cleanup() {
    this.gameListeners.forEach((unsubscribe) => unsubscribe())
    this.gameListeners = []
  }
}
