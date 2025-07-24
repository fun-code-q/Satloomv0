"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Mic, Video, Camera, RotateCcw, Square } from "lucide-react"

interface MediaRecorderProps {
  isOpen: boolean
  onClose: () => void
  mode: "audio" | "video" | "photo"
  onMediaReady: (file: File, type: string) => void
}

export function MediaRecorder({ isOpen, onClose, mode, onMediaReady }: MediaRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user")
  const [stream, setStream] = useState<MediaStream | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    if (isOpen) {
      startCamera()
    } else {
      stopCamera()
    }

    return () => stopCamera()
  }, [isOpen, facingMode])

  const startCamera = async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: mode === "audio" || mode === "video",
        video: mode === "video" || mode === "photo" ? { facingMode } : false,
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints)
      setStream(mediaStream)

      if (videoRef.current && (mode === "video" || mode === "photo")) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (error) {
      console.error("Error accessing media devices:", error)
      alert("Could not access camera/microphone")
    }
  }

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }

  const startRecording = () => {
    if (!stream) return

    chunksRef.current = []
    const mediaRecorder = new MediaRecorder(stream)
    mediaRecorderRef.current = mediaRecorder

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: mode === "audio" ? "audio/wav" : "video/mp4",
      })
      setRecordedBlob(blob)
    }

    mediaRecorder.start()
    setIsRecording(true)
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const takePhoto = () => {
    if (!videoRef.current) return

    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d")
    if (!context) return

    canvas.width = videoRef.current.videoWidth
    canvas.height = videoRef.current.videoHeight
    context.drawImage(videoRef.current, 0, 0)

    canvas.toBlob((blob) => {
      if (blob) {
        setRecordedBlob(blob)
      }
    }, "image/jpeg")
  }

  const sendMedia = () => {
    if (recordedBlob) {
      const fileName = `${mode}-${Date.now()}.${mode === "photo" ? "jpg" : mode === "audio" ? "wav" : "mp4"}`
      const file = new File([recordedBlob], fileName, {
        type: recordedBlob.type,
      })
      onMediaReady(file, mode)
      handleClose()
    }
  }

  const handleClose = () => {
    setRecordedBlob(null)
    setIsRecording(false)
    onClose()
  }

  const switchCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"))
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-center text-cyan-400">
            {mode === "audio" ? "🎤 Record Audio" : mode === "video" ? "📹 Record Video" : "📷 Take Photo"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Video preview */}
          {(mode === "video" || mode === "photo") && (
            <div className="relative bg-black rounded-lg overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-64 object-cover"
                style={{ transform: facingMode === "user" ? "scaleX(-1)" : "none" }}
              />

              {/* Camera switch button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70"
                onClick={switchCamera}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Audio visualization */}
          {mode === "audio" && (
            <div className="h-32 bg-slate-900 rounded-lg flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Mic className={`w-8 h-8 ${isRecording ? "text-red-400 animate-pulse" : "text-gray-400"}`} />
                <span className="text-lg">{isRecording ? "Recording..." : "Ready to record"}</span>
              </div>
            </div>
          )}

          {/* Preview recorded media */}
          {recordedBlob && (
            <div className="bg-slate-900 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">Preview:</h4>
              {mode === "audio" && (
                <audio controls className="w-full">
                  <source src={URL.createObjectURL(recordedBlob)} type="audio/wav" />
                </audio>
              )}
              {mode === "video" && (
                <video controls className="w-full max-h-48">
                  <source src={URL.createObjectURL(recordedBlob)} type="video/mp4" />
                </video>
              )}
              {mode === "photo" && (
                <img
                  src={URL.createObjectURL(recordedBlob) || "/placeholder.svg"}
                  alt="Captured"
                  className="w-full max-h-48 object-contain"
                />
              )}
            </div>
          )}

          {/* Controls */}
          <div className="flex justify-center gap-4">
            {!recordedBlob && (
              <>
                {mode === "photo" ? (
                  <Button onClick={takePhoto} className="bg-cyan-500 hover:bg-cyan-600">
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                ) : (
                  <Button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={isRecording ? "bg-red-500 hover:bg-red-600" : "bg-cyan-500 hover:bg-cyan-600"}
                  >
                    {isRecording ? (
                      <>
                        <Square className="w-4 h-4 mr-2" />
                        Stop
                      </>
                    ) : (
                      <>
                        {mode === "audio" ? <Mic className="w-4 h-4 mr-2" /> : <Video className="w-4 h-4 mr-2" />}
                        Start Recording
                      </>
                    )}
                  </Button>
                )}
              </>
            )}

            {recordedBlob && (
              <>
                <Button onClick={() => setRecordedBlob(null)} variant="outline" className="border-slate-600">
                  Retake
                </Button>
                <Button onClick={sendMedia} className="bg-green-500 hover:bg-green-600">
                  Send
                </Button>
              </>
            )}

            <Button onClick={handleClose} variant="outline" className="border-slate-600 bg-transparent">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
