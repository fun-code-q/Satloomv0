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
import { Send, MoreVertical, Phone, VideoIcon, Film, Gamepad2, Settings, Info, X, Smile, Copy } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { AttachmentMenu } from "./attachment-menu"
import { AudioCallModal } from "./audio-call-modal"
import { SettingsModal } from "./settings-modal"
import { AboutModal } from "./about-modal"
import { MessageBubble, type Message } from "./message-bubble"
import { MediaRecorder } from "./media-recorder"
import { IncomingCallNotification } from "./incoming-call-notification"
import { CallSignaling, type CallData } from "@/utils/call-signaling"
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
  status?: "active" | "expired" | "full"
  declined?: boolean
  accepted?: boolean
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
  console.log("ChatInterface: Initialized with roomId:", roomId, "userProfile:", userProfile)

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

  // Game invite state - now tracks multiple invites
  const [gameInvites, setGameInvites] = useState<GameInvite[]>([])
  const [activeGameInvite, setActiveGameInvite] = useState<GameInvite | null>(null)
  const [declinedInvites, setDeclinedInvites] = useState<Set<string>>(new Set())

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

      if (showPlayground || showQuizSetup || currentQuizSession) {
        setActiveGameInvite(null)
        return
      }

      // Process game invites from messages
      const gameInviteMessages = newMessages.filter(
        (msg) =>
          msg.type === "game-invite" &&
          msg.gameInvite &&
          msg.gameInvite.hostId !== currentUserId &&
          !declinedInvites.has(msg.gameInvite.id), // Don't show declined invites
      )

      // Update game invites state
      const currentInvites = gameInviteMessages
        .map((msg) => ({
          ...msg.gameInvite!,
          status: msg.gameInvite!.timestamp > Date.now() - 300000 ? "active" : "expired", // 5 minutes validity
        }))
        .filter((invite) => invite.status === "active") // Only show active invites

      setGameInvites(currentInvites)

      // Show the most recent active invite if we don't have one showing
      const latestActiveInvite = currentInvites[currentInvites.length - 1]
      if (latestActiveInvite && !activeGameInvite && !declinedInvites.has(latestActiveInvite.id)) {
        setActiveGameInvite(latestActiveInvite)
      }
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
                      // Auto-submit empty answer if time runs out
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
  }, [
    roomId,
    currentUserId,
    userProfile,
    themeContext,
    declinedInvites,
    activeGameInvite,
    showPlayground,
    showQuizSetup,
    currentQuizSession,
  ])

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

  // Handle media recording (audio/video messages)
  const handleStartMediaRecording = (type: "audio" | "video" | "photo") => {
    setMediaRecorderMode(type)
    setShowMediaRecorder(true)

    // Set recording indicators
    if (type === "audio") {
      userPresence.setRecordingVoice(roomId, currentUserId, true)
    } else if (type === "video") {
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
    // Use the deleteMessage method from MessageStorage
    await messageStorage.deleteMessage(roomId, messageId)
    notificationSystem.success("Message deleted")
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
      console.log("Starting playground game with config:", config)
      console.log("Current user profile:", userProfile)

      if (config.mode === "single") {
        // Single player mode - start immediately with AI
        setPlaygroundConfig(config)
        setIsGameHost(true)
        setShowPlaygroundSetup(false)
        setShowPlayground(true)
        userPresence.updateActivity(roomId, currentUserId, "game")
        notificationSystem.success("Game started against AI!")
      } else {
        // Multiplayer mode
        const aiCount = config.players.filter((p) => p.isAI).length
        const humanCount = config.players.filter((p) => !p.isAI).length

        if (humanCount === 1) {
          // Only host is human, all others are AI - no need to send invitation
          const gameMessage =
            aiCount === 1
              ? `🎮 ${userProfile.name} started playing Dots & Boxes against 1 AI opponent.`
              : `🎮 ${userProfile.name} started playing Dots & Boxes against ${aiCount} AI opponents.`

          await messageStorage.sendMessage(roomId, {
            text: gameMessage,
            sender: "System",
            timestamp: new Date(),
            type: "system",
            reactions: {
              heart: [],
              thumbsUp: [],
            },
          })

          setPlaygroundConfig(config)
          setIsGameHost(true)
          setShowPlaygroundSetup(false)
          setShowPlayground(true)
          userPresence.updateActivity(roomId, currentUserId, "game")
          notificationSystem.success(`Game started against ${aiCount} AI!`)
        } else {
          // There are other human players - send invitation
          const sharedGameId = `game_${roomId}_${Date.now()}`

          // Create a multiplayer config with placeholder slots
          const multiplayerConfig = {
            ...config,
            sharedGameId,
            players: config.players.map((player, index) => {
              if (index === 0) {
                // Host keeps their info with actual user ID and name
                console.log("Setting host player:", { id: currentUserId, name: userProfile.name })
                return {
                  ...player,
                  id: currentUserId,
                  name: userProfile.name, // Use actual user profile name
                }
              } else if (player.isAI) {
                // AI players keep their info
                return player
              } else {
                // Human players become placeholder slots
                return {
                  ...player,
                  id: `placeholder_${index}`,
                  name: `Player ${index + 1}`,
                  isPlaceholder: true,
                }
              }
            }),
          }

          console.log("Created multiplayer config:", multiplayerConfig)

          const gameInvite: GameInvite = {
            id: sharedGameId,
            roomId,
            hostId: currentUserId,
            hostName: userProfile.name,
            gameConfig: multiplayerConfig,
            timestamp: Date.now(),
            status: "active",
          }

          await messageStorage.sendMessage(roomId, {
            text: `🎮 ${userProfile.name} started a ${config.gameType} multiplayer game! Click to join.`,
            sender: "System",
            timestamp: new Date(),
            type: "game-invite",
            gameInvite: gameInvite,
            reactions: {
              heart: [],
              thumbsUp: [],
            },
          })

          // Start the game for the host with the multiplayer config
          setPlaygroundConfig(multiplayerConfig)
          setIsGameHost(true)
          setShowPlaygroundSetup(false)
          setShowPlayground(true)
          userPresence.updateActivity(roomId, currentUserId, "game")

          notificationSystem.success("Multiplayer game started! Waiting for other players to join.")
        }
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

  const handleAcceptGameInvite = async () => {
    if (!activeGameInvite) return

    try {
      console.log("Accepting game invite:", activeGameInvite.id)
      console.log("Current user profile for joining:", userProfile)

      setDeclinedInvites((prev) => new Set(prev).add(activeGameInvite.id))

      // Find the first available placeholder slot and update it with current user info
      let foundSlot = false
      const joiningConfig = {
        ...activeGameInvite.gameConfig,
        players: activeGameInvite.gameConfig.players.map((player, index) => {
          // Find the first placeholder slot and assign it to the current user
          if (player.isPlaceholder && !player.isAI && player.id.startsWith("placeholder_") && !foundSlot) {
            foundSlot = true
            console.log(`Assigning slot ${index} to user:`, { id: currentUserId, name: userProfile.name })
            return {
              ...player,
              id: currentUserId,
              name: userProfile.name, // Use actual user profile name
              isPlaceholder: false,
            }
          }
          return player
        }),
      }

      console.log("Created joining config:", joiningConfig)

      if (!foundSlot) {
        notificationSystem.error("No available slots in the game")
        setActiveGameInvite(null)
        return
      }

      // Join the game with the updated config
      setPlaygroundConfig(joiningConfig)
      setIsGameHost(false)
      setShowPlayground(true)
      setActiveGameInvite(null) // Explicitly clear active invite
      userPresence.updateActivity(roomId, currentUserId, "game")

      // Send a message to the chat that user joined
      await messageStorage.sendMessage(roomId, {
        text: `🎮 ${userProfile.name} joined the multiplayer game!`,
        sender: "System",
        timestamp: new Date(),
        type: "system",
        reactions: {
          heart: [],
          thumbsUp: [],
        },
      })

      notificationSystem.success(`Joined the game as ${userProfile.name}!`)
    } catch (error) {
      console.error("Error joining game:", error)
      notificationSystem.error("Failed to join game")
      setActiveGameInvite(null)
    }
  }

  const handleDeclineGameInvite = async () => {
    if (!activeGameInvite) return

    console.log("Declining game invite:", activeGameInvite.id)

    try {
      // Add to declined invites set
      setDeclinedInvites((prev) => new Set(prev).add(activeGameInvite.id))

      // Clear the active invite
      setActiveGameInvite(null)

      // Remove this invite from the list
      setGameInvites((prev) => prev.filter((inv) => inv.id !== activeGameInvite.id))

      // Send a message to the chat that user declined
      await messageStorage.sendMessage(roomId, {
        text: `${userProfile.name} declined the game invitation.`,
        sender: "System",
        timestamp: new Date(),
        type: "system",
        reactions: {
          heart: [],
          thumbsUp: [],
        },
      })

      notificationSystem.success("Game invitation declined")
    } catch (error) {
      console.error("Error declining game invite:", error)
      notificationSystem.error("Failed to decline game invitation")
    }
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
    setUserQuizAnswer(answer)

    if (currentQuizSession && answer) {
      // Calculate time taken
      const timeTaken = currentQuizSession.timePerQuestion - quizTimeRemaining
      await quizSystem.submitAnswer(
        roomId,
        currentQuizSession.id,
        currentUserId,
        userProfile.name,
        currentQuizSession.questions[currentQuizSession.currentQuestionIndex].id,
        answer,
        currentQuizSession.questions[currentQuizSession.currentQuestionIndex].correctAnswer,
        timeTaken,
      )
    } else if (currentQuizSession && !answer && quizTimeRemaining <= 0) {
      // Handle empty answer submission if time ran out
      const timeTaken = currentQuizSession.timePerQuestion
      await quizSystem.submitAnswer(
        roomId,
        currentQuizSession.id,
        currentUserId,
        userProfile.name,
        currentQuizSession.questions[currentQuizSession.currentQuestionIndex].id,
        "", // Empty answer
        currentQuizSession.questions[currentQuizSession.currentQuestionIndex].correctAnswer,
        timeTaken,
      )
    }
  }

  const handleQuizExit = async () => {
    if (currentQuizSession) {
      try {
        // Remove user from participants list in DB
        await quizSystem.removeParticipant(roomId, currentQuizSession.id, currentUserId)

        // Send notification to the room
        await messageStorage.sendMessage(roomId, {
          text: `🚪 ${userProfile.name} has left the quiz.`,
          sender: "System",
          type: "system",
          timestamp: new Date(),
          reactions: {
            heart: [],
            thumbsUp: [],
          },
        })
      } catch (error) {
        console.error("Error leaving quiz:", error)
      }

      // Clear local state
      setCurrentQuizSession(null)
      setShowQuizResults(false)
      if (quizTimerRef.current) {
        clearInterval(quizTimerRef.current)
      }
    }
  }

  return (
    <div className="flex flex-col h-screen w-full bg-gray-900 text-white overflow-hidden">
      <SpaceBackground />
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center">
            <AnimatedLogo className="h-8 w-8 mr-3" />
            <h1 className="text-lg font-semibold">Lobby: {roomId}</h1>
          </div>
          <div className="flex items-center space-x-3">
            <UserActivityIndicators onlineUsers={onlineUsers} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-gray-800 border-gray-700">
                {menuItems.map((item) => (
                  <DropdownMenuItem
                    key={item.label}
                    onClick={item.action}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuItem
                  onClick={handleCopyRoomLink}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 focus:bg-gray-700"
                >
                  <Copy className="h-4 w-4" />
                  <span>Copy Room Link</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLeaveRoom}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-700 focus:bg-gray-700 text-red-500"
                >
                  <X className="h-4 w-4" />
                  <span>Leave Room</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex flex-1 overflow-y-auto p-4 space-y-4 flex-col-reverse">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id || Math.random()} // Use id if available, otherwise fallback to random
              message={msg}
              userProfile={userProfile}
              onReply={() => handleMessageReply(msg)}
              onReact={(reaction, userId) => handleMessageReact(msg.id, reaction, userId)}
              onDelete={() => msg.id && handleMessageDelete(msg.id)}
              onEdit={(newText) => msg.id && handleMessageEdit(msg.id, newText)}
              onCopy={() => handleMessageCopy(msg.text)}
            />
          ))}
          <div ref={messagesEndRef} /> {/* For auto-scrolling */}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          {replyingTo && (
            <div className="flex items-center mb-2 p-2 bg-gray-700 rounded-md">
              <div className="flex-grow">
                <p className="text-sm text-gray-400">Replying to {replyingTo.sender}</p>
                <p className="text-sm truncate">{replyingTo.text}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setReplyingTo(null)}>
                <X className="h-4 w-4 text-gray-400" />
              </Button>
            </div>
          )}
          <div className="flex items-center space-x-3">
            <AttachmentMenu
              onRecordAudio={() => handleStartMediaRecording("audio")}
              onRecordVideo={() => handleStartMediaRecording("video")}
            />
            <Input
              placeholder="Type your message..."
              value={message}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              className="flex-1 bg-gray-700 border-gray-600 placeholder-gray-400 focus:ring-purple-500 focus:border-purple-500"
            />
            {showEmojiPicker && <EmojiPicker onSelect={handleEmojiSelect} />}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="text-gray-400 hover:text-white"
            >
              <Smile className="h-5 w-5" />
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!message.trim() || isTyping}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Modals and Overlays */}
        {showAudioCall && currentCall && (
          <AudioCallModal
            callData={currentCall}
            userId={currentUserId}
            userName={userProfile.name}
            roomId={roomId}
            onEndCall={handleEndCall}
            isCaller={currentCall.callerId === currentUserId}
          />
        )}
        {showVideoCall && currentCall && (
          <VideoCallModal
            callData={currentCall}
            userId={currentUserId}
            userName={userProfile.name}
            roomId={roomId}
            onEndCall={handleEndVideoCall}
            isCaller={currentCall.callerId === currentUserId}
          />
        )}
        {incomingCall && !showAudioCall && !showVideoCall && (
          <IncomingCallNotification
            callerName={incomingCall.caller}
            onAccept={incomingCall.type === "video" ? handleAnswerVideoCall : handleAnswerCall}
            onDecline={handleDeclineCall}
            type={incomingCall.type}
          />
        )}
        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
        {showMediaRecorder && (
          <MediaRecorder
            mode={mediaRecorderMode}
            roomId={roomId}
            userId={currentUserId}
            userName={userProfile.name}
            onClose={handleMediaRecorderClose}
          />
        )}
        {showPlaygroundSetup && (
          <PlaygroundSetupModal
            onClose={() => setShowPlaygroundSetup(false)}
            onStartGame={handleStartPlaygroundGame}
            userProfile={userProfile}
          />
        )}
        {showPlayground && playgroundConfig && (
          <DotsAndBoxesGameComponent
            config={playgroundConfig}
            userId={currentUserId}
            userName={userProfile.name}
            isHost={isGameHost}
            onExit={handleExitPlayground}
          />
        )}
        {showTheaterSetup && (
          <TheaterSetupModal onClose={() => setShowTheaterSetup(false)} onCreateSession={handleCreateTheaterSession} />
        )}
        {showTheaterFullscreen && currentTheaterSession && (
          <TheaterFullscreen session={currentTheaterSession} onExit={handleExitTheater} isHost={isTheaterHost} />
        )}
        {theaterInvite && !showTheaterFullscreen && (
          <TheaterInviteNotification
            hostName={theaterInvite.host}
            videoTitle={theaterInvite.videoTitle}
            onAccept={handleAcceptTheaterInvite}
            onDecline={handleDeclineTheaterInvite}
          />
        )}
        {activeGameInvite && !showPlayground && (
          <GameInviteNotification
            inviterName={activeGameInvite.hostName}
            gameType={activeGameInvite.gameConfig.gameType}
            onAccept={handleAcceptGameInvite}
            onDecline={handleDeclineGameInvite}
          />
        )}
        {showQuizSetup && <QuizSetupModal onClose={() => setShowQuizSetup(false)} onStartQuiz={handleStartQuiz} />}
        {currentQuizSession && !showQuizResults && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md mx-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Quiz: {currentQuizSession.title || "Untitled Quiz"}</h2>
                <Button
                  variant="outline"
                  onClick={handleQuizExit}
                  className="border-red-500 text-red-500 hover:bg-red-500 hover:text-white bg-transparent"
                >
                  Exit Quiz
                </Button>
              </div>
              {currentQuizSession.status === "active" && (
                <>
                  <QuizQuestionBubble
                    question={currentQuizSession.questions[currentQuizSession.currentQuestionIndex]}
                    timeRemaining={quizTimeRemaining}
                  />
                  <div className="mt-4 flex items-center space-x-2">
                    <Input
                      placeholder="Your answer..."
                      value={userQuizAnswer}
                      onChange={(e) => setUserQuizAnswer(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault()
                          handleQuizAnswer(userQuizAnswer)
                        }
                      }}
                      className="flex-1 bg-gray-700 border-gray-600 placeholder-gray-400"
                      disabled={quizTimeRemaining <= 0}
                    />
                    <Button
                      onClick={() => handleQuizAnswer(userQuizAnswer)}
                      disabled={!userQuizAnswer || quizTimeRemaining <= 0}
                      className="bg-purple-600 hover:bg-purple-700"
                    >
                      Submit
                    </Button>
                  </div>
                </>
              )}
              {currentQuizSession.status === "finished" && (
                <div className="text-center py-4">
                  <p className="text-lg mb-4">Quiz Finished!</p>
                  <Button onClick={() => setShowQuizResults(true)}>View Results</Button>
                </div>
              )}
            </div>
          </div>
        )}
        {currentQuizSession && showQuizResults && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-2xl mx-auto overflow-y-auto max-h-screen">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Quiz Results: {currentQuizSession.title || "Untitled Quiz"}</h2>
                <Button
                  variant="outline"
                  onClick={() => setShowQuizResults(false)}
                  className="border-gray-600 text-gray-400 hover:bg-gray-700"
                >
                  Close
                </Button>
              </div>
              <QuizResultsBubble quizSession={currentQuizSession} quizAnswers={quizAnswers} userProfile={userProfile} />
            </div>
          </div>
        )}

        {showLeaveConfirmation && (
          <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-75">
            <div className="bg-gray-800 p-6 rounded-lg shadow-xl text-center">
              <h3 className="text-lg font-semibold mb-4">Confirm Leave</h3>
              <p className="mb-6">Are you sure you want to leave this room?</p>
              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => setShowLeaveConfirmation(false)}>
                  Cancel
                </Button>
                <Button onClick={handleConfirmLeave} className="bg-red-600 hover:bg-red-700">
                  Leave
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
