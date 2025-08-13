"use client"
import { Button } from "@/components/ui/button"
import { Film, X, Users } from "lucide-react"
import type { TheaterInvite } from "@/utils/theater-signaling"

interface TheaterInviteNotificationProps {
  invite: TheaterInvite
  onAccept: () => void
  onDecline: () => void
}

export function TheaterInviteNotification({ invite, onAccept, onDecline }: TheaterInviteNotificationProps) {
  return (
    <div className="fixed top-4 right-4 z-50 bg-slate-800 border border-slate-700 rounded-xl p-4 shadow-2xl max-w-sm animate-in slide-in-from-right">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center flex-shrink-0">
          <Film className="w-5 h-5 text-purple-400" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-semibold text-sm">Theater Invite</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDecline}
              className="h-6 w-6 text-gray-400 hover:text-white hover:bg-slate-700"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>

          <p className="text-gray-300 text-sm mb-3">
            <span className="font-medium text-purple-400">{invite.host}</span> invited you to watch{" "}
            <span className="font-medium">{invite.videoTitle}</span>
          </p>

          <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
            <Users className="w-3 h-3" />
            <span>Movie Theater Session</span>
          </div>

          <div className="flex gap-2">
            <Button onClick={onAccept} className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-sm h-8">
              Join Theater
            </Button>
            <Button
              onClick={onDecline}
              variant="outline"
              className="flex-1 border-slate-600 text-white hover:bg-slate-700 bg-transparent text-sm h-8"
            >
              Decline
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
