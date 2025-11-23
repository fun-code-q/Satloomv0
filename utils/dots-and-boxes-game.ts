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
  activePlayerIds?: string[]
}

export interface Player {
  id: string
  name: string
  color: string
  isComputer: boolean
  isHost: boolean
  initials: string
  isPlaceholder?: boolean
  connected?: boolean
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

interface MoveOption {
  type: "horizontal" | "vertical"
  row: number
  col: number
  score: number
  completesBoxes: number
  givesOpponentBoxes: number
  strategicValue: number
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

  public syncState(newState: GameState): void {
    try {
      // Update all critical state properties
      this.gameState.players = newState.players
      this.gameState.currentPlayerIndex = newState.currentPlayerIndex
      this.gameState.grid = newState.grid
      this.gameState.horizontalLines = newState.horizontalLines
      this.gameState.verticalLines = newState.verticalLines
      this.gameState.boxes = newState.boxes
      this.gameState.scores = newState.scores
      this.gameState.gameStatus = newState.gameStatus
      this.gameState.winner = newState.winner
      this.gameState.lastMove = newState.lastMove

      // Also update optional properties if they exist in the new state
      if (newState.activePlayerIds) {
        this.gameState.activePlayerIds = newState.activePlayerIds
      }
    } catch (err) {
      console.error(`Error syncing game state: ${err}`)
    }
  }

  public makeComputerMove(): boolean {
    try {
      const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex]
      if (!currentPlayer.isComputer) {
        console.log("Current player is not computer")
        return false
      }

      console.log("AI is analyzing the board...")

      // Get the best move using advanced strategy
      const bestMove = this.getBestAIMove()

      if (!bestMove) {
        console.log("No available moves for AI")
        return false
      }

      console.log(
        `AI choosing strategic move: ${bestMove.type} at ${bestMove.row},${bestMove.col} (score: ${bestMove.score})`,
      )

      const success = this.makeMove(currentPlayer.id, bestMove.type, bestMove.row, bestMove.col)
      console.log(`AI move success: ${success}`)

      return success
    } catch (err) {
      console.error(`Error making AI move: ${err}`)
      return false
    }
  }

  private getBestAIMove(): MoveOption | null {
    const availableMoves = this.getAvailableMoves()
    if (availableMoves.length === 0) {
      return null
    }

    // Analyze each move and score it
    const moveOptions: MoveOption[] = availableMoves.map((move) => {
      return this.analyzeMoveOption(move.type, move.row, move.col)
    })

    // Sort by strategic value (highest first)
    moveOptions.sort((a, b) => b.strategicValue - a.strategicValue)

    // Apply difficulty-based strategy
    const difficulty = this.gameState.difficulty

    if (difficulty === "easy") {
      // Easy: Mix of good moves and some random
      const topMoves = moveOptions.slice(0, Math.max(3, Math.floor(moveOptions.length * 0.4)))
      return topMoves[Math.floor(Math.random() * topMoves.length)]
    } else if (difficulty === "medium") {
      // Medium: Good strategic play with occasional suboptimal moves
      const topMoves = moveOptions.slice(0, Math.max(2, Math.floor(moveOptions.length * 0.3)))
      return Math.random() < 0.85 ? topMoves[0] : topMoves[Math.floor(Math.random() * topMoves.length)]
    } else {
      // Hard: Always pick the best strategic move
      return moveOptions[0]
    }
  }

  private analyzeMoveOption(type: "horizontal" | "vertical", row: number, col: number): MoveOption {
    // Create a temporary copy to analyze this move
    const tempGame = this.cloneGameState()

    // Simulate the move
    const boxesCompleted = this.simulateMove(tempGame, type, row, col)

    // Calculate how many boxes this would give to opponent
    const opponentBoxes = this.calculateOpponentBoxesGiven(type, row, col)

    // Calculate strategic value
    let strategicValue = 0

    // High priority: Complete boxes immediately
    if (boxesCompleted > 0) {
      strategicValue += boxesCompleted * 100
    }

    // Medium priority: Avoid giving opponent easy boxes
    strategicValue -= opponentBoxes * 50

    // Low priority: Position for future advantage
    strategicValue += this.calculatePositionalValue(type, row, col)

    // Bonus for chain moves (moves that lead to more moves)
    if (boxesCompleted > 0) {
      const chainPotential = this.calculateChainPotential(tempGame)
      strategicValue += chainPotential * 20
    }

    return {
      type,
      row,
      col,
      score: strategicValue,
      completesBoxes: boxesCompleted,
      givesOpponentBoxes: opponentBoxes,
      strategicValue,
    }
  }

  private cloneGameState(): GameState {
    return JSON.parse(JSON.stringify(this.gameState))
  }

  private simulateMove(gameState: GameState, type: "horizontal" | "vertical", row: number, col: number): number {
    try {
      let completedBoxes = 0

      if (type === "horizontal") {
        // Check box above
        if (row > 0) {
          const boxRow = row - 1
          const boxCol = col
          if (this.wouldCompleteBox(gameState, boxRow, boxCol, type, row, col)) {
            completedBoxes++
          }
        }

        // Check box below
        if (row < this.gridSize) {
          const boxRow = row
          const boxCol = col
          if (this.wouldCompleteBox(gameState, boxRow, boxCol, type, row, col)) {
            completedBoxes++
          }
        }
      } else {
        // Check box to the left
        if (col > 0) {
          const boxRow = row
          const boxCol = col - 1
          if (this.wouldCompleteBox(gameState, boxRow, boxCol, type, row, col)) {
            completedBoxes++
          }
        }

        // Check box to the right
        if (col < this.gridSize) {
          const boxRow = row
          const boxCol = col
          if (this.wouldCompleteBox(gameState, boxRow, boxCol, type, row, col)) {
            completedBoxes++
          }
        }
      }

      return completedBoxes
    } catch (err) {
      console.error(`Error simulating move: ${err}`)
      return 0
    }
  }

