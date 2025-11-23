"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Heart, ThumbsUp, Reply, MoreVertical, Trash2, Download, Play, User, Copy, Edit } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { parseUrls, parseEmojis } from "@/utils/message-formatter"
import { FilePreview } from "./file-preview"

export interface Message {
  id: string
  text: string
  sender: string
  senderId?: string // Added senderId to interface
  timestamp: Date
  replyTo?: {
    id: string
    text: string
    sender: string
  }
  reactions?: {
    heart: string[]
    thumbsUp: string[]
  }
  file?: {
    name: string
    type: string
    url: string
    size?: number
  }
  edited?: boolean
  editedAt?: Date
  type?: string
  gameInvite?: any
}

interface MessageBubbleProps {
  message: Message
  isOwnMessage: boolean
  userColor: string
  currentUser: string
  userAvatar?: string
  onReply: (message: Message) => void
  onReact: (messageId: string, reaction: "heart" | "thumbsUp", userId: string) => void
  onDelete: (messageId: string) => void
  onEdit?: (messageId: string, newText: string) => void
  onCopy?: (text: string) => void
}

export function MessageBubble({
  message,
  isOwnMessage,
  userColor,
  currentUser,
  userAvatar,
  onReply,
  onReact,
  onDelete,
  onEdit,
  onCopy,
}: MessageBubbleProps) {
  const [showFilePreview, setShowFilePreview] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(message.text)

  const handleReaction = (reaction: "heart" | "thumbsUp") => {
    console.log("Handling reaction:", reaction, "for message:", message.id)
    onReact(message.id, reaction, currentUser)
  }

  const handleReply = () => {
    console.log("Handling reply for message:", message.id)
    onReply(message)
  }

  const handleDelete = () => {
    console.log("Handling delete for message:", message.id)
    onDelete(message.id)
  }

  const handleEdit = () => {
    if (onEdit && editText.trim() !== message.text && editText.trim() !== "") {
      console.log("Handling edit for message:", message.id, "new text:", editText.trim())
      onEdit(message.id, editText.trim())
    }
    setIsEditing(false)
  }

  const handleStartEdit = () => {
    console.log("Starting edit for message:", message.id)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    console.log("Canceling edit for message:", message.id)
    setIsEditing(false)
    setEditText(message.text)
  }

  const handleCopy = () => {
    console.log("Handling copy for message:", message.id)
    if (onCopy) {
      onCopy(message.text)
    } else {
      navigator.clipboard
        .writeText(message.text)
        .then(() => {
          console.log("Text copied to clipboard")
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err)
        })
    }
  }

  const heartCount = message.reactions?.heart?.length || 0
  const thumbsUpCount = message.reactions?.thumbsUp?.length || 0
  const hasUserHearted = message.reactions?.heart?.includes(currentUser)
  const hasUserThumbsUp = message.reactions?.thumbsUp?.includes(currentUser)

  const isImage = message.file?.type.startsWith("image/")
  const isVideo = message.file?.type.startsWith("video/")
  const isAudio = message.file?.type.startsWith("audio/")

  const isSystemMessage = message.type === "system" || message.sender === "System"

  if (isSystemMessage) {
    let displayText = message.text
    if (isOwnMessage) {
      displayText = displayText.replace(message.sender, "You")
    }

    return (
      <div className="flex justify-center mb-4 w-full">
        <div className="bg-slate-800/80 text-gray-400 text-xs px-4 py-1.5 rounded-full border border-slate-700/50 shadow-sm backdrop-blur-sm text-center max-w-[80%]">
          {displayText}
        </div>
      </div>
    )
  }

  const renderFilePreview = () => {
    if (!message.file) return null

    if (isImage) {
      return (
        <div className="mt-2 cursor-pointer" onClick={() => setShowFilePreview(true)}>
          <img
            src={message.file.url || "/placeholder.svg"}
            alt={message.file.name}
            className="max-w-64 max-h-48 rounded-lg object-cover"
            loading="lazy"
          />
        </div>
      )
    }

    if (isVideo) {
      return (
        <div className="mt-2 cursor-pointer relative" onClick={() => setShowFilePreview(true)}>
          <video className="max-w-64 max-h-48 rounded-lg object-cover" muted>
            <source src={message.file.url} type={message.file.type} />
          </video>
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
            <Play className="w-8 h-8 text-white" />
          </div>
        </div>
      )
    }

    if (isAudio) {
      return (
        <div className="mt-2 bg-slate-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center">
              <Play className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-medium">{message.file.name}</span>
          </div>
          <audio controls className="w-full">
            <source src={message.file.url} type={message.file.type} />
          </audio>
        </div>
      )
    }

    // Other file types
    return (
      <div className="mt-2 bg-slate-700/50 rounded-lg p-3 cursor-pointer" onClick={() => setShowFilePreview(true)}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-xs">📄</span>
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium">{message.file.name}</div>
            <div className="text-xs text-gray-400">{message.file.type}</div>
          </div>
          <Download className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    )
  }

  const processedText = parseEmojis(message.text)

  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"} mb-4`}>
      <div className={`max-w-md ${isOwnMessage ? "order-2" : "order-1"}`}>
        {/* Reply indicator */}
        {message.replyTo && (
          <div className="mb-2 px-3 py-2 bg-slate-700/50 rounded-lg border-l-2 border-cyan-400">
            <div className="text-xs text-cyan-400 font-medium">{message.replyTo.sender}</div>
            <div className="text-xs text-gray-300 truncate">{message.replyTo.text}</div>
          </div>
        )}

        {/* Message bubble */}
        <div
          className={`relative group rounded-lg p-3 ${isOwnMessage ? "bg-cyan-600 text-white ml-auto" : `text-white`}`}
          style={{
            backgroundColor: isOwnMessage ? "#0891b2" : userColor,
          }}
        >
          {/* User info inside message bubble */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-full border border-slate-600 flex items-center justify-center bg-slate-700 overflow-hidden flex-shrink-0">
              {userAvatar ? (
                <img
                  src={userAvatar || "/placeholder.svg"}
                  alt={message.sender}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                    const nextEl = e.currentTarget.nextElementSibling as HTMLElement
                    if (nextEl) nextEl.classList.remove("hidden")
                  }}
                />
              ) : null}
              <User className={`w-3 h-3 text-gray-300 ${userAvatar ? "hidden" : ""}`} />
            </div>
            <span className="text-xs font-medium text-gray-200 opacity-90">{message.sender}</span>
          </div>

          {/* Message text with formatting */}
          {isEditing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full bg-slate-700 text-white rounded p-2 text-sm resize-none border border-slate-600 focus:border-slate-500"
                rows={3}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleEdit()
                  }
                  if (e.key === "Escape") {
                    handleCancelEdit()
                  }
                }}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEdit} className="bg-green-500 hover:bg-green-600 text-xs px-3 py-1">
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancelEdit}
                  className="text-xs px-3 py-1 border-slate-600 text-slate-300 hover:bg-slate-700 bg-transparent"
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            message.text && (
              <div className="text-sm leading-relaxed">
                {parseUrls(processedText).map((part, index) => (
                  <span key={index}>{part}</span>
                ))}
              </div>
            )
          )}

          {/* File preview */}
          {renderFilePreview()}

          {/* Timestamp and options */}
          <div className="text-xs opacity-70 mt-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>{message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              {message.edited && <span className="text-xs opacity-50">(edited)</span>}
            </div>

            {!isEditing && (
              <div className="flex items-center gap-1">
                {/* Quick reaction buttons */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700/50 hover:text-red-400"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleReaction("heart")
                  }}
                  title="Heart"
                >
                  <Heart className={`w-3 h-3 ${hasUserHearted ? "fill-red-400 text-red-400" : "text-red-400"}`} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700/50 hover:text-blue-400"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleReaction("thumbsUp")
                  }}
                  title="Thumbs Up"
                >
                  <ThumbsUp
                    className={`w-3 h-3 ${hasUserThumbsUp ? "fill-blue-400 text-blue-400" : "text-blue-400"}`}
                  />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700/50"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleReply()
                  }}
                  title="Reply"
                >
                  <Reply className="w-3 h-3 text-gray-400" />
                </Button>

                {/* Message options menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-700/50"
                    >
                      <MoreVertical className="w-3 h-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="bg-slate-800 border-slate-700 text-white min-w-[120px]"
                    style={{ zIndex: 50 }}
                  >
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleCopy()
                      }}
                      className="hover:bg-slate-700 cursor-pointer focus:bg-slate-700 flex items-center gap-2"
                    >
                      <Copy className="w-4 h-4" />
                      Copy
                    </DropdownMenuItem>
                    {isOwnMessage && onEdit && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleStartEdit()
                        }}
                        className="hover:bg-slate-700 cursor-pointer focus:bg-slate-700 flex items-center gap-2"
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </DropdownMenuItem>
                    )}
                    {isOwnMessage && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDelete()
                        }}
                        className="hover:bg-slate-700 cursor-pointer text-red-400 focus:bg-slate-700 focus:text-red-400 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </div>

        {/* Reaction counts */}
        {(heartCount > 0 || thumbsUpCount > 0) && !isEditing && (
          <div className="flex gap-2 mt-1 text-xs">
            {heartCount > 0 && (
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded-full cursor-pointer transition-colors border-0 bg-transparent ${
                  hasUserHearted
                    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                    : "bg-slate-700/50 text-gray-400 hover:bg-slate-600/50"
                }`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleReaction("heart")
                }}
                type="button"
                title={`${heartCount} heart${heartCount !== 1 ? "s" : ""}`}
              >
                <Heart className={`w-3 h-3 ${hasUserHearted ? "fill-current" : ""}`} />
                <span>{heartCount}</span>
              </button>
            )}
            {thumbsUpCount > 0 && (
              <button
                className={`flex items-center gap-1 px-2 py-1 rounded-full cursor-pointer transition-colors border-0 bg-transparent ${
                  hasUserThumbsUp
                    ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                    : "bg-slate-700/50 text-gray-400 hover:bg-slate-600/50"
                }`}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  handleReaction("thumbsUp")
                }}
                type="button"
                title={`${thumbsUpCount} thumbs up`}
              >
                <ThumbsUp className={`w-3 h-3 ${hasUserThumbsUp ? "fill-current" : ""}`} />
                <span>{thumbsUpCount}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* File Preview Modal */}
      {message.file && (
        <FilePreview isOpen={showFilePreview} onClose={() => setShowFilePreview(false)} file={message.file} />
      )}
    </div>
  )
}
