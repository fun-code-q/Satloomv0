export interface GameMove {
  type: "horizontal" | "vertical"
  row: number
  col: number
  playerId: string
  playerName: string
  timestamp: number
}

export interface MultiplayerGameState {
  id: string
  roomId: string
  hostId: string
  hostName: string
  joinerId?: string
  joinerName?: string
  gameStatus: "waiting" | "playing" | "finished"
  currentTurn: "host" | "joiner"
  moves: GameMove[]
  scores: { host: number; joiner: number }
  createdAt: number
  lastUpdated: number
  winner?: "host" | "joiner" | "tie"
}
