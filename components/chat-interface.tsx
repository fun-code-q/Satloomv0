"use client"

import type React from "react"
import { NotificationSystem } from "@/utils/notification-system"
import { MessageStorage } from "@/utils/message-storage"
import { UserPresenceSystem, type UserPresence } from "@/utils/user-presence"
import { GameSignaling } from "@/utils/game-signaling"
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
import { QuizSetupModal } from "./quiz-setup-modal"
import { QuizSystem, type QuizSession, type QuizAnswer, type QuizResult } from "@/utils/quiz-system"
import { GameInviteNotification } from "./game-invite-notification"
import { MediaMenu } from "./media-menu"
import { useMediaQuery } from "@/hooks/use-media-query"
import { QuizQuestionBubble } from "./quiz-question-bubble"
import { QuizResultsBubble } from "./quiz-results-bubble"
import { database } from "@/lib/firebase"
import { onValue, ref } from "firebase/database"

interface ChatInterfaceProps {
  roomId: string
  userProfile: { name: string; avatar?: string }
  onLeave: () => void
  isHost?: boolean
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

export function ChatInterface({ roomId, userProfile, onLeave, isHost = false }: ChatInterfaceProps) {
  console.log("ChatInterface: Initialized with roomId:", roomId)

  // Check if we're on mobile
  const isMobile = useMediaQuery("(max-width: 768px)")

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
  const [isGameHost, setIsGameHost] = useState(false)

  // Game invite state
  const [gameInvite, setGameInvite] = useState<GameInvite | null>(null)

  const [showTheaterSetup, setShowTheaterSetup] = useState(false)
  const [showTheaterFullscreen, setShowTheaterFullscreen] = useState(false)
  const [currentTheaterSession, setCurrentTheaterSession] = useState<TheaterSession | null>(null)
  const [theaterInvite, setTheaterInvite] = useState<TheaterInvite | null>(null)
  const [isTheaterHost, setIsTheaterHost] = useState(false)

  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false)

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
  const gameSignaling = GameSignaling.getInstance()

