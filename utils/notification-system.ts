export class NotificationSystem {
  private static instance: NotificationSystem
  private toasts: Array<{
    id: string
    message: string
    type: "success" | "error" | "info" | "warning"
    timestamp: number
  }> = []

  private notificationsEnabled = true
  private soundEnabled = true

  static getInstance(): NotificationSystem {
    if (!NotificationSystem.instance) {
      NotificationSystem.instance = new NotificationSystem()
    }
    return NotificationSystem.instance
  }

  // Enable / disable all browser notifications (toast + system)
  public setNotificationsEnabled(enabled: boolean) {
    this.notificationsEnabled = enabled
  }

  // Enable / disable any future sound support (kept for API parity)
  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled
  }

  /** Ask the user for browser-notification permission (no-op on server) */
  public async requestPermission() {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission()
      }
    }
  }

  private showToast(message: string, type: "success" | "error" | "info" | "warning") {
    const toast = {
      id: `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      type,
      timestamp: Date.now(),
    }

    this.toasts.push(toast)

    // Auto remove after 5 seconds
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== toast.id)
    }, 5000)

    // Show browser notification if supported
    if (this.notificationsEnabled && "Notification" in window && Notification.permission === "granted") {
      new Notification(`Satloom - ${type.charAt(0).toUpperCase() + type.slice(1)}`, {
        body: message,
        icon: "/placeholder-logo.png",
      })
    }

    console.log(`📢 ${type.toUpperCase()}: ${message}`)
  }

  success(message: string) {
    this.showToast(message, "success")
  }

  error(message: string) {
    this.showToast(message, "error")
  }

  info(message: string) {
    this.showToast(message, "info")
  }

  warning(message: string) {
    this.showToast(message, "warning")
  }

  // Game-specific notifications
  gameInviteReceived(fromUser: string, gameType: string) {
    this.info(`${fromUser} invited you to play ${gameType}`)
  }

  gameInviteSent(toUser: string, gameType: string) {
    this.success(`Game invite sent to ${toUser}`)
  }

  gameStarted(gameType: string) {
    this.success(`${gameType} game started!`)
  }

  gameEnded(winner?: string) {
    if (winner) {
      this.info(`Game ended - ${winner} wins!`)
    } else {
      this.info("Game ended")
    }
  }

  playerJoined(playerName: string) {
    this.info(`${playerName} joined the game`)
  }

  playerLeft(playerName: string) {
    this.warning(`${playerName} left the game`)
  }

  connectionLost() {
    this.error("Connection lost - playing in offline mode")
  }

  connectionRestored() {
    this.success("Connection restored")
  }

  // Room notifications
  roomCreated(roomId: string) {
    this.success(`Room created: ${roomId}`)
  }

  roomJoined(roomId: string) {
    this.success(`Joined room: ${roomId}`)
  }

  // Call notifications
  incomingCall(fromUser: string) {
    this.info(`Incoming call from ${fromUser}`)
  }

  incomingVideoCall(fromUser: string) {
    this.info(`Incoming video call from ${fromUser}`)
  }

  callStarted() {
    this.success("Call started")
  }

  callEnded() {
    this.info("Call ended")
  }

  // Theater notifications
  theaterInviteReceived(fromUser: string) {
    this.info(`${fromUser} invited you to watch together`)
  }

  theaterInvite(host: string, videoTitle: string) {
    this.info(`${host} invited you to watch ${videoTitle}`)
  }

  theaterStarted() {
    this.success("Watch party started!")
  }

  // Quiz notifications
  quizStarted() {
    this.success("Quiz started!")
  }

  quizEnded() {
    this.info("Quiz completed")
  }

  // Get current toasts for UI display
  getToasts() {
    return [...this.toasts]
  }

  // Clear all toasts
  clearAll() {
    this.toasts = []
  }

  // Remove specific toast
  removeToast(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id)
  }
}
