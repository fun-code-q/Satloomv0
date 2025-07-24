export interface GameState {
  id: string
  roomId: string
  players: Player[]
  currentPlayerIndex: number
  grid: GridDot[][]
  horizontalLines: Line[][]
  verticalLines: Line[][]
  boxes: Box[][]
  scores: { [playerId: string]: number }
  gameStatus: "waiting" | "playing" | "finished"
  winner?: string
  createdAt: number
  lastMove?: Move
  gridSize: number
  difficulty: "easy" | "medium" | "hard"
  voiceChatEnabled: boolean
}

export interface Player {
  id: string
  name: string
  color: string
  isComputer: boolean
  isHost: boolean
  initials: string
}

export interface GridDot {
  row: number
  col: number
  x: number
  y: number
}

export interface Line {
  id: string
  playerId: string
  playerColor: string
  isDrawn: boolean
  timestamp?: number
}

export interface Box {
  id: string
  playerId?: string
  playerColor?: string
  playerInitials?: string
  isCompleted: boolean
  completedAt?: number
}

export interface Move {
  playerId: string
  playerName: string
  type: "horizontal" | "vertical"
  row: number
  col: number
  timestamp: number
  boxesCompleted: number
}

export class DotsAndBoxesGame {
  private gameState: GameState
  private gridSize: number
  private dotSize = 40
  private lineWidth = 8
  private boxSize = 60

  constructor(
    gameId: string,
    roomId: string,
    players: Player[],
    gridSize = 5,
    voiceChatEnabled = false,
    difficulty: "easy" | "medium" | "hard" = "medium",
  ) {
    if (gridSize < 4 || gridSize > 9) {
      throw new Error("Grid size must be between 4 and 9")
    }
    if (players.length < 2) {
      throw new Error("At least 2 players are required")
    }

    this.gridSize = gridSize
    this.gameState = {
      id: gameId,
      roomId,
      players,
      currentPlayerIndex: 0,
      grid: this.initializeGrid(),
      horizontalLines: this.initializeHorizontalLines(),
      verticalLines: this.initializeVerticalLines(),
      boxes: this.initializeBoxes(),
      scores: {},
      gameStatus: "waiting",
      createdAt: Date.now(),
      gridSize,
      difficulty,
      voiceChatEnabled,
    }

    // Initialize scores
    players.forEach((player) => {
      this.gameState.scores[player.id] = 0
    })
  }

  private initializeGrid(): GridDot[][] {
    const grid: GridDot[][] = []
    for (let row = 0; row <= this.gridSize; row++) {
      grid[row] = []
      for (let col = 0; col <= this.gridSize; col++) {
        grid[row][col] = {
          row,
          col,
          x: col * this.boxSize,
          y: row * this.boxSize,
        }
      }
    }
    return grid
  }

  private initializeHorizontalLines(): Line[][] {
    const lines: Line[][] = []
    for (let row = 0; row <= this.gridSize; row++) {
      lines[row] = []
      for (let col = 0; col < this.gridSize; col++) {
        lines[row][col] = {
          id: `h_${row}_${col}`,
          playerId: "",
          playerColor: "",
          isDrawn: false,
        }
      }
    }
    return lines
  }

  private initializeVerticalLines(): Line[][] {
    const lines: Line[][] = []
    for (let row = 0; row < this.gridSize; row++) {
      lines[row] = []
      for (let col = 0; col <= this.gridSize; col++) {
        lines[row][col] = {
          id: `v_${row}_${col}`,
          playerId: "",
          playerColor: "",
          isDrawn: false,
        }
      }
    }
    return lines
  }

  private initializeBoxes(): Box[][] {
    const boxes: Box[][] = []
    for (let row = 0; row < this.gridSize; row++) {
      boxes[row] = []
      for (let col = 0; col < this.gridSize; col++) {
        boxes[row][col] = {
          id: `box_${row}_${col}`,
          isCompleted: false,
        }
      }
    }
    return boxes
  }

