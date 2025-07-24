"use client"

import { Button } from "@/components/ui/button"
import { X, Brain } from "lucide-react"

interface QuizSetupModalProps {
  isOpen: boolean
  onClose: () => void
  onStartQuiz: () => void
}

export function QuizSetupModal({ isOpen, onClose, onStartQuiz }: QuizSetupModalProps) {
  const handleStartQuiz = () => {
    onStartQuiz()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Start Quiz</h2>
          </div>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white h-8 w-8" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="text-center">
            <div className="text-3xl mb-3">🧠</div>
            <h3 className="text-base font-medium text-white mb-2">Ready for a Quiz?</h3>
            <p className="text-gray-400 text-sm mb-4">Get ready for 10 random questions from various categories!</p>

            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                className="flex-1 border-slate-600 text-white hover:bg-slate-700 bg-transparent"
              >
                Cancel
              </Button>
              <Button
                onClick={handleStartQuiz}
                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
              >
                Start Quiz
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