  private wouldCompleteBox(
    gameState: GameState,
    boxRow: number,
    boxCol: number,
    moveType: "horizontal" | "vertical",
    moveRow: number,
    moveCol: number,
  ): boolean {
    try {
      let top = gameState.horizontalLines[boxRow][boxCol].isDrawn
      let bottom = gameState.horizontalLines[boxRow + 1][boxCol].isDrawn
      let left = gameState.verticalLines[boxRow][boxCol].isDrawn
      let right = gameState.verticalLines[boxRow][boxCol + 1].isDrawn

      // Apply the proposed move
      if (moveType === "horizontal") {
        if (moveRow === boxRow) top = true
        if (moveRow === boxRow + 1) bottom = true
      } else {
        if (moveCol === boxCol) left = true
        if (moveCol === boxCol + 1) right = true
      }

      return top && bottom && left && right && !gameState.boxes[boxRow][boxCol].isCompleted
    } catch (err) {
      return false
    }
  }

  private calculateOpponentBoxesGiven(type: "horizontal" | "vertical", row: number, col: number): number {
    // Count how many boxes would have 3 sides after this move
    let dangerousBoxes = 0

    try {
      if (type === "horizontal") {
        // Check boxes above and below
        const positions = [
          { boxRow: row - 1, boxCol: col },
          { boxRow: row, boxCol: col },
        ]

        for (const pos of positions) {
          if (pos.boxRow >= 0 && pos.boxRow < this.gridSize) {
            const sides = this.countBoxSides(pos.boxRow, pos.boxCol)
            if (sides === 2) {
              // After our move, it would have 3 sides
              dangerousBoxes++
            }
          }
        }
      } else {
        // Check boxes left and right
        const positions = [
          { boxRow: row, boxCol: col - 1 },
          { boxRow: row, boxCol: col },
        ]

        for (const pos of positions) {
          if (pos.boxCol >= 0 && pos.boxCol < this.gridSize) {
            const sides = this.countBoxSides(pos.boxRow, pos.boxCol)
            if (sides === 2) {
              // After our move, it would have 3 sides
              dangerousBoxes++
            }
          }
        }
      }
    } catch (err) {
      console.error(`Error calculating opponent boxes: ${err}`)
    }

    return dangerousBoxes
  }

  private countBoxSides(boxRow: number, boxCol: number): number {
    try {
      let sides = 0
      if (this.gameState.horizontalLines[boxRow][boxCol].isDrawn) sides++
      if (this.gameState.horizontalLines[boxRow + 1][boxCol].isDrawn) sides++
      if (this.gameState.verticalLines[boxRow][boxCol].isDrawn) sides++
      if (this.gameState.verticalLines[boxRow][boxCol + 1].isDrawn) sides++
      return sides
    } catch (err) {
      return 0
    }
  }

  private calculatePositionalValue(type: "horizontal" | "vertical", row: number, col: number): number {
    let value = 0

    // Prefer center moves in early game
    const totalMoves = this.getTotalMovesPlayed()
    const totalPossibleMoves = (this.gridSize + 1) * this.gridSize + this.gridSize * (this.gridSize + 1)

    if (totalMoves < totalPossibleMoves * 0.3) {
      const centerRow = this.gridSize / 2
      const centerCol = this.gridSize / 2

      if (type === "horizontal") {
        const distance = Math.abs(row - centerRow) + Math.abs(col - centerCol)
        value += Math.max(0, 10 - distance)
      } else {
        const distance = Math.abs(row - centerRow) + Math.abs(col - centerCol)
        value += Math.max(0, 10 - distance)
      }
    }

    return value
  }

  private calculateChainPotential(gameState: GameState): number {
    // Count boxes that are one move away from completion
    let potential = 0

    for (let row = 0; row < this.gridSize; row++) {
      for (let col = 0; col < this.gridSize; col++) {
        if (!gameState.boxes[row][col].isCompleted) {
          const sides = this.countBoxSidesInState(gameState, row, col)
          if (sides === 3) {
            potential++
          }
        }
      }
    }

    return potential
  }

  private countBoxSidesInState(gameState: GameState, boxRow: number, boxCol: number): number {
    try {
      let sides = 0
      if (gameState.horizontalLines[boxRow][boxCol].isDrawn) sides++
      if (gameState.horizontalLines[boxRow + 1][boxCol].isDrawn) sides++
      if (gameState.verticalLines[boxRow][boxCol].isDrawn) sides++
      if (gameState.verticalLines[boxRow][boxCol + 1].isDrawn) sides++
      return sides
    } catch (err) {
      return 0
    }
  }

  private getAvailableMoves(): { type: "horizontal" | "vertical"; row: number; col: number }[] {
    const moves: { type: "horizontal" | "vertical"; row: number; col: number }[] = []

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

  private getTotalMovesPlayed(): number {
    let moves = 0
    // Count all drawn lines
    this.gameState.horizontalLines.forEach((row) => row.forEach((line) => line.isDrawn && moves++))
    this.gameState.verticalLines.forEach((row) => row.forEach((line) => line.isDrawn && moves++))
    return moves
  }
}