  public startGame(): void {
    try {
      this.gameState.gameStatus = "playing"
      this.gameState.currentPlayerIndex = 0
      this.gameState.horizontalLines = this.initializeHorizontalLines()
      this.gameState.verticalLines = this.initializeVerticalLines()
      this.gameState.boxes = this.initializeBoxes()
      this.gameState.scores = {}
      this.gameState.players.forEach((player) => {
        this.gameState.scores[player.id] = 0
      })
      this.gameState.winner = undefined
      this.gameState.lastMove = undefined
    } catch (err) {
      throw new Error(`Failed to start game: ${err}`)
    }
  }

  public makeMove(playerId: string, type: "horizontal" | "vertical", row: number, col: number): boolean {
    if (this.gameState.gameStatus !== "playing") {
      throw new Error("Game is not in progress")
    }
    if (this.gameState.players[this.gameState.currentPlayerIndex].id !== playerId) {
      return false
    }

    // Validate move
    if (!this.isValidMove(type, row, col)) {
      return false
    }

    // Make the move
    const player = this.gameState.players[this.gameState.currentPlayerIndex]
    let line: Line

    if (type === "horizontal") {
      line = this.gameState.horizontalLines[row][col]
    } else {
      line = this.gameState.verticalLines[row][col]
    }

    if (line.isDrawn) {
      return false
    }

    // Draw the line
    line.isDrawn = true
    line.playerId = playerId
    line.playerColor = player.color
    line.timestamp = Date.now()

    // Check for completed boxes
    const completedBoxes = this.checkCompletedBoxes(type, row, col, player)

    // Update scores
    this.gameState.scores[playerId] += completedBoxes.length

    // Create move record
    const move: Move = {
      playerId,
      playerName: player.name,
      type,
      row,
      col,
      timestamp: Date.now(),
      boxesCompleted: completedBoxes.length,
    }

    this.gameState.lastMove = move

    // If no boxes were completed, move to next player
    if (completedBoxes.length === 0) {
      this.nextPlayer()
    }

    // Check if game is finished
    if (this.isGameFinished()) {
      this.gameState.gameStatus = "finished"
      this.gameState.winner = this.getWinner()
    }

    return true
  }

  private isValidMove(type: "horizontal" | "vertical", row: number, col: number): boolean {
    try {
      if (type === "horizontal") {
        if (row < 0 || row > this.gridSize || col < 0 || col >= this.gridSize) {
          return false
        }
        return !this.gameState.horizontalLines[row][col].isDrawn
      } else {
        if (row < 0 || row >= this.gridSize || col < 0 || col > this.gridSize) {
          return false
        }
        return !this.gameState.verticalLines[row][col].isDrawn
      }
    } catch (err) {
      console.error(`Error validating move: ${err}`)
      return false
    }
  }

