"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { NotificationSystem } from "@/utils/notification-system"

type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  notifications: boolean
  toggleNotifications: () => void
  notificationSound: boolean
  toggleNotificationSound: () => void
  showNotification: (title: string, message: string, options?: NotificationOptions) => void
  playNotificationSound: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")
  const [notifications, setNotifications] = useState(true)
  const [notificationSound, setNotificationSound] = useState(true)

  // Initialize theme and settings on mount
  useEffect(() => {
    // Load saved preferences from localStorage
    const savedTheme = localStorage.getItem("satloom-theme") as Theme | null
    const savedNotifications = localStorage.getItem("satloom-notifications")
    const savedNotificationSound = localStorage.getItem("satloom-notification-sound")

    if (savedTheme && (savedTheme === "dark" || savedTheme === "light")) {
      setTheme(savedTheme)
    }
    if (savedNotifications !== null) {
      setNotifications(savedNotifications === "true")
    }
    if (savedNotificationSound !== null) {
      setNotificationSound(savedNotificationSound === "true")
    }
  }, [])

  // Apply theme changes to document
  useEffect(() => {
    const root = document.documentElement

    if (theme === "light") {
      root.classList.add("light")
      root.classList.remove("dark")
      root.style.colorScheme = "light"
    } else {
      root.classList.add("dark")
      root.classList.remove("light")
      root.style.colorScheme = "dark"
    }

    // Save theme to localStorage
    localStorage.setItem("satloom-theme", theme)
  }, [theme])

  // Save notification settings
  useEffect(() => {
    localStorage.setItem("satloom-notifications", notifications.toString())
    NotificationSystem.getInstance().setNotificationsEnabled(notifications)
  }, [notifications])

  useEffect(() => {
    localStorage.setItem("satloom-notification-sound", notificationSound.toString())
    NotificationSystem.getInstance().setSoundEnabled(notificationSound)
  }, [notificationSound])

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"))
  }

  const toggleNotifications = () => {
    setNotifications((prev) => !prev)
  }

  const toggleNotificationSound = () => {
    setNotificationSound((prev) => !prev)
  }

  const showNotification = (title: string, message: string, options?: NotificationOptions) => {
    if (!notifications) return

    // Check if browser supports notifications
    if ("Notification" in window) {
      // Request permission if not granted
      if (Notification.permission === "default") {
        Notification.requestPermission().then((permission) => {
          if (permission === "granted") {
            new Notification(title, { body: message, ...options })
          }
        })
      } else if (Notification.permission === "granted") {
        new Notification(title, { body: message, ...options })
      }
    }

    // Play notification sound if enabled
    if (notificationSound) {
      playNotificationSound()
    }
  }

  const playNotificationSound = () => {
    if (!notificationSound) return

    try {
      // Create audio context for notification sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1)

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)

      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch (error) {
      console.warn("Could not play notification sound:", error)
    }
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        notifications,
        toggleNotifications,
        notificationSound,
        toggleNotificationSound,
        showNotification,
        playNotificationSound,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return context
}
