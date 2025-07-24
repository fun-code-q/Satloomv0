"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Settings } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, toggleTheme, notifications, toggleNotifications, notificationSound, toggleNotificationSound } =
    useTheme()

  const handleSaveSettings = () => {
    // Settings are automatically saved via context
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-cyan-400 flex items-center justify-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <span className="text-white">Theme:</span>
            <Button onClick={toggleTheme} className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg">
              {theme === "dark" ? " Switch to Light" : " Switch to Dark"}
            </Button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <span className="text-white">Notifications:</span>
            <button
              onClick={toggleNotifications}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications ? "bg-cyan-500" : "bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Notification Sound */}
          <div className="flex items-center justify-between">
            <span className="text-white">Notification Sound:</span>
            <button
              onClick={toggleNotificationSound}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notificationSound ? "bg-cyan-500" : "bg-gray-600"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notificationSound ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Debug Mode */}
          <div className="flex items-center justify-between">
            <span className="text-white">Debug Mode:</span>
            <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-600">
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
            </button>
          </div>
        </div>

        <div className="flex gap-4 justify-center pt-4">
          <Button onClick={handleSaveSettings} className="bg-cyan-500 hover:bg-cyan-600">
            Save Settings
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className="border-slate-600 text-white hover:bg-slate-700 bg-transparent"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
