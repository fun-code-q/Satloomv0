import { database } from "@/lib/firebase"
import { ref, push, set, onValue, remove, update } from "firebase/database"
import type { Message } from "@/components/message-bubble"

/**
 * MessageStorage - handles all chat/quiz/game messages for a room.
 * Exposed as BOTH a named and default export so legacy code that uses
 * `import MessageStorage …` and the newer `import { MessageStorage } …`
 * continue to work.
 */
export class MessageStorage {
  private static instance: MessageStorage
  private messageListeners: Array<() => void> = []
  private currentRoomId: string | null = null

  /* ----------------------------  SINGLETON  ---------------------------- */
  static getInstance(): MessageStorage {
    if (!MessageStorage.instance) {
      MessageStorage.instance = new MessageStorage()
    }
    return MessageStorage.instance
  }

  /* ---------------------------  UTILITIES  ----------------------------- */
  /** Recursively strips `undefined` so Firebase won't reject the payload. */
  private cleanData(obj: any): any {
    if (obj === null || obj === undefined) return null
    if (Array.isArray(obj)) {
      return obj.map((i) => this.cleanData(i)).filter((v) => v !== undefined)
    }
    if (typeof obj === "object") {
      const cleaned: Record<string, any> = {}
      Object.keys(obj).forEach((k) => {
        const v = this.cleanData(obj[k])
        if (v !== undefined) cleaned[k] = v
      })
      return cleaned
    }
    return obj
  }

  /* ---------------------------  SENDERS  ------------------------------- */
  async sendMessage(roomId: string, message: Omit<Message, "id">): Promise<string> {
    if (!database) {
      throw new Error("Firebase database not initialized")
    }

    const messagesRef = ref(database, `rooms/${roomId}/messages`)
    const newMessageRef = push(messagesRef)

    const messageWithId: Message = {
      ...message,
      id: newMessageRef.key!,
      timestamp: new Date(message.timestamp),
    }

    await set(newMessageRef, {
      ...messageWithId,
      timestamp: messageWithId.timestamp.toISOString(),
    })

    return newMessageRef.key!
  }

  async sendQuizNotification(roomId: string, hostName: string): Promise<void> {
    await this.sendMessage(roomId, {
      text: `🧠 ${hostName} started a quiz! Get ready to test your knowledge!`,
      sender: "System",
      timestamp: new Date(),
      type: "quiz-notification",
      reactions: {
        heart: [],
        thumbsUp: [],
      },
    })
  }

  async sendQuizResults(roomId: string, results: any[], totalQuestions: number): Promise<void> {
    const sortedResults = results.sort((a, b) => b.score - a.score)
    const winner = sortedResults[0]

    let resultText = `🏆 Quiz Results!\n\n`
    sortedResults.forEach((result, index) => {
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🏅"
      resultText += `${medal} ${result.playerName}: ${result.score}/${totalQuestions} (${Math.round((result.score / totalQuestions) * 100)}%)\n`
    })

    if (winner) {
      resultText += `\n🎉 Congratulations ${winner.playerName}!`
    }

    await this.sendMessage(roomId, {
      text: resultText,
      sender: "System",
      timestamp: new Date(),
      type: "quiz-results",
      reactions: {
        heart: [],
        thumbsUp: [],
      },
    })
  }

  /* ----------------------------  LISTENERS  ---------------------------- */
  listenForMessages(roomId: string, onMessagesUpdate: (messages: Message[]) => void): () => void {
    if (!database) {
      console.warn("Firebase database not initialized, message listening disabled")
      return () => {}
    }

    const messagesRef = ref(database, `rooms/${roomId}/messages`)

    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const messagesData = snapshot.val()
      if (messagesData) {
        const messages: Message[] = Object.entries(messagesData).map(([id, data]: [string, any]) => ({
          ...data,
          id,
          timestamp: new Date(data.timestamp),
        }))

        // Sort messages by timestamp
        messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
        onMessagesUpdate(messages)
      } else {
        onMessagesUpdate([])
      }
    })

    this.messageListeners.push(unsubscribe)
    return unsubscribe
  }

  /* ---------------------------  MESSAGE OPS  --------------------------- */
  async addReaction(roomId: string, messageId: string, reaction: "heart" | "thumbsUp", userId: string): Promise<void> {
    if (!database) return

    const messageRef = ref(database, `rooms/${roomId}/messages/${messageId}/reactions/${reaction}`)

    // Get current reactions
    const currentReactions = await new Promise<string[]>((resolve) => {
      onValue(
        messageRef,
        (snapshot) => {
          const reactions = snapshot.val() || []
          resolve(reactions)
        },
        { onlyOnce: true },
      )
    })

    let updatedReactions: string[]
    if (currentReactions.includes(userId)) {
      // Remove reaction
      updatedReactions = currentReactions.filter((id) => id !== userId)
    } else {
      // Add reaction
      updatedReactions = [...currentReactions, userId]
    }

    await set(messageRef, updatedReactions)
  }

  async editMessage(roomId: string, messageId: string, newText: string): Promise<void> {
    if (!database) return

    const messageRef = ref(database, `rooms/${roomId}/messages/${messageId}`)
    await update(messageRef, {
      text: newText,
      edited: true,
      editedAt: new Date().toISOString(),
    })
  }

  async deleteMessage(roomId: string, messageId: string): Promise<void> {
    if (!database) return

    const messageRef = ref(database, `rooms/${roomId}/messages/${messageId}`)
    await remove(messageRef)
  }

  /* ---------------------------  CLEAN-UP  ------------------------------ */
  cleanup(): void {
    this.messageListeners.forEach((unsubscribe) => unsubscribe())
    this.messageListeners = []
    this.currentRoomId = null
  }
}

/* Provide a default export for older imports (import MessageStorage …) */
export default MessageStorage
