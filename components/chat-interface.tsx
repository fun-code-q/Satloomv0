"use client"

import type React from "react"
import { NotificationSystem } from "@/utils/notification-system"
import { MessageStorage } from "@/utils/message-storage"
import { UserPresenceSystem, type UserPresence } from "@/utils/user-presence"
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AnimatedLogo } from "./animated-logo"
import { SpaceBackground } from "./space-background"
import { UserActivityIndicators } from "./user-activity-indicators"
import {
  Mic,
  Video,
  Send,
  MoreVertical,
  Phone,
  VideoIcon,
  Film,
  Gamepad2,
  Settings,
  Info,
  X,
  Camera,
  Users,
  Smile,
  Copy,
} from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AttachmentMenu } from "./attachment-menu"
import { AudioCallModal } from "./audio-call-modal"
import { SettingsModal } from "./settings-modal"
import { AboutModal } from "./about-modal"
import { MessageBubble, type Message } from "./message-bubble"
import { MediaRecorder } from "./media-recorder"
import { IncomingCallNotification } from "./incoming-call-notification"
import { CallSignaling, type CallData } from "@/utils/call-signaling"
import { IncomingVideoCallNotification } from "./incoming-video-call-notification"
import { VideoCallModal } from "./video-call-modal"
import { PlaygroundSetupModal, type GameConfig } from "./playground-setup-modal"
import { DotsAndBoxesGameComponent } from "./dots-and-boxes-game"
import { useTheme } from "@/contexts/theme-context"
import { TheaterSetupModal } from "./theater-setup-modal"
import { TheaterFullscreen } from "./theater-fullscreen"
import { TheaterInviteNotification } from "./theater-invite-notification"
import { TheaterSignaling, type TheaterSession, type TheaterInvite } from "@/utils/theater-signaling"
import { EmojiPicker } from "./emoji-picker"
import { get, remove, ref, set, onValue } from "firebase/database"
import { database } from "@/lib/firebase"
import { QuizSetupModal } from "./quiz-setup-modal"
import { QuizQuestionBubble } from "./quiz-question-bubble"
import { QuizResultsBubble } from "./quiz-results-bubble"
import { QuizSystem, type QuizSession, type QuizAnswer, type QuizResult } from "@/utils/quiz-system"
import { GameInviteNotification } from "./game-invite-notification"

interface ChatInterfaceProps {
  roomId: string
  userProfile: { name: string; avatar?: string }
  onLeave: () => void
}

interface GameInvite {
  id: string
  roomId: string
  hostId: string
  hostName: string
  gameConfig: GameConfig
  timestamp: number
}