  // Create unique user ID to prevent duplicates
  const currentUserId = useRef(userPresence.createUniqueUserId(userProfile.name)).current

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Initialize systems and listeners
  useEffect(() => {
    console.log("ChatInterface: Initializing for room", roomId)

    if (!roomId || roomId.trim() === "") {
      console.error("ChatInterface: Cannot initialize with invalid roomId:", roomId)
      return
    }

    // Initialize systems
    notificationSystem.setNotificationsEnabled(themeContext.notifications)
    notificationSystem.setSoundEnabled(themeContext.notificationSound)
    notificationSystem.requestPermission()

    // Set user online
    const cleanUserInfo = {
      name: userProfile.name,
      currentActivity: "chat" as const,
    }

    if (userProfile.avatar && userProfile.avatar.trim() !== "") {
      cleanUserInfo.avatar = userProfile.avatar
    }

    userPresence.setUserOnline(currentUserId, roomId, cleanUserInfo)

    // Listen for messages
    const messageUnsubscribe = messageStorage.listenForMessages(roomId, (newMessages) => {
      setMessages(newMessages)
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
        if (call.callerId !== currentUserId && call.caller !== userProfile.name) {
          setIncomingCall(call)
          if (call.type === "video") {
            notificationSystem.incomingVideoCall(call.caller)
          } else {
            notificationSystem.incomingCall(call.caller)
          }
        }
      },
      (call: CallData) => {
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

    // Listen for quiz sessions in the room
    const quizUnsubscribe = database
      ? onValue(ref(database, `rooms/${roomId}/quiz`), (snapshot) => {
          const quizSessions = snapshot.val()
          if (quizSessions) {
            // Find active quiz sessions
            const activeSessions = Object.values(quizSessions).filter(
              (session: any) => session.status === "active" || session.status === "waiting",
            )

            if (activeSessions.length > 0 && !currentQuizSession) {
              const activeSession = activeSessions[0] as QuizSession

              // Auto-join the quiz if user is not already participating
              if (!activeSession.participants.includes(currentUserId)) {
                quizSystem.joinQuizSession(roomId, activeSession.id, currentUserId)
              }

              // Start listening to this quiz session
              const sessionUnsubscribe = quizSystem.listenForQuizSession(roomId, activeSession.id, (session) => {
                setCurrentQuizSession(session)

                if (session.status === "active") {
                  setQuizTimeRemaining(session.timePerQuestion)
                  setUserQuizAnswer("")
                  setShowQuizResults(false)

                  if (quizTimerRef.current) {
                    clearInterval(quizTimerRef.current)
                  }

                  let timeLeft = session.timePerQuestion
                  quizTimerRef.current = setInterval(() => {
                    timeLeft--
                    setQuizTimeRemaining(timeLeft)

                    if (timeLeft <= 0) {
                      clearInterval(quizTimerRef.current!)
                      if (!userQuizAnswer) {
                        handleQuizAnswer("")
                      }
                    }
                  }, 1000)
                }
              })

              // Listen for quiz answers
              quizSystem.listenForQuizAnswers(roomId, activeSession.id, (answers) => {
                setQuizAnswers(answers)
              })
            }
          }
        })
      : () => {}

    return () => {
      messageUnsubscribe()
      presenceUnsubscribe()
      callUnsubscribe()
      theaterUnsubscribe()
      quizUnsubscribe()
      userPresence.setUserOffline(roomId, currentUserId)
      callSignaling.cleanup()
    }
  }, [roomId, currentUserId, userProfile, themeContext])

  const handleSendMessage = async () => {
    if (message.trim()) {
      try {
        // Check for quiz trigger
        if (message.trim() === "?quiz?") {
          handleStartQuiz()
          setMessage("")
          return
        }

        const newMessage: Omit<Message, "id"> = {
          text: message.trim(),
          sender: userProfile.name,
          timestamp: new Date(),
          reactions: {
            heart: [],
            thumbsUp: [],
          },
        }

        if (replyingTo) {
          newMessage.replyTo = {
            id: replyingTo.id,
            text: replyingTo.text,
            sender: replyingTo.sender,
          }
        }

        await messageStorage.sendMessage(roomId, newMessage)
        setMessage("")
        setReplyingTo(null)

        // Clear typing indicator
        userPresence.setTyping(roomId, currentUserId, false)
        setIsTyping(false)
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
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessage(e.target.value)

    // Handle typing indicator
    if (!isTyping) {
      setIsTyping(true)
      userPresence.setTyping(roomId, currentUserId, true)
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Set new timeout to clear typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      userPresence.setTyping(roomId, currentUserId, false)
    }, 2000)
  }

  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji)
    setShowEmojiPicker(false)
  }

  const handleStartMediaRecording = (mode: "audio" | "video" | "photo") => {
    setMediaRecorderMode(mode)
    setShowMediaRecorder(true)

    // Set recording indicators
    if (mode === "audio") {
      userPresence.setRecordingVoice(roomId, currentUserId, true)
    } else if (mode === "video") {
      userPresence.setRecordingVideo(roomId, currentUserId, true)
    }
  }

  const handleMediaRecorderClose = () => {
    setShowMediaRecorder(false)

    // Clear recording indicators
    userPresence.setRecordingVoice(roomId, currentUserId, false)
    userPresence.setRecordingVideo(roomId, currentUserId, false)
  }

  const handleCopyRoomLink = () => {
    try {
      if (!roomId) {
        notificationSystem.error("Room ID is not available")
        return
      }

      const baseUrl = window.location.origin + window.location.pathname
      const cleanRoomId = roomId.trim().toUpperCase()
      const roomLink = `${baseUrl}?room=${encodeURIComponent(cleanRoomId)}`

      navigator.clipboard
        .writeText(roomLink)
        .then(() => {
          notificationSystem.success(`Room link copied! Room ID: ${cleanRoomId}`)
        })
        .catch(() => {
          notificationSystem.error("Failed to copy room link")
        })
        .catch(() => {
          notificationSystem.error("Failed to create room link")
        })
    } catch (error) {
      console.error("Error copying room link:", error)
      notificationSystem.error("Failed to create room link")
    }
  }

  const handleLeaveRoom = () => {
    setShowLeaveConfirmation(true)
  }

  const handleConfirmLeave = async () => {
    setShowLeaveConfirmation(false)

    if (isHost) {
      try {
        // Notify all users that the room is being destroyed
        await messageStorage.sendMessage(roomId, {
          text: "⚠️ Room is being destroyed by the host. You will be disconnected.",
          sender: "System",
          timestamp: new Date(),
          type: "system",
          reactions: {
            heart: [],
            thumbsUp: [],
          },
        })

        // Give a small delay for the message to be sent
        setTimeout(() => {
          // Destroy room logic would go here (e.g., removing room data from Firebase)
          // For now, we'll just redirect everyone out
          onLeave()
        }, 2000)
      } catch (error) {
        console.error("Error destroying room:", error)
        notificationSystem.error("Failed to destroy room")
        onLeave()
      }
    } else {
      // Regular user just leaves
      onLeave()
    }
  }

  // Message interaction handlers
  const handleMessageReply = (message: Message) => {
    console.log("Setting reply to message:", message.id)
    setReplyingTo(message)
  }

  const handleMessageReact = async (messageId: string, reaction: "heart" | "thumbsUp", userId: string) => {
    console.log("Handling reaction:", reaction, "for message:", messageId, "by user:", userId)
    try {
      // Use the addReaction method from MessageStorage
      await messageStorage.addReaction(roomId, messageId, reaction, userId)
    } catch (error) {
      console.error("Error updating reaction:", error)
      notificationSystem.error("Failed to update reaction")
    }
  }

  const handleMessageDelete = async (messageId: string) => {
    console.log("Deleting message:", messageId)
    try {
      await messageStorage.deleteMessage(roomId, messageId)
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
      notificationSystem.success("Message deleted")
    } catch (error) {
      console.error("Error deleting message:", error)
      notificationSystem.error("Failed to delete message")
    }
  }

  const handleMessageEdit = async (messageId: string, newText: string) => {
    console.log("Editing message:", messageId, "new text:", newText)
    try {
      // Use the editMessage method from MessageStorage
      await messageStorage.editMessage(roomId, messageId, newText)
      notificationSystem.success("Message edited")
    } catch (error) {
      console.error("Error editing message:", error)
      notificationSystem.error("Failed to edit message")
    }
  }

  const handleMessageCopy = (text: string) => {
    console.log("Copying text:", text)
    navigator.clipboard
      .writeText(text)
      .then(() => {
        notificationSystem.success("Text copied to clipboard")
      })
      .catch((err) => {
        console.error("Failed to copy text:", err)
        notificationSystem.error("Failed to copy text")
      })
  }

  // Call handling functions
  const handleStartAudioCall = async () => {
    try {
      console.log("Starting audio call...")
      const callId = await callSignaling.startCall(roomId, userProfile.name, currentUserId, "audio")
      console.log("Audio call started with ID:", callId)

      // Start WebRTC connection for caller
      const otherUsers = onlineUsers.filter((user) => user.id !== currentUserId)
      if (otherUsers.length > 0) {
        const remoteUserId = otherUsers[0].id
        await callSignaling.initiateWebRTCCall(roomId, callId, currentUserId, remoteUserId, false)
      }

      setShowAudioCall(true)
      userPresence.updateActivity(roomId, currentUserId, "call")
    } catch (error) {
      console.error("Error starting audio call:", error)
      notificationSystem.error("Failed to start audio call")
    }
  }

  const handleStartVideoCall = async () => {
    try {
      console.log("Starting video call...")
      const callId = await callSignaling.startCall(roomId, userProfile.name, currentUserId, "video")
      console.log("Video call started with ID:", callId)

      // Start WebRTC connection for caller
      const otherUsers = onlineUsers.filter((user) => user.id !== currentUserId)
      if (otherUsers.length > 0) {
        const remoteUserId = otherUsers[0].id
        await callSignaling.initiateWebRTCCall(roomId, callId, currentUserId, remoteUserId, true)
      }

      setShowVideoCall(true)
      userPresence.updateActivity(roomId, currentUserId, "video-call")
    } catch (error) {
      console.error("Error starting video call:", error)
      notificationSystem.error("Failed to start video call")
    }
  }

  const handleStartTheater = () => {
    setShowTheaterSetup(true)
  }

  const handleStartPlayground = () => {
    setShowPlaygroundSetup(true)
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

  const handleStartPlaygroundGame = async (config: GameConfig) => {
    try {
      if (config.mode === "single") {
        // Single player mode - start immediately with AI
        setPlaygroundConfig(config)
        setIsGameHost(true)
        setShowPlaygroundSetup(false)
        setShowPlayground(true)
        userPresence.updateActivity(roomId, currentUserId, "game")
        notificationSystem.success("Game started against AI!")
      } else {
        // Multiplayer modes - create a shared game ID and send invitation
        const sharedGameId = `game_${roomId}_${Date.now()}`

        const gameInvite: GameInvite = {
          id: sharedGameId,
          roomId,
          hostId: currentUserId,
          hostName: userProfile.name,
          gameConfig: { ...config, sharedGameId }, // Add shared game ID to config
          timestamp: Date.now(),
        }

        // Send game invite to Firebase for other users to see
        await messageStorage.sendMessage(roomId, {
          text: `🎮 ${userProfile.name} started a ${config.gameType} game (${config.mode === "double" ? "1v1" : "multiplayer"})! Click to join.`,
          sender: "System",
          timestamp: new Date(),
          type: "game-invite",
          gameInvite: gameInvite,
          reactions: {
            heart: [],
            thumbsUp: [],
          },
        })

        // Start the game for the host WITHOUT the shared game ID (so they're recognized as host)
        const hostConfig = { ...config }
        delete hostConfig.sharedGameId // Remove sharedGameId for host

        setPlaygroundConfig(hostConfig)
        setIsGameHost(true)
        setShowPlaygroundSetup(false)
        setShowPlayground(true)
        userPresence.updateActivity(roomId, currentUserId, "game")

        notificationSystem.success(
          `${config.mode === "double" ? "1v1" : "Multiplayer"} game started! Waiting for other players to join.`,
        )
      }
    } catch (error) {
      console.error("Error starting playground game:", error)
      notificationSystem.error("Failed to start game")
    }
  }

  const handleExitPlayground = () => {
    setShowPlayground(false)
    setPlaygroundConfig(null)
    setIsGameHost(false)
    userPresence.updateActivity(roomId, currentUserId, "chat")
  }

  const handleAcceptGameInvite = () => {
    if (gameInvite) {
      // Joiner gets the config WITH sharedGameId
      setPlaygroundConfig(gameInvite.gameConfig)
      setIsGameHost(false) // Joining player is not the host
      setShowPlayground(true)
      setGameInvite(null)
      userPresence.updateActivity(roomId, currentUserId, "game")
    }
  }

  const handleDeclineGameInvite = () => {
    setGameInvite(null)
  }

  const menuItems = [
    { icon: Phone, label: "Audio Call", action: handleStartAudioCall },
    { icon: VideoIcon, label: "Video Call", action: handleStartVideoCall },
    { icon: Film, label: "Movie Theater", action: handleStartTheater },
    { icon: Gamepad2, label: "Play Ground", action: handleStartPlayground },
    { icon: Settings, label: "Settings", action: () => setShowSettings(true) },
    { icon: Info, label: "About", action: () => setShowAbout(true) },
  ]

  const handleStartQuiz = async () => {
    try {
      console.log("Starting random quiz")

      // Create quiz session with no topic (random)
      const sessionId = await quizSystem.createQuizSession(roomId, currentUserId, userProfile.name)

      // Send quiz notification to chat
      await messageStorage.sendQuizNotification(roomId, userProfile.name)

      // Join the quiz session for the host
      await quizSystem.joinQuizSession(roomId, sessionId, currentUserId)

      // Start listening for the quiz session
      const unsubscribe = quizSystem.listenForQuizSession(roomId, sessionId, (session) => {
        setCurrentQuizSession(session)

        if (session.status === "active") {
          // Quiz is now active, start the timer for current question
          setQuizTimeRemaining(session.timePerQuestion)
          setUserQuizAnswer("")
          setShowQuizResults(false)

          // Start countdown timer
          if (quizTimerRef.current) {
            clearInterval(quizTimerRef.current)
          }

          let timeLeft = session.timePerQuestion
          quizTimerRef.current = setInterval(() => {
            timeLeft--
            setQuizTimeRemaining(timeLeft)

            if (timeLeft <= 0) {
              clearInterval(quizTimerRef.current!)
              // Auto-submit empty answer if time runs out
              if (!userQuizAnswer) {
                handleQuizAnswer("")
              }
            }
          }, 1000)
        }
      })

      // Listen for quiz answers
      quizSystem.listenForQuizAnswers(roomId, sessionId, (answers) => {
        setQuizAnswers(answers)
      })

      // Start the quiz immediately
      await quizSystem.startQuiz(roomId, sessionId)

      notificationSystem.success("Random quiz started!")
    } catch (error) {
      console.error("Error starting quiz:", error)
      notificationSystem.error("Failed to start quiz")
    }
  }

  const handleQuizAnswer = async (answer: string) => {
    if (!currentQuizSession || userQuizAnswer) return

    try {
      const currentQuestion = currentQuizSession.questions[currentQuizSession.currentQuestionIndex]
      const timeToAnswer = currentQuizSession.timePerQuestion - quizTimeRemaining

      setUserQuizAnswer(answer)

      // Submit answer to Firebase
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

      // Clear timer
      if (quizTimerRef.current) {
        clearInterval(quizTimerRef.current)
      }

      // Show results after a short delay
      setTimeout(() => {
        setShowQuizResults(true)

        // Move to next question or end quiz after showing results
        setTimeout(async () => {
          if (currentQuizSession.currentQuestionIndex + 1 >= currentQuizSession.totalQuestions) {
            // Quiz finished
            await quizSystem.endQuiz(roomId, currentQuizSession.id)
            const results = await quizSystem.calculateResults(roomId, currentQuizSession.id)
            setQuizResults(results)

            // Send results to chat
            await messageStorage.sendQuizResults(roomId, results, currentQuizSession.totalQuestions)

            // Clean up after showing final results
            setTimeout(() => {
              setCurrentQuizSession(null)
              setQuizAnswers([])
              setQuizResults([])
              setUserQuizAnswer("")
              setShowQuizResults(false)
            }, 5000)
          } else {
            // Next question - only host advances the quiz
            if (currentQuizSession.hostId === currentUserId) {
              await quizSystem.nextQuestion(roomId, currentQuizSession.id, currentQuizSession.currentQuestionIndex)
            }
            // Clear user answer and results for next question
            setUserQuizAnswer("")
            setShowQuizResults(false)
            // Clear quiz answers for the new question to reset participant status
            setQuizAnswers([])
          }
        }, 3000)
      }, 1000)
    } catch (error) {
      console.error("Error submitting quiz answer:", error)
      notificationSystem.error("Failed to submit answer")
    }
  }

  const handleQuizExit = async () => {
    if (!currentQuizSession) return

    try {
      // Clear timer
      if (quizTimerRef.current) {
        clearInterval(quizTimerRef.current)
      }

      // End quiz if host
      if (currentQuizSession.hostId === currentUserId) {
        await quizSystem.endQuiz(roomId, currentQuizSession.id)
      }

      // Clean up local state
      setCurrentQuizSession(null)
      setQuizAnswers([])
      setQuizResults([])
      setUserQuizAnswer("")
      setShowQuizResults(false)
      setQuizTimeRemaining(0)

      notificationSystem.success("Quiz exited")
    } catch (error) {
      console.error("Error exiting quiz:", error)
      notificationSystem.error("Failed to exit quiz")
    }
  }

  // Early return if roomId is invalid
  if (!roomId || roomId.trim() === "") {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="text-white text-center">
          <div className="text-xl mb-4">Error: Invalid Room ID</div>
          <button onClick={onLeave} className="bg-cyan-500 hover:bg-cyan-600 px-4 py-2 rounded">
            Return to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col relative overflow-hidden">
      <SpaceBackground />

      {/* Header - Fixed and responsive */}
      <div className="flex items-center justify-between p-2 md:p-4 bg-slate-900/80 backdrop-blur-sm border-b border-slate-700 min-h-[60px]">
        <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
          <AnimatedLogo />
          <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm">
            <Users className="w-3 h-3 md:w-4 md:h-4 text-gray-400" />
            <span className="text-gray-400 whitespace-nowrap">{onlineUsers.length} online</span>
          </div>
          <div className="text-xs text-gray-500 truncate">Room: {roomId}</div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size={isMobile ? "sm" : "icon"}
            className="text-white hover:bg-slate-700 bg-slate-800 border border-slate-600 h-8 w-8 md:h-10 md:w-10"
            onClick={handleCopyRoomLink}
            title={`Copy Room Link (${roomId})`}
          >
            <Copy className="w-3 h-3 md:w-4 md:h-4" />
          </Button>

          <Button
            variant="ghost"
            size={isMobile ? "sm" : "icon"}
            className="text-white hover:bg-red-600 bg-red-500 border border-red-400 h-8 w-8 md:h-10 md:w-10"
            onClick={handleLeaveRoom}
            title={isHost ? "Destroy Room" : "Leave Room"}
          >
            <svg className="w-3 h-3 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <Button
                variant="ghost"
                size={isMobile ? "sm" : "icon"}
                className="text-white hover:bg-slate-700 h-8 w-8 md:h-10 md:w-10"
              >
                <MoreVertical className="w-3 h-3 md:w-4 md:h-4" />
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
        <div className="px-2 md:px-4 py-2 bg-slate-800/50 border-b border-slate-700">
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
      <div className="flex-1 p-2 md:p-4 overflow-y-auto">
        <div className="space-y-2">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <div className="text-4xl mb-4">💬</div>
              <p>No messages yet. Start the conversation!</p>
              <p className="text-xs mt-2">Room ID: {roomId}</p>
            </div>
          ) : (
            messages.map((msg) => {
              // Check if this message has a game invite
              if (msg.type === "game-invite" && msg.gameInvite) {
                // Only show game invite for users who are NOT the host
                if (
                  msg.gameInvite.hostId !== currentUserId &&
                  !gameInvite &&
                  msg.gameInvite.timestamp > Date.now() - 300000
                ) {
                  // 5 minutes validity
                  setGameInvite(msg.gameInvite)
                }
              }

              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isOwnMessage={msg.sender === userProfile.name}
                  userColor={getUserColor(msg.sender)}
                  currentUser={userProfile.name}
                  userAvatar={onlineUsers.find((u) => u.name === msg.sender)?.avatar}
                  onReply={handleMessageReply}
                  onReact={handleMessageReact}
                  onDelete={handleMessageDelete}
                  onEdit={handleMessageEdit}
                  onCopy={handleMessageCopy}
                />
              )
            })
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
      <div className="p-2 md:p-4 bg-slate-900/80 backdrop-blur-sm border-t border-slate-700 relative">
        <div className="flex items-center gap-1 md:gap-2">
          <AttachmentMenu onFileSelect={() => {}} />

          {/* Conditionally render media buttons based on screen size */}
          {isMobile ? (
            <MediaMenu onSelectMedia={handleStartMediaRecording} />
          ) : (
            <>
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
            </>
          )}

          <Input
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 bg-slate-800 border-slate-600 text-white placeholder-gray-400 text-sm md:text-base"
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

          <Button
            onClick={handleSendMessage}
            className="bg-cyan-500 hover:bg-cyan-600"
            disabled={!message.trim()}
            size={isMobile ? "sm" : "default"}
          >
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
        onClose={handleMediaRecorderClose}
        mode={mediaRecorderMode}
        onMediaReady={handleMediaRecorderClose}
      />

      <PlaygroundSetupModal
        isOpen={showPlaygroundSetup}
        onClose={() => setShowPlaygroundSetup(false)}
        onStartGame={handleStartPlaygroundGame}
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
            isHost={isGameHost} // This will be true for host, false for joiner
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

      {/* Leave Room Confirmation Modal */}
      {showLeaveConfirmation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700 text-center max-w-md w-full">
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
                ? "Are you sure you want to destroy this room? All users will be disconnected and the room will no longer be accessible."
                : "Are you sure you want to leave this room? You can rejoin later with the room ID."}
            </p>

            <div className="flex gap-4 justify-center">
              <Button onClick={handleConfirmLeave} className="bg-red-500 hover:bg-red-600 text-white px-6">
                {isHost ? "Yes, Destroy Room" : "Yes, Leave"}
              </Button>
              <Button
                onClick={() => setShowLeaveConfirmation(false)}
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

      {/* Quiz Overlay */}
      {currentQuizSession && currentQuizSession.status === "active" && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <QuizQuestionBubble
            question={currentQuizSession.questions[currentQuizSession.currentQuestionIndex]}
            currentQuestionNumber={currentQuizSession.currentQuestionIndex + 1}
            totalQuestions={currentQuizSession.totalQuestions}
            timeRemaining={quizTimeRemaining}
            participants={onlineUsers.map((user) => {
              // Get current question ID
              const currentQuestionId = currentQuizSession.questions[currentQuizSession.currentQuestionIndex].id

              // Check if this specific user has answered the current question
              const hasAnsweredCurrentQuestion = quizAnswers.some(
                (answer) => answer.playerId === user.id && answer.questionId === currentQuestionId,
              )

              return {
                id: user.id,
                name: user.name,
                hasAnswered: hasAnsweredCurrentQuestion,
              }
            })}
            userAnswer={userQuizAnswer}
            onAnswer={handleQuizAnswer}
            onExit={handleQuizExit}
            showResults={showQuizResults}
            correctAnswer={
              showQuizResults
                ? currentQuizSession.questions[currentQuizSession.currentQuestionIndex].correctAnswer
                : undefined
            }
            answers={
              showQuizResults
                ? quizAnswers.filter(
                    (a) => a.questionId === currentQuizSession.questions[currentQuizSession.currentQuestionIndex].id,
                  )
                : []
            }
          />
        </div>
      )}

      {/* Quiz Results Overlay */}
      {quizResults.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <QuizResultsBubble results={quizResults} totalQuestions={currentQuizSession?.totalQuestions || 10} />
        </div>
      )}
    </div>
  )
}
