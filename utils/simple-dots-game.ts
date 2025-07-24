export interface SimpleGameState {
  gridSize: number
  horizontalLines: boolean[][]
  verticalLines: boolean[][]
  boxes: { completed: boolean; owner?: "host" | "joiner" }[][]
  scores: { host: number; joiner: number }
  currentPlayer: "host" | "joiner"
  gameStatus: "waiting" | "playing" | "finished"
  winner?: "host" | "joiner" | "tie"
}

export interface SimpleMove {
  type: "horizontal" | "vertical"
  row: number
  col: number
  player: "host" | "joiner"
}

export class SimpleDotsGame {
  private state: SimpleGameState

  constructor(gridSize = 4) {
    this.state = {
      gridSize,
      horizontalLines: this.initializeHorizontalLines(gridSize),
      verticalLines: this.initializeVerticalLines(gridSize),
      boxes: this.initializeBoxes(gridSize),
      scores: { host: 0, joiner: 0 },
      currentPlayer: "host",
      gameStatus: "waiting",
    }
  }

  private initializeHorizontalLines(gridSize: number): boolean[][] {
    const lines: boolean[][] = []
    for (let row = 0; row <= gridSize; row++) {
      lines[row] = []
      for (let col = 0; col < gridSize; col++) {
        lines[row][col] = false
      }
    }
    return lines
  }

  private initializeVerticalLines(gridSize: number): boolean[][] {
    const lines: boolean[][] = []
    for (let row = 0; row < gridSize; row++) {
      lines[row] = []
      for (let col = 0; col <= gridSize; col++) {
        lines[row][col] = false
      }
    }
    return lines
  }

  private initializeBoxes(gridSize: number): { completed: boolean; owner?: "host" | "joiner" }[][] {
    const boxes: { completed: boolean; owner?: "host" | "joiner" }[][] = []
    for (let row = 0; row < gridSize; row++) {
      boxes[row] = []
      for (let col = 0; col < gridSize; col++) {
        boxes[row][col] = { completed: false }
      }
    }
    return boxes
  }

  public startGame(): void {
    this.state.gameStatus = "playing"
    this.state.currentPlayer = "host"
  }

  public makeMove(move: SimpleMove): { success: boolean; completedBoxes: number } {
    if (this.state.gameStatus !== "playing") {
      return { success: false, completedBoxes: 0 }
    }

    if (this.state.currentPlayer !== move.player) {
      return { success: false, completedBoxes: 0 }
    }

    // Check if move is valid
    if (!this.isValidMove(move)) {
      return { success: false, completedBoxes: 0 }
    }

    // Make the move
    if (move.type === "horizontal") {
      this.state.horizontalLines[move.row][move.col] = true
    } else {
      this.state.verticalLines[move.row][move.col] = true
    }

    // Check for completed boxes
    const completedBoxes = this.checkAndCompleteBoxes(move)

    // Update scores
    if (completedBoxes > 0) {
      this.state.scores[move.player] += completedBoxes
    }

    // Switch turns only if no boxes were completed
    if (completedBoxes === 0) {
      this.state.currentPlayer = this.state.currentPlayer === "host" ? "joiner" : "host"
    }

    // Check if game is finished
    if (this.isGameFinished()) {
      this.state.gameStatus = "finished"
      this.determineWinner()
    }

    return { success: true, completedBoxes }
  }

  private isValidMove(move: SimpleMove): boolean {
    const { type, row, col } = move
    const { gridSize } = this.state

    if (type === "horizontal") {
      if (row < 0 || row > gridSize || col < 0 || col >= gridSize) {
        return false
      }
      return !this.state.horizontalLines[row][col]
    } else {
      if (row < 0 || row >= gridSize || col < 0 || col > gridSize) {
        return false
      }
      return !this.state.verticalLines[row][col]
    }
  }

  private checkAndCompleteBoxes(move: SimpleMove): number {
    let completedCount = 0
    const { type, row, col, player } = move
    const { gridSize } = this.state

    if (type === "horizontal") {
      // Check box above
      if (row > 0) {
        const boxRow = row - 1
        const boxCol = col
        if (this.isBoxCompleted(boxRow, boxCol) && !this.state.boxes[boxRow][boxCol].completed) {
          this.state.boxes[boxRow][boxCol] = { completed: true, owner: player }
          completedCount++
        }
      }

      // Check box below
      if (row < gridSize) {
        const boxRow = row
        const boxCol = col
        if (this.isBoxCompleted(boxRow, boxCol) && !this.state.boxes[boxRow][boxCol].completed) {
          this.state.boxes[boxRow][boxCol] = { completed: true, owner: player }
          completedCount++
        }
      }
    } else {
      // Check box to the left
      if (col > 0) {
        const boxRow = row
        const boxCol = col - 1
        if (this.isBoxCompleted(boxRow, boxCol) && !this.state.boxes[boxRow][boxCol].completed) {
          this.state.boxes[boxRow][boxCol] = { completed: true, owner: player }
          completedCount++
        }
      }

      // Check box to the right
      if (col < gridSize) {
        const boxRow = row
        const boxCol = col
        if (this.isBoxCompleted(boxRow, boxCol) && !this.state.boxes[boxRow][boxCol].completed) {
          this.state.boxes[boxRow][boxCol] = { completed: true, owner: player }
          completedCount++
        }
      }
    }

    return completedCount
  }

  private isBoxCompleted(boxRow: number, boxCol: number): boolean {
    const top = this.state.horizontalLines[boxRow][boxCol]
    const bottom = this.state.horizontalLines[boxRow + 1][boxCol]
    const left = this.state.verticalLines[boxRow][boxCol]
    const right = this.state.verticalLines[boxRow][boxCol + 1]
    return top && bottom && left && right
  }

  private isGameFinished(): boolean {
    return this.state.boxes.every((row) => row.every((box) => box.completed))
  }

  private determineWinner(): void {
    const { host, joiner } = this.state.scores
    if (host > joiner) {
      this.state.winner = "host"
    } else if (joiner > host) {
      this.state.winner = "joiner"
    } else {
      this.state.winner = "tie"
    }
  }

  public getState(): SimpleGameState {
    return { ...this.state }
  }

  public setState(newState: SimpleGameState): void {
    this.state = { ...newState }
  }

  public applyMoves(moves: SimpleMove[]): void {
    // Reset game state
    this.state = {
      gridSize: this.state.gridSize,
      horizontalLines: this.initializeHorizontalLines(this.state.gridSize),
      verticalLines: this.initializeVerticalLines(this.state.gridSize),
      boxes: this.initializeBoxes(this.state.gridSize),
      scores: { host: 0, joiner: 0 },
      currentPlayer: "host",
      gameStatus: "playing",
    }

    // Apply all moves in sequence
    for (const move of moves) {
      this.makeMove(move)
    }
  }
}
