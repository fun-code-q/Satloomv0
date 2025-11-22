export class CallSounds {
  private static instance: CallSounds
  private audioContext: AudioContext | null = null
  private activeOscillators: OscillatorNode[] = []
  private activeGainNodes: GainNode[] = []
  private isClient = false
  private ringtoneInterval: NodeJS.Timeout | null = null
  private ringbackInterval: NodeJS.Timeout | null = null

  static getInstance(): CallSounds {
    if (!CallSounds.instance) {
      CallSounds.instance = new CallSounds()
    }
    return CallSounds.instance
  }

  constructor() {
    if (typeof window !== "undefined") {
      this.isClient = true
      // Don't initialize AudioContext immediately to avoid warnings
      // It will be initialized on first user interaction or call
    }
  }

  private initAudioContext() {
    if (!this.isClient || this.audioContext) return

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch (error) {
      console.warn("Audio context not supported:", error)
    }
  }

  private async playTone(frequency: number, duration: number, type: OscillatorType = "sine", volume = 0.1) {
    this.initAudioContext()
    if (!this.audioContext) return

    try {
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume()
      }

      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)

      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime)

      // Envelope to avoid clicking
      gainNode.gain.setValueAtTime(0, this.audioContext.currentTime)
      gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.05)
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration - 0.05)

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + duration)

      this.activeOscillators.push(oscillator)
      this.activeGainNodes.push(gainNode)

      // Cleanup
      oscillator.onended = () => {
        const oscIndex = this.activeOscillators.indexOf(oscillator)
        if (oscIndex > -1) this.activeOscillators.splice(oscIndex, 1)

        const gainIndex = this.activeGainNodes.indexOf(gainNode)
        if (gainIndex > -1) this.activeGainNodes.splice(gainIndex, 1)
      }
    } catch (error) {
      console.warn("Error playing tone:", error)
    }
  }

  async playRingtone() {
    this.stopAll()

    // Play immediately
    this.playRingtoneSequence()

    // Loop every 3 seconds
    this.ringtoneInterval = setInterval(() => {
      this.playRingtoneSequence()
    }, 3000)
  }

  private async playRingtoneSequence() {
    // Digital phone ring style
    await this.playTone(800, 0.4, "sine", 0.15)
    setTimeout(() => this.playTone(800, 0.4, "sine", 0.15), 500)
    // Wait for 2 seconds (handled by interval)
  }

  async playRingback() {
    this.stopAll()

    // Play immediately
    this.playRingbackSequence()

    // Loop every 2.5 seconds (standard US ringback cycle is roughly 2s on, 4s off, but we'll do a simpler one)
    this.ringbackInterval = setInterval(() => {
      this.playRingbackSequence()
    }, 2500)
  }

  private async playRingbackSequence() {
    // Standard low purr/hum
    await this.playTone(440, 1.0, "sine", 0.1)
    await this.playTone(480, 1.0, "sine", 0.1)
  }

  async playEndCall() {
    this.stopAll()
    // Descending tones
    await this.playTone(480, 0.2, "sine", 0.1)
    setTimeout(() => this.playTone(440, 0.2, "sine", 0.1), 200)
  }

  async playBeep() {
    this.initAudioContext()
    // Sharp beep
    await this.playTone(1000, 0.3, "sine", 0.15)
  }

  stopAll() {
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval)
      this.ringtoneInterval = null
    }

    if (this.ringbackInterval) {
      clearInterval(this.ringbackInterval)
      this.ringbackInterval = null
    }

    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop()
        osc.disconnect()
      } catch (e) {
        // Ignore errors if already stopped
      }
    })
    this.activeOscillators = []

    this.activeGainNodes.forEach((node) => {
      try {
        node.disconnect()
      } catch (e) {
        // Ignore
      }
    })
    this.activeGainNodes = []
  }
}