  private checkCompletedBoxes(type: "horizontal" | "vertical", row: number, col: number, player: Player): Box[] {
    const completedBoxes: Box[] = []

    try {
      if (type === "horizontal") {
        // Check box above
        if (row > 0) {
          const boxRow = row - 1
          const boxCol = col
          if (this.isBoxCompleted(boxRow, boxCol)) {
            const box = this.gameState.boxes[boxRow][boxCol]
            if (!box.isCompleted) {
              box.isCompleted = true
              box.playerId = player.id
              box.playerColor = player.color
              box.playerInitials = player.initials
              box.completedAt = Date.now()
              completedBoxes.push(box)
            }
          }
        }

        // Check box below
        if (row < this.gridSize) {
          const boxRow = row
          const boxCol = col
          if (this.isBoxCompleted(boxRow, boxCol)) {
            const box = this.gameState.boxes[boxRow][boxCol]
            if (!box.isCompleted) {
              box.isCompleted = true
              box.playerId = player.id
              box.playerColor = player.color
              box.playerInitials = player.initials
              box.completedAt = Date.now()
              completedBoxes.push(box)
            }
          }
        }
      } else {
        // Check box to the left
        if (col > 0) {
          const boxRow = row
          const boxCol = col - 1
          if (this.isBoxCompleted(boxRow, boxCol)) {
            const box = this.gameState.boxes[boxRow][boxCol]
            if (!box.isCompleted) {
              box.isCompleted = true
              box.playerId = player.id
              box.playerColor = player.color
              box.playerInitials = player.initials
              box.completedAt = Date.now()
              completedBoxes.push(box)
            }
          }
        }

        // Check box to the right
        if (col < this.gridSize) {
          const boxRow = row
          const boxCol = col
          if (this.isBoxCompleted(boxRow, boxCol)) {
            const box = this.gameState.boxes[boxRow][boxCol]
            if (!box.isCompleted) {
              box.isCompleted = true
              box.playerId = player.id
              box.playerColor = player.color
              box.playerInitials = player.initials
              box.completedAt = Date.now()
              completedBoxes.push(box)
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error checking completed boxes: ${err}`)
    }

    return completedBoxes
  }

  private isBoxCompleted(boxRow: number, boxCol: number): boolean {
    try {
      const top = this.gameState.horizontalLines[boxRow][boxCol].isDrawn
      const bottom = this.gameState.horizontalLines[boxRow + 1][boxCol].isDrawn
      const left = this.gameState.verticalLines[boxRow][boxCol].isDrawn
      const right = this.gameState.verticalLines[boxRow][boxCol + 1].isDrawn
      return top && bottom && left && right
    } catch (err) {
      console.error(`Error checking box completion: ${err}`)
      return false
    }
  }

  private nextPlayer(): void {
    try {
      this.gameState.currentPlayerIndex = (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length
    } catch (err) {
      console.error(`Error advancing to next player: ${err}`)
    }
  }

  private isGameFinished(): boolean {
    try {
      return this.gameState.boxes.every((row) => row.every((box) => box.isCompleted))
    } catch (err) {
      console.error(`Error checking game finished: ${err}`)
      return false
    }
  }

  private getWinner(): string | undefined {
    try {
      let maxScore = -1
      let winner: string | undefined

      Object.entries(this.gameState.scores).forEach(([playerId, score]) => {
        if (score > maxScore) {
          maxScore = score
          winner = playerId
        } else if (score === maxScore) {
          winner = undefined // Tie
        }
      })

      return winner
    } catch (err) {
      console.error(`Error determining winner: ${err}`)
      return undefined
    }
  }

  public getGameState(): GameState {
    return { ...this.gameState }
  }

  public makeComputerMove(): boolean {
    try {
      const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex]
      if (!currentPlayer.isComputer) {
        console.log("Current player is not computer")
        return false
      }

      console.log("Computer is making a move...")

      // Get all available moves
      const availableMoves = this.getAvailableMoves()
      console.log(`Found ${availableMoves.length} available moves`)

      if (availableMoves.length === 0) {
        console.log("No available moves for computer")
        return false
      }

      // Simple strategy: pick a random move
      const randomIndex = Math.floor(Math.random() * availableMoves.length)
      const move = availableMoves[randomIndex]

      console.log(`Computer choosing move:`, move)

      const success = this.makeMove(currentPlayer.id, move.type, move.row, move.col)
      console.log(`Computer move success: ${success}`)

      return success
    } catch (err) {
      console.error(`Error making computer move: ${err}`)
      return false
    }
  }

  private getAvailableMoves(): Array<{ type: "horizontal" | "vertical"; row: number; col: number }> {
    const moves: Array<{ type: "horizontal" | "vertical"; row: number; col: number }> = []

    // Horizontal lines
    for (let row = 0; row <= this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        if (!this.gameState.horizontalLines[row][col].isDrawn) {
          moves.push({ type: "horizontal", row, col })
        }
      }
    }

    // Vertical lines
    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col <= this.gridSize; col++) {
        if (!this.gameState.verticalLines[row][col].isDrawn) {
          moves.push({ type: "vertical", row, col })
        }
      }
    }

    return moves
  }
}
