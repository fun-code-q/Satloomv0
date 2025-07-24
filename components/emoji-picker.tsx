"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void
  isOpen: boolean
  onClose: () => void
}

const emojiCategories = {
  Smileys: [
    "😀",
    "😃",
    "😄",
    "😁",
    "😆",
    "😅",
    "😂",
    "🤣",
    "😊",
    "😇",
    "🙂",
    "🙃",
    "😉",
    "😌",
    "😍",
    "🥰",
    "😘",
    "😗",
    "😙",
    "😚",
    "😋",
    "😛",
    "😝",
    "😜",
    "🤪",
    "🤨",
    "🧐",
    "🤓",
    "😎",
    "🤩",
    "🥳",
  ],
  Gestures: [
    "👍",
    "👎",
    "👌",
    "✌️",
    "🤞",
    "🤟",
    "🤘",
    "🤙",
    "👈",
    "👉",
    "👆",
    "🖕",
    "👇",
    "☝️",
    "👋",
    "🤚",
    "🖐️",
    "✋",
    "🖖",
    "👏",
    "🙌",
    "🤲",
    "🤝",
    "🙏",
  ],
  Hearts: [
    "❤️",
    "🧡",
    "💛",
    "💚",
    "💙",
    "💜",
    "🖤",
    "🤍",
    "🤎",
    "💔",
    "❣️",
    "💕",
    "💞",
    "💓",
    "💗",
    "💖",
    "💘",
    "💝",
    "💟",
  ],
  Objects: [
    "🎉",
    "🎊",
    "🎈",
    "🎁",
    "🏆",
    "🥇",
    "🥈",
    "🥉",
    "⭐",
    "🌟",
    "💫",
    "✨",
    "🔥",
    "💯",
    "⚡",
    "💥",
    "💢",
    "💨",
    "💦",
    "💤",
  ],
}

export function EmojiPicker({ onEmojiSelect, isOpen, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState("Smileys")

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Emoji Picker */}
      <div className="absolute bottom-16 right-4 z-50 bg-slate-800/95 backdrop-blur-sm border border-slate-600 rounded-2xl p-4 shadow-2xl w-80 max-h-96">
        {/* Category tabs */}
        <div className="flex gap-1 mb-3 overflow-x-auto">
          {Object.keys(emojiCategories).map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? "default" : "ghost"}
              size="sm"
              className={`text-xs whitespace-nowrap ${
                activeCategory === category
                  ? "bg-cyan-500 hover:bg-cyan-600"
                  : "text-gray-400 hover:text-white hover:bg-slate-700"
              }`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Emoji grid */}
        <div className="grid grid-cols-8 gap-2 max-h-64 overflow-y-auto">
          {emojiCategories[activeCategory as keyof typeof emojiCategories].map((emoji, index) => (
            <button
              key={index}
              className="w-8 h-8 flex items-center justify-center text-xl hover:bg-slate-700 rounded transition-colors"
              onClick={() => {
                onEmojiSelect(emoji)
                onClose()
              }}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Recently used (placeholder) */}
        <div className="mt-3 pt-3 border-t border-slate-600">
          <div className="text-xs text-gray-400 mb-2">Recently used</div>
          <div className="flex gap-2">
            {["😀", "👍", "❤️", "🎉", "🔥"].map((emoji, index) => (
              <button
                key={index}
                className="w-8 h-8 flex items-center justify-center text-xl hover:bg-slate-700 rounded transition-colors"
                onClick={() => {
                  onEmojiSelect(emoji)
                  onClose()
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
