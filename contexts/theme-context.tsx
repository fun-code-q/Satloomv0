"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  notifications: boolean
  toggleNotifications: () => void
  notificationSound: boolean
  toggleNotificationSound: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")
  const [notifications, setNotifications] = useState(true)
  const [notificationSound, setNotificationSound] = useState(true)

  useEffect(() => {
    // Load saved preferences
    const savedTheme = localStorage.getItem("satloom-theme") as Theme
    const savedNotifications = localStorage.getItem("satloom-notifications") === "true"
    const savedNotificationSound = localStorage.getItem("satloom-notification-sound") === "true"

    if (savedTheme) setTheme(savedTheme)
    setNotifications(savedNotifications)
    setNotificationSound(savedNotificationSound)
  }, [])

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.toggle("light", theme === "light")
    localStorage.setItem("satloom-theme", theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem("satloom-notifications", notifications.toString())
  }, [notifications])

  useEffect(() => {
    localStorage.setItem("satloom-notification-sound", notificationSound.toString())
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

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
        notifications,
        toggleNotifications,
        notificationSound,
        toggleNotificationSound,
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
