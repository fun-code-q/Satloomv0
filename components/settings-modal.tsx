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
      <DialogContent
        className={`border max-w-md transition-colors ${
          theme === "dark" ? "bg-slate-800 border-slate-700 text-white" : "bg-white border-gray-200 text-gray-900"
        }`}
      >
        <DialogHeader>
          <DialogTitle
            className={`text-center flex items-center justify-center gap-2 ${
              theme === "dark" ? "text-cyan-400" : "text-blue-600"
            }`}
          >
            <Settings className="w-5 h-5" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <span className={`${theme === "dark" ? "text-white" : "text-gray-900"}`}>Theme:</span>
            <Button
              onClick={toggleTheme}
              className={`px-4 py-2 rounded-lg transition-colors ${
                theme === "dark"
                  ? "bg-cyan-500 hover:bg-cyan-600 text-white"
                  : "bg-blue-500 hover:bg-blue-600 text-white"
              }`}
            >
              {theme === "dark" ? "Dark Mode" : "Light Mode"}
            </Button>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between">
            <span className={`${theme === "dark" ? "text-white" : "text-gray-900"}`}>Notifications:</span>
            <button
              onClick={toggleNotifications}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications ? (theme === "dark" ? "bg-cyan-500" : "bg-blue-500") : "bg-gray-600"
              }`}
              aria-pressed={notifications}
              role="switch"
              aria-label={`Notifications ${notifications ? "enabled" : "disabled"}`}
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
            <span className={`${theme === "dark" ? "text-white" : "text-gray-900"}`}>Notification Sound:</span>
            <button
              onClick={toggleNotificationSound}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notificationSound ? (theme === "dark" ? "bg-cyan-500" : "bg-blue-500") : "bg-gray-600"
              }`}
              aria-pressed={notificationSound}
              role="switch"
              aria-label={`Notification sound ${notificationSound ? "enabled" : "disabled"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notificationSound ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          {/* Debug Mode */}
          <div className="flex items-center justify-between opacity-50">
            <span className={`${theme === "dark" ? "text-white" : "text-gray-900"}`}>Debug Mode:</span>
            <button
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-600 cursor-not-allowed"
              disabled
              title="Coming soon"
            >
              <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
            </button>
          </div>
        </div>

        <div className="flex gap-4 justify-center pt-4">
          <Button
            onClick={handleSaveSettings}
            className={`transition-colors ${
              theme === "dark" ? "bg-cyan-500 hover:bg-cyan-600" : "bg-blue-500 hover:bg-blue-600"
            } text-white`}
          >
            Done
          </Button>
          <Button
            onClick={onClose}
            variant="outline"
            className={`transition-colors ${
              theme === "dark"
                ? "border-slate-600 text-white hover:bg-slate-700 bg-transparent"
                : "border-gray-300 text-gray-700 hover:bg-gray-50 bg-transparent"
            }`}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
