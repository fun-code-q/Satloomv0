"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Volume2 } from "lucide-react"

interface FilePreviewProps {
  isOpen: boolean
  onClose: () => void
  file: {
    name: string
    type: string
    url: string
    size?: number
  }
}

export function FilePreview({ isOpen, onClose, file }: FilePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  const isImage = file.type.startsWith("image/")
  const isVideo = file.type.startsWith("video/")
  const isAudio = file.type.startsWith("audio/")
  const isDocument = file.type.includes("pdf") || file.type.includes("document") || file.type.includes("text")

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "Unknown size"
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i]
  }

  const downloadFile = () => {
    const link = document.createElement("a")
    link.href = file.url
    link.download = file.name
    link.click()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-center text-cyan-400 flex items-center justify-between">
            <span>{file.name}</span>
            <Button onClick={downloadFile} variant="outline" size="sm" className="border-slate-600 bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-auto">
          {/* File info */}
          <div className="text-sm text-gray-400 text-center">
            {file.type} • {formatFileSize(file.size)}
          </div>

          {/* Image preview */}
          {isImage && (
            <div className="flex justify-center">
              <img
                src={file.url || "/placeholder.svg"}
                alt={file.name}
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            </div>
          )}

          {/* Video preview */}
          {isVideo && (
            <div className="relative">
              <video
                controls
                className="w-full max-h-96 rounded-lg"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onVolumeChange={(e) => setIsMuted((e.target as HTMLVideoElement).muted)}
              >
                <source src={file.url} type={file.type} />
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {/* Audio preview */}
          {isAudio && (
            <div className="bg-slate-900 rounded-lg p-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-cyan-500 rounded-full flex items-center justify-center">
                  <Volume2 className="w-8 h-8 text-white" />
                </div>
              </div>
              <audio controls className="w-full" onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)}>
                <source src={file.url} type={file.type} />
                Your browser does not support the audio tag.
              </audio>
            </div>
          )}

          {/* Document preview */}
          {isDocument && (
            <div className="bg-slate-900 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📄</span>
              </div>
              <p className="text-gray-300 mb-4">Document preview not available</p>
              <Button onClick={downloadFile} className="bg-cyan-500 hover:bg-cyan-600">
                <Download className="w-4 h-4 mr-2" />
                Download to view
              </Button>
            </div>
          )}

          {/* Unknown file type */}
          {!isImage && !isVideo && !isAudio && !isDocument && (
            <div className="bg-slate-900 rounded-lg p-6 text-center">
              <div className="w-16 h-16 bg-gray-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📁</span>
              </div>
              <p className="text-gray-300 mb-4">File preview not available</p>
              <Button onClick={downloadFile} className="bg-cyan-500 hover:bg-cyan-600">
                <Download className="w-4 h-4 mr-2" />
                Download file
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