// Generate consistent colors for users
const getUserColor = (username: string): string => {
  const colors = [
    "#8b5cf6", // purple
    "#06b6d4", // cyan
    "#10b981", // emerald
    "#f59e0b", // amber
    "#ef4444", // red
    "#3b82f6", // blue
    "#8b5a2b", // brown
    "#6b7280", // gray
  ]

  let hash = 0
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function ChatInterface({ roomId, userProfile, onLeave }: ChatInterfaceProps) {
  console.log("ChatInterface: Initialized with roomId:", roomId)

  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<UserPresence[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  const quizTimerRef = useRef<NodeJS.Timeout>()

  const [showAudioCall, setShowAudioCall] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAbout, setShowAbout] = useState(false)
  const [showMediaRecorder, setShowMediaRecorder] = useState(false)
  const [mediaRecorderMode, setMediaRecorderMode] = useState<"audio" | "video" | "photo">("audio")

  // Call-related state
  const [incomingCall, setIncomingCall] = useState<CallData | null>(null)
  const [currentCall, setCurrentCall] = useState<CallData | null>(null)
  const [isInCall, setIsInCall] = useState(false)
  const [showVideoCall, setShowVideoCall] = useState(false)

  const [showPlaygroundSetup, setShowPlaygroundSetup] = useState(false)
  const [showPlayground, setShowPlayground] = useState(false)
  const [playgroundConfig, setPlaygroundConfig] = useState<GameConfig | null>(null)

  // Game invite state
  const [gameInvite, setGameInvite] = useState<GameInvite | null>(null)

  const [showTheaterSetup, setShowTheaterSetup] = useState(false)
  const [showTheaterFullscreen, setShowTheaterFullscreen] = useState(false)
  const [currentTheaterSession, setCurrentTheaterSession] = useState<TheaterSession | null>(null)
  const [theaterInvite, setTheaterInvite] = useState<TheaterInvite | null>(null)
  const [isTheaterHost, setIsTheaterHost] = useState(false)

  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false)
  const [isHost, setIsHost] = useState(false)

  // Quiz state
  const [showQuizSetup, setShowQuizSetup] = useState(false)
  const [currentQuizSession, setCurrentQuizSession] = useState<QuizSession | null>(null)
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([])
  const [quizResults, setQuizResults] = useState<QuizResult[]>([])
  const [quizTimeRemaining, setQuizTimeRemaining] = useState(0)
  const [userQuizAnswer, setUserQuizAnswer] = useState<string>("")
  const [showQuizResults, setShowQuizResults] = useState(false)

  const themeContext = useTheme()
  const notificationSystem = NotificationSystem.getInstance()
  const messageStorage = MessageStorage.getInstance()
  const userPresence = UserPresenceSystem.getInstance()
  const callSignaling = CallSignaling.getInstance()
  const theaterSignaling = TheaterSignaling.getInstance()
  const quizSystem = QuizSystem.getInstance()

  // Create unique user ID to prevent duplicates
  const currentUserId = useRef(userPresence.createUniqueUserId(userProfile.name)).current

  // Validate roomId on component mount and updates
  useEffect(() => {
    console.log("ChatInterface: roomId prop changed to:", roomId)
    if (!roomId || roomId.trim() === "") {
      console.error("ChatInterface: Invalid roomId received:", roomId)
    }
  }, [roomId])

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    console.log("ChatInterface: Initializing for room", roomId)

    // Validate roomId before proceeding
    if (!roomId || roomId.trim() === "") {
      console.error("ChatInterface: Cannot initialize with invalid roomId:", roomId)
      return
    }

    // COMPLETE state reset when entering a new room
    setMessages([])
    setReplyingTo(null)
    setIncomingCall(null)
    setCurrentCall(null)
    setIsInCall(false)
    setCurrentQuizSession(null)
    setQuizAnswers([])
    setQuizResults([])
    setUserQuizAnswer("")
    setShowQuizResults(false)
    setQuizTimeRemaining(0)
    setCurrentTheaterSession(null)
    setTheaterInvite(null)
    setIsTheaterHost(false)
    setOnlineUsers([])
    setGameInvite(null)

    // Clear all timers
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    if (quizTimerRef.current) {
      clearInterval(quizTimerRef.current)
    }

    // Force clear message storage cache
    messageStorage.clearMessages()

    // Initialize systems
    notificationSystem.setNotificationsEnabled(themeContext.notifications)
    notificationSystem.setSoundEnabled(themeContext.notificationSound)
    notificationSystem.requestPermission()

    // Set user online with cleaned user info
    const cleanUserInfo = {
      name: userProfile.name,
      currentActivity: "chat" as const,
    }

    // Only add avatar if it exists and is not empty
    if (userProfile.avatar && userProfile.avatar.trim() !== "") {
      cleanUserInfo.avatar = userProfile.avatar
    }

    userPresence.setUserOnline(currentUserId, roomId, cleanUserInfo)

    // Listen for messages with explicit room filtering
    const messageUnsubscribe = messageStorage.listenForMessages(roomId, (newMessages) => {
      console.log(`ChatInterface: Received ${newMessages.length} messages for room ${roomId}`)
      // Double-check room filtering on the client side
      const filteredMessages = newMessages.filter((msg) => {
        const msgRoomId = (msg as any).roomId
        return msgRoomId === roomId || !msgRoomId // Allow messages without roomId for backward compatibility
      })
      console.log(`ChatInterface: After filtering, ${filteredMessages.length} messages for room ${roomId}`)
      setMessages(filteredMessages)
    })

    // Listen for user presence
    const presenceUnsubscribe = userPresence.listenForPresence(roomId, (users) => {
      setOnlineUsers(users.filter((user) => user.status === "online"))
    })

    // Listen for calls
    const callUnsubscribe = callSignaling.listenForCalls(
      roomId,
      currentUserId,
      (call: CallData) => {
        // Only show incoming calls from OTHER users, not yourself
        if (call.callerId !== currentUserId && call.caller !== userProfile.name) {
          console.log("Incoming call received:", call)
          setIncomingCall(call)
          if (call.type === "video") {
            notificationSystem.incomingVideoCall(call.caller)
          } else {
            notificationSystem.incomingCall(call.caller)
          }
        }
      },
      (call: CallData) => {
        // Update calls for all participants
        console.log("Call update received:", call)
        if (call.participants.includes(currentUserId) || call.callerId === currentUserId) {
          setCurrentCall(call)
          if (call.status === "answered") {
            setIsInCall(true)
          } else if (call.status === "ended") {
            setIsInCall(false)
            setCurrentCall(null)
            setShowAudioCall(false)
            setShowVideoCall(false)
          }
        }
      },
    )

    // Listen for theater invites
    const theaterUnsubscribe = theaterSignaling.listenForInvites(roomId, currentUserId, (invite: TheaterInvite) => {
      if (invite.hostId !== currentUserId) {
        setTheaterInvite(invite)
        notificationSystem.theaterInvite(invite.host, invite.videoTitle)
      }
    })

    // Listen for game invites
    const gameInviteUnsubscribe = listenForGameInvites()

    notificationSystem.roomJoined(roomId)

    return () => {
      console.log("ChatInterface: Cleaning up for room", roomId)

      // Clean up all listeners and state
      messageUnsubscribe()
      presenceUnsubscribe()
      callUnsubscribe()
      theaterUnsubscribe()
      gameInviteUnsubscribe()

      // Clear all timers
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      if (quizTimerRef.current) {
        clearInterval(quizTimerRef.current)
      }

      // Clean up state
      setMessages([])
      setIncomingCall(null)
      setCurrentCall(null)
      setIsInCall(false)
      setCurrentQuizSession(null)
      setQuizAnswers([])
      setQuizResults([])

      userPresence.setUserOffline(roomId, currentUserId)
      messageStorage.cleanup()
      userPresence.cleanup()
      callSignaling.cleanup()
      theaterSignaling.cleanup()
      quizSystem.cleanup()
    }
  }, [roomId, currentUserId, userProfile, themeContext])

  useEffect(() => {
    // Check if current user is the host by checking who created the room
    const checkHostStatus = async () => {
      try {
        if (!database || !roomId) return

        const roomRef = ref(database, `rooms/${roomId}`)
        const snapshot = await get(roomRef)
        if (snapshot.exists()) {
          const roomData = snapshot.val()
          setIsHost(roomData.createdBy === userProfile.name)
        }
      } catch (error) {
        console.error("Error checking host status:", error)
      }
    }

    checkHostStatus()
  }, [roomId, userProfile.name])

  // Game invite system
  const listenForGameInvites = () => {
    if (!database || !roomId) return () => {}

    const gameInvitesRef = ref(database, `gameInvites/${roomId}`)

    // `onValue` returns an unsubscribe function, so we can use it directly
    const unsubscribe = onValue(gameInvitesRef, (snapshot) => {
      const invites = snapshot.val()
      if (invites) {
        Object.values(invites).forEach((invite: any) => {
          if (invite.hostId !== currentUserId && !gameInvite) {
            setGameInvite(invite)
            notificationSystem.success(`${invite.hostName} invited you to play ${invite.gameConfig.gameType} game!`)
          }
        })
      }
    })

    // Return a function so the caller can clean up the listener
    return () => unsubscribe()
  }

  const sendGameInvite = async (config: GameConfig) => {
    if (!database || !roomId) return

    const inviteId = `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const invite: GameInvite = {
      id: inviteId,
      roomId,
      hostId: currentUserId,
      hostName: userProfile.name,
      gameConfig: config,
      timestamp: Date.now(),
    }

    const inviteRef = ref(database, `gameInvites/${roomId}/${inviteId}`)
    await set(inviteRef, invite)

    // Auto-remove invite after 30 seconds
    setTimeout(async () => {
      try {
        await remove(inviteRef)
      } catch (error) {
        console.error("Error removing game invite:", error)
      }
    }, 30000)
  }

  const handleSendMessage = async () => {
    if (message.trim()) {
      try {
        // Check for quiz trigger
        if (message.trim().toLowerCase() === "?quiz?") {
          setShowQuizSetup(true)
          setMessage("")
          return
        }

        // Stop typing indicator
        setIsTyping(false)
        userPresence.setTyping(roomId, currentUserId, false)

        const newMessage: Omit<Message, "id"> = {
          text: message.trim(),
          sender: userProfile.name,
          timestamp: new Date(),
          replyTo: replyingTo
            ? {
                id: replyingTo.id,
                text: replyingTo.text,
                sender: replyingTo.sender,
              }
            : undefined,
          reactions: {
            heart: [],
            thumbsUp: [],
          },
        }

        await messageStorage.sendMessage(roomId, newMessage)
        setMessage("")
        setReplyingTo(null)
      } catch (error) {
        console.error("Error sending message:", error)
        notificationSystem.error("Failed to send message")
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    } else {
      // Handle typing indicator
      if (!isTyping) {
        setIsTyping(true)
        userPresence.setTyping(roomId, currentUserId, true)
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }

      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false)
        userPresence.setTyping(roomId, currentUserId, false)
      }, 2000)
    }
  }

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }

  const handleReply = (messageToReply: Message) => {
    setReplyingTo(messageToReply)
  }

  const handleReact = async (messageId: string, reaction: "heart" | "thumbsUp", userId: string) => {
    try {
      await messageStorage.addReaction(roomId, messageId, reaction, userId)
    } catch (error) {
      console.error("Error adding reaction:", error)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await messageStorage.deleteMessage(roomId, messageId)
    } catch (error) {
      console.error("Error deleting message:", error)
      notificationSystem.error("Failed to delete message")
    }
  }

  const handleEditMessage = async (messageId: string, newText: string) => {
    try {
      await messageStorage.editMessage(roomId, messageId, newText)
    } catch (error) {
      console.error("Error editing message:", error)
      notificationSystem.error("Failed to edit message")
    }
  }

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text)
    notificationSystem.success("Message copied to clipboard")
  }

  const handleFileSelect = async (type: string, file?: File | any) => {
    // Set file sending indicator
    userPresence.setSendingFile(roomId, currentUserId, true)

    try {
      let messageText = ""
      let fileData: any | undefined

      if (type === "location") {
        messageText = `📍 Location: ${file.latitude.toFixed(6)}, ${file.longitude.toFixed(6)}`
        if (file.accuracy) {
          messageText += ` (±${Math.round(file.accuracy)}m)`
        }
      } else if (type === "contact") {
        messageText = `👤 Contact: ${file.name}`
        if (file.phone) messageText += ` - ${file.phone}`
        if (file.email) messageText += ` - ${file.email}`
      } else if (file instanceof File) {
        const fileUrl = URL.createObjectURL(file)
        messageText = `📎 ${file.name}`
        fileData = {
          name: file.name,
          type: file.type,
          url: fileUrl,
          size: file.size,
        }
      }

      if (messageText) {
        const newMessage: Omit<Message, "id"> = {
          text: messageText,
          sender: userProfile.name,
          timestamp: new Date(),
          file: fileData,
          reactions: {
            heart: [],
            thumbsUp: [],
          },
        }

        await messageStorage.sendMessage(roomId, newMessage)
      }
    } catch (error) {
      console.error("Error sending file message:", error)
      notificationSystem.error("Failed to send file")
    } finally {
      // Clear file sending indicator
      userPresence.setSendingFile(roomId, currentUserId, false)
    }
  }

  const handleMediaRecorded = (file: File, type: string) => {
    handleFileSelect(type, file)
    setShowMediaRecorder(false)
  }

  const handleStartMediaRecording = (mode: "audio" | "video" | "photo") => {
    setMediaRecorderMode(mode)
    setShowMediaRecorder(true)

    // Set appropriate recording indicator
    if (mode === "audio") {
      userPresence.setRecordingVoice(roomId, currentUserId, true)
    } else if (mode === "video") {
      userPresence.setRecordingVideo(roomId, currentUserId, true)
    }
  }

  const handleStopMediaRecording = () => {
    // Clear recording indicators
    userPresence.setRecordingVoice(roomId, currentUserId, false)
    userPresence.setRecordingVideo(roomId, currentUserId, false)
  }

  const handleLeaveRoom = async () => {
    setShowLeaveConfirmation(true)
  }

  const handleConfirmLeave = async () => {
    try {
      if (isHost) {
        // Host is destroying the room - remove all data and kick everyone
        await userPresence.setUserOffline(roomId, currentUserId)

        if (database) {
          // Remove all room data from Firebase
          const roomRef = ref(database, `rooms/${roomId}`)
          await remove(roomRef)

          // Remove calls data
          const callsRef = ref(database, `calls/${roomId}`)
          await remove(callsRef)

          // Remove games data
          const gamesRef = ref(database, `games/${roomId}`)
          await remove(gamesRef)
        }

        notificationSystem.success("Room destroyed successfully")
      } else {
        // Member is leaving - only remove their presence
        await userPresence.setUserOffline(roomId, currentUserId)

        if (database) {
          // Remove user from room members
          const memberRef = ref(database, `rooms/${roomId}/members/${userProfile.name}`)
          await remove(memberRef)
        }

        notificationSystem.roomLeft(roomId)
      }

      setShowLeaveConfirmation(false)
      onLeave()
    } catch (error) {
      console.error("Error leaving room:", error)
      setShowLeaveConfirmation(false)
      onLeave()
    }
  }

  const handleCancelLeave = () => {
    setShowLeaveConfirmation(false)
  }

  const handleCopyRoomLink = () => {
    try {
      console.log("ChatInterface: Attempting to copy room link for roomId:", roomId)

      // Enhanced validation with detailed logging
      if (!roomId) {
        console.error("ChatInterface: roomId is null or undefined:", roomId)
        notificationSystem.error("Room ID is not available")
        return
      }

      if (typeof roomId !== "string") {
        console.error("ChatInterface: roomId is not a string:", typeof roomId, roomId)
        notificationSystem.error("Invalid room ID format")
        return
      }

      if (roomId.trim() === "") {
        console.error("ChatInterface: roomId is empty string")
        notificationSystem.error("Room ID is empty")
        return
      }

      // Get the current URL and construct the room link properly
      const baseUrl = window.location.origin + window.location.pathname
      const cleanRoomId = roomId.trim().toUpperCase()
      const roomLink = `${baseUrl}?room=${encodeURIComponent(cleanRoomId)}`

      console.log("ChatInterface: Copying room link:", roomLink)
      console.log("ChatInterface: Clean room ID:", cleanRoomId)

      navigator.clipboard
        .writeText(roomLink)
        .then(() => {
          console.log("ChatInterface: Successfully copied room link")
          notificationSystem.success(`Room link copied! Room ID: ${cleanRoomId}`)
        })
        .catch((error) => {
          console.error("ChatInterface: Failed to copy room link:", error)
          // Fallback for older browsers
          const textArea = document.createElement("textarea")
          textArea.value = roomLink
          textArea.style.position = "fixed"
          textArea.style.left = "-999999px"
          textArea.style.top = "-999999px"
          document.body.appendChild(textArea)
          textArea.focus()
          textArea.select()
          try {
            const successful = document.execCommand("copy")
            if (successful) {
              console.log("ChatInterface: Fallback copy successful")
              notificationSystem.success(`Room link copied! Room ID: ${cleanRoomId}`)
            } else {
              throw new Error("Fallback copy failed")
            }
          } catch (fallbackError) {
            console.error("ChatInterface: Fallback copy failed:", fallbackError)
            notificationSystem.error("Failed to copy room link. Please copy manually: " + roomLink)
          }
          document.body.removeChild(textArea)
        })
    } catch (error) {
      console.error("ChatInterface: Error in handleCopyRoomLink:", error)
      notificationSystem.error("Failed to create room link")
    }
  }

  // Call handling functions
  const handleStartAudioCall = async () => {
    try {
      console.log("Starting audio call...")
      const callId = await callSignaling.startCall(roomId, userProfile.name, currentUserId, "audio")
      console.log("Audio call started with ID:", callId)
      setShowAudioCall(true)
      userPresence.updateActivity(roomId, currentUserId, "call")
    } catch (error) {
      console.error("Error starting audio call:", error)
      notificationSystem.error("Failed to start audio call")
    }
  }

  const handleAnswerCall = () => {
    if (incomingCall) {
      setCurrentCall(incomingCall)
      setIncomingCall(null)
      setShowAudioCall(true)
      setIsInCall(true)
      userPresence.updateActivity(roomId, currentUserId, "call")
    }
  }

  const handleDeclineCall = () => {
    if (incomingCall) {
      callSignaling.endCall(roomId, incomingCall.id)
      setIncomingCall(null)
    }
  }

  const handleEndCall = () => {
    setShowAudioCall(false)
    setCurrentCall(null)
    setIsInCall(false)
    userPresence.updateActivity(roomId, currentUserId, "chat")
  }

  const handleStartVideoCall = async () => {
    try {
      console.log("Starting video call...")
      const callId = await callSignaling.startCall(roomId, userProfile.name, currentUserId, "video")
      console.log("Video call started with ID:", callId)
      setShowVideoCall(true)
      userPresence.updateActivity(roomId, currentUserId, "video-call")
    } catch (error) {
      console.error("Error starting video call:", error)
      notificationSystem.error("Failed to start video call")
    }
  }

  const handleAnswerVideoCall = () => {
    if (incomingCall && incomingCall.type === "video") {
      setCurrentCall(incomingCall)
      setIncomingCall(null)
      setShowVideoCall(true)
      setIsInCall(true)
      userPresence.updateActivity(roomId, currentUserId, "video-call")
    }
  }

  const handleEndVideoCall = () => {
    setShowVideoCall(false)
    setCurrentCall(null)
    setIsInCall(false)
    userPresence.updateActivity(roomId, currentUserId, "chat")
  }

  const handleStartTheater = () => {
    setShowTheaterSetup(true)
  }

  const handleCreateTheaterSession = async (videoUrl: string, videoType: "direct" | "youtube" | "vimeo") => {
    try {
      const sessionId = await theaterSignaling.createSession(
        roomId,
        userProfile.name,
        currentUserId,
        videoUrl,
        videoType,
      )

      const videoTitle = videoUrl.includes("youtube")
        ? "YouTube Video"
        : videoUrl.includes("vimeo")
          ? "Vimeo Video"
          : "Video"

      await theaterSignaling.sendInvite(roomId, sessionId, userProfile.name, currentUserId, videoTitle)

      const session = theaterSignaling.getCurrentSession()
      if (session) {
        setCurrentTheaterSession(session)
        setIsTheaterHost(true)
        setShowTheaterFullscreen(true)
        userPresence.updateActivity(roomId, currentUserId, "theater")
      }
    } catch (error) {
      console.error("Error creating theater session:", error)
      notificationSystem.error("Failed to create theater session")
    }
  }

  const handleAcceptTheaterInvite = async () => {
    if (!theaterInvite) return

    try {
      await theaterSignaling.joinSession(roomId, theaterInvite.sessionId, currentUserId)

      const unsubscribe = theaterSignaling.listenForSession(roomId, theaterInvite.sessionId, (session) => {
        setCurrentTheaterSession(session)
        setShowTheaterFullscreen(true)
        userPresence.updateActivity(roomId, currentUserId, "theater")
      })

      setIsTheaterHost(false)
      setTheaterInvite(null)
    } catch (error) {
      console.error("Error joining theater session:", error)
      notificationSystem.error("Failed to join theater session")
    }
  }

  const handleDeclineTheaterInvite = () => {
    setTheaterInvite(null)
  }

  const handleExitTheater = async () => {
    if (currentTheaterSession && isTheaterHost) {
      await theaterSignaling.endSession(roomId, currentTheaterSession.id)
    }

    setShowTheaterFullscreen(false)
    setCurrentTheaterSession(null)
    setIsTheaterHost(false)
    userPresence.updateActivity(roomId, currentUserId, "chat")
  }

  const handleStartPlayground = async (config: GameConfig) => {
    if (config.gameType === "single") {
      // Single player - start immediately
      setPlaygroundConfig(config)
      setShowPlaygroundSetup(false)
      setShowPlayground(true)
      userPresence.updateActivity(roomId, currentUserId, "game")
    } else {
      // Multiplayer - send invite to others
      await sendGameInvite(config)
      setPlaygroundConfig(config)
      setShowPlaygroundSetup(false)
      setShowPlayground(true)
      userPresence.updateActivity(roomId, currentUserId, "game")
    }
  }

  const handleAcceptGameInvite = () => {
    if (gameInvite) {
      setPlaygroundConfig(gameInvite.gameConfig)
      setShowPlayground(true)
      setGameInvite(null)
      userPresence.updateActivity(roomId, currentUserId, "game")
    }
  }

  const handleDeclineGameInvite = () => {
    setGameInvite(null)
  }

  const handleExitPlayground = () => {
    setShowPlayground(false)
    setPlaygroundConfig(null)
    userPresence.updateActivity(roomId, currentUserId, "chat")
  }

  const menuItems = [
    { icon: Phone, label: "Audio Call", action: handleStartAudioCall },
    { icon: VideoIcon, label: "Video Call", action: handleStartVideoCall },
    { icon: Film, label: "Movie Theater", action: handleStartTheater },
    { icon: Gamepad2, label: "Play Ground", action: () => setShowPlaygroundSetup(true) },
    { icon: Settings, label: "Settings", action: () => setShowSettings(true) },
    { icon: Info, label: "About", action: () => setShowAbout(true) },
  ]

  // Quiz handlers
  const handleStartQuiz = async (topic?: string) => {
    try {
      const sessionId = await quizSystem.createQuizSession(roomId, currentUserId, userProfile.name, topic)

      // Join the quiz session (even if single player)
      await quizSystem.joinQuizSession(roomId, sessionId, currentUserId)

      // Listen for quiz session updates
      const unsubscribe = quizSystem.listenForQuizSession(roomId, sessionId, (session) => {
        setCurrentQuizSession(session)

        if (session.status === "active") {
          startQuizTimer(10) // 10 seconds per question
        }

        if (session.status === "finished") {
          handleQuizFinished(sessionId)
        }
      })

      // Listen for quiz answers
      const answersUnsubscribe = quizSystem.listenForQuizAnswers(roomId, sessionId, (answers) => {
        setQuizAnswers(answers)
      })

      // Start the quiz immediately (no waiting for others)
      setTimeout(() => {
        quizSystem.startQuiz(roomId, sessionId)
      }, 1000)

      notificationSystem.success(topic ? `${topic} quiz started!` : "Random quiz started!")
    } catch (error) {
      console.error("Error starting quiz:", error)
      notificationSystem.error("Failed to start quiz")
    }
  }

  const startQuizTimer = (timePerQuestion: number) => {
    setQuizTimeRemaining(timePerQuestion)

    if (quizTimerRef.current) {
      clearInterval(quizTimerRef.current)
    }

    quizTimerRef.current = setInterval(() => {
      setQuizTimeRemaining((prev) => {
        if (prev <= 1) {
          handleQuizTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleQuizTimeout = () => {
    if (quizTimerRef.current) {
      clearInterval(quizTimerRef.current)
    }

    if (currentQuizSession) {
      handleNextQuestion()
    }
  }

  const handleQuizAnswer = async (answer: string) => {
    if (!currentQuizSession || userQuizAnswer) return

    const currentQuestion = currentQuizSession.questions[currentQuizSession.currentQuestionIndex]
    const timeToAnswer = 10 - quizTimeRemaining // Changed from 30 to 10

    setUserQuizAnswer(answer)

    try {
      await quizSystem.submitAnswer(
        roomId,
        currentQuizSession.id,
        currentUserId,
        userProfile.name,
        currentQuestion.id,
        answer,
        currentQuestion.correctAnswer,
        timeToAnswer,
      )
    } catch (error) {
      console.error("Error submitting quiz answer:", error)
    }
  }

  const handleNextQuestion = async () => {
    if (!currentQuizSession) return

    setShowQuizResults(true)

    setTimeout(async () => {
      setShowQuizResults(false)
      setUserQuizAnswer("")

      if (currentQuizSession.currentQuestionIndex + 1 >= currentQuizSession.totalQuestions) {
        await quizSystem.endQuiz(roomId, currentQuizSession.id)
      } else {
        await quizSystem.nextQuestion(roomId, currentQuizSession.id, currentQuizSession.currentQuestionIndex)
      }
    }, 3000)
  }

  const handleQuizFinished = async (sessionId: string) => {
    if (quizTimerRef.current) {
      clearInterval(quizTimerRef.current)
    }

    try {
      const results = await quizSystem.calculateResults(roomId, sessionId)
      setQuizResults(results)

      // Clean up after showing results
      setTimeout(() => {
        setCurrentQuizSession(null)
        setQuizAnswers([])
        setQuizResults([])
        setUserQuizAnswer("")
        setShowQuizResults(false)
      }, 15000)
    } catch (error) {
      console.error("Error calculating quiz results:", error)
    }
  }

  const handleExitQuiz = async () => {
    if (quizTimerRef.current) {
      clearInterval(quizTimerRef.current)
    }

    if (currentQuizSession) {
      try {
        await quizSystem.endQuiz(roomId, currentQuizSession.id)
        await quizSystem.cleanupQuizSession(roomId, currentQuizSession.id)
      } catch (error) {
        console.error("Error exiting quiz:", error)
      }
    }

    // Reset all quiz state
    setCurrentQuizSession(null)
    setQuizAnswers([])
    setQuizResults([])
    setUserQuizAnswer("")
    setShowQuizResults(false)
    setQuizTimeRemaining(0)

    notificationSystem.success("Quiz exited")
  }

  const getQuizParticipants = () => {
    if (!currentQuizSession) return []

    // Include all participants, even if they're not currently online
    return currentQuizSession.participants.map((participantId) => {
      const user = onlineUsers.find((u) => u.id === participantId)
      const hasAnswered = quizAnswers.some(
        (a) =>
          a.playerId === participantId &&
          a.questionId === currentQuizSession.questions[currentQuizSession.currentQuestionIndex]?.id,
      )

      return {
        id: participantId,
        name: user?.name || "Unknown",
        hasAnswered,
      }
    })
  }

  // Early return if roomId is invalid
  if (!roomId || roomId.trim() === "") {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <div className="text-xl mb-4">Error: Invalid Room ID</div>
          <div className="text-gray-400 mb-4">Room ID: "{roomId}"</div>
          <button onClick={onLeave} className="bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded">
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col relative">
      <SpaceBackground />

      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700">
        <div className="flex items-center gap-4">
          <AnimatedLogo />
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-400">{onlineUsers.length} online</span>
          </div>
          <div className="text-xs text-gray-500">Room: {roomId}</div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-slate-700 bg-slate-800 border border-slate-600"
            onClick={handleCopyRoomLink}
            title={`Copy Room Link (${roomId})`}
          >
            <Copy className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-red-600 bg-red-500 border border-red-400"
            onClick={handleLeaveRoom}
            title={isHost ? "Destroy Room" : "Leave Room"}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </Button>

          <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-slate-700">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="bottom"
              className="bg-slate-800 border-slate-700 text-white min-w-48"
              sideOffset={5}
            >
              {menuItems.map((item, index) => (
                <DropdownMenuItem key={index} onClick={item.action} className="hover:bg-slate-700 cursor-pointer">
                  <item.icon className="w-4 h-4 mr-3" />
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Online Users Bar */}
      {onlineUsers.length > 1 && (
        <div className="px-4 py-2 bg-slate-800/50 border-b border-slate-700">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-xs text-gray-400 whitespace-nowrap">Online:</span>
            {onlineUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center gap-1 bg-slate-700/50 rounded-full px-2 py-1 whitespace-nowrap"
              >
                {user.avatar ? (
                  <img src={user.avatar || "/placeholder.svg"} alt={user.name} className="w-4 h-4 rounded-full" />
                ) : (
                  <div className="w-4 h-4 rounded-full bg-slate-600 flex items-center justify-center">
                    <span className="text-xs">{user.name[0]}</span>
                  </div>
                )}
                <span className="text-xs text-white">{user.name}</span>
                {user.currentActivity && user.currentActivity !== "chat" && (
                  <span className="text-xs text-cyan-400">({user.currentActivity})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User Activity Indicators */}
      <UserActivityIndicators users={onlineUsers} currentUserId={currentUserId} />

      {/* Chat Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-2">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <div className="text-4xl mb-4">💬</div>
              <p>No messages yet. Start the conversation!</p>
              <p className="text-xs mt-2">Room ID: {roomId}</p>
            </div>
          ) : (
            messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwnMessage={msg.sender === userProfile.name}
                userColor={getUserColor(msg.sender)}
                currentUser={userProfile.name}
                userAvatar={onlineUsers.find((u) => u.name === msg.sender)?.avatar}
                onReply={handleReply}
                onReact={handleReact}
                onDelete={handleDeleteMessage}
                onEdit={handleEditMessage}
                onCopy={handleCopyMessage}
              />
            ))
          )}

          {/* Quiz Question */}
          {currentQuizSession &&
            currentQuizSession.status === "active" &&
            currentQuizSession.questions[currentQuizSession.currentQuestionIndex] && (
              <QuizQuestionBubble
                question={currentQuizSession.questions[currentQuizSession.currentQuestionIndex]}
                currentQuestionNumber={currentQuizSession.currentQuestionIndex + 1}
                totalQuestions={currentQuizSession.totalQuestions}
                timeRemaining={quizTimeRemaining}
                participants={getQuizParticipants()}
                userAnswer={userQuizAnswer}
                onAnswer={handleQuizAnswer}
                onExit={handleExitQuiz}
                showResults={showQuizResults}
                correctAnswer={
                  showQuizResults
                    ? currentQuizSession.questions[currentQuizSession.currentQuestionIndex].correctAnswer
                    : undefined
                }
                answers={
                  showQuizResults
                    ? quizAnswers.filter(
                        (a) =>
                          a.questionId === currentQuizSession.questions[currentQuizSession.currentQuestionIndex].id,
                      )
                    : []
                }
              />
            )}

          {/* Quiz Results */}
          {currentQuizSession && currentQuizSession.status === "finished" && quizResults.length > 0 && (
            <QuizResultsBubble results={quizResults} totalQuestions={currentQuizSession.totalQuestions} />
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Reply indicator */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-800/60 border-t border-slate-700">
          <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-2">
            <div className="flex-1">
              <div className="text-xs text-cyan-400 font-medium">Replying to {replyingTo.sender}</div>
              <div className="text-xs text-gray-300 truncate">{replyingTo.text}</div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-white"
              onClick={() => setReplyingTo(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <div className="p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700 relative">
        <div className="flex items-center gap-2">
          <AttachmentMenu onFileSelect={handleFileSelect} />

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-slate-700"
            onClick={() => handleStartMediaRecording("audio")}
          >
            <Mic className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-slate-700"
            onClick={() => handleStartMediaRecording("video")}
          >
            <Video className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-slate-700"
            onClick={() => handleStartMediaRecording("photo")}
          >
            <Camera className="w-4 h-4" />
          </Button>

          <Input
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-slate-800 border-slate-600 text-white placeholder-gray-400"
            maxLength={1000}
          />

          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-slate-700"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="w-4 h-4" />
          </Button>

          <Button onClick={handleSendMessage} className="bg-cyan-500 hover:bg-cyan-600" disabled={!message.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {/* Emoji Picker */}
        <EmojiPicker
          isOpen={showEmojiPicker}
          onClose={() => setShowEmojiPicker(false)}
          onEmojiSelect={handleEmojiSelect}
        />
      </div>

      {/* Incoming Call Notifications */}
      {incomingCall && incomingCall.type === "audio" && (
        <IncomingCallNotification call={incomingCall} onAnswer={handleAnswerCall} onDecline={handleDeclineCall} />
      )}

      {incomingCall && incomingCall.type === "video" && (
        <IncomingVideoCallNotification
          call={incomingCall}
          onAnswer={handleAnswerVideoCall}
          onDecline={handleDeclineCall}
        />
      )}

      {/* Theater Invite Notification */}
      {theaterInvite && (
        <TheaterInviteNotification
          invite={theaterInvite}
          onAccept={handleAcceptTheaterInvite}
          onDecline={handleDeclineTheaterInvite}
        />
      )}

      {/* Game Invite Notification */}
      {gameInvite && (
        <GameInviteNotification
          invite={gameInvite}
          onAccept={handleAcceptGameInvite}
          onDecline={handleDeclineGameInvite}
        />
      )}

      {/* Modals */}
      <AudioCallModal
        isOpen={showAudioCall}
        onClose={handleEndCall}
        roomId={roomId}
        currentUser={userProfile.name}
        currentUserId={currentUserId}
        callData={currentCall}
        isIncoming={!!currentCall && currentCall.callerId !== currentUserId}
      />

      <VideoCallModal
        isOpen={showVideoCall}
        onClose={handleEndVideoCall}
        roomId={roomId}
        currentUser={userProfile.name}
        currentUserId={currentUserId}
        callData={currentCall}
        isIncoming={!!currentCall && currentCall.callerId !== currentUserId}
      />

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <AboutModal isOpen={showAbout} onClose={() => setShowAbout(false)} />

      <MediaRecorder
        isOpen={showMediaRecorder}
        onClose={() => {
          setShowMediaRecorder(false)
          handleStopMediaRecording()
        }}
        mode={mediaRecorderMode}
        onMediaReady={handleMediaRecorded}
      />

      <PlaygroundSetupModal
        isOpen={showPlaygroundSetup}
        onClose={() => setShowPlaygroundSetup(false)}
        onStartGame={handleStartPlayground}
      />

      <TheaterSetupModal
        isOpen={showTheaterSetup}
        onClose={() => setShowTheaterSetup(false)}
        onCreateSession={handleCreateTheaterSession}
      />

      {/* Full-screen overlays */}
      {showPlayground && playgroundConfig && (
        <div className="fixed inset-0 z-50 bg-slate-900">
          <DotsAndBoxesGameComponent
            gameConfig={playgroundConfig}
            roomId={roomId}
            currentUserId={currentUserId}
            onExit={handleExitPlayground}
          />
        </div>
      )}

      {currentTheaterSession && (
        <TheaterFullscreen
          isOpen={showTheaterFullscreen}
          onClose={handleExitTheater}
          session={currentTheaterSession}
          roomId={roomId}
          currentUser={userProfile.name}
          currentUserId={currentUserId}
          isHost={isTheaterHost}
        />
      )}
      {/* Leave/Destroy Room Confirmation Modal */}
      {showLeaveConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 text-center max-w-md mx-4">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">{isHost ? "Destroy Room?" : "Leave Room?"}</h2>

            <p className="text-gray-300 mb-6">
              {isHost
                ? "This will permanently delete the room and remove all members. This action cannot be undone."
                : "Are you sure you want to leave this room? You can rejoin later with the room ID."}
            </p>

            <div className="flex gap-4 justify-center">
              <Button onClick={handleConfirmLeave} className="bg-red-500 hover:bg-red-600 text-white px-6">
                {isHost ? "Yes, Destroy" : "Yes, Leave"}
              </Button>
              <Button
                onClick={handleCancelLeave}
                variant="outline"
                className="border-slate-600 text-white hover:bg-slate-700 bg-transparent px-6"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <QuizSetupModal isOpen={showQuizSetup} onClose={() => setShowQuizSetup(false)} onStartQuiz={handleStartQuiz} />
    </div>
  )
}
