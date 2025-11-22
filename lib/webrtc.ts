// ---------- Connection / Media helpers ----------

/**
 * Create and return a configured RTCPeerConnection.
 */
export function createPeerConnection(): RTCPeerConnection {
  const pcConfig: RTCConfiguration = {
    bundlePolicy: "max-bundle", // Added to use single port for audio/video
    rtcpMuxPolicy: "require", // Added to require multiplexing
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      { urls: "stun:stun.modulus.fe.up.pt:3478" },
      { urls: "stun:stun.net-internals.com:3478" },
      { urls: "stun:stun.nextcloud.com:3478" },
      { urls: "stun:stun.nodezwolle.nl:3478" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
    iceCandidatePoolSize: 10,
  }

  const pc = new RTCPeerConnection(pcConfig)

  pc.onconnectionstatechange = () => {
    console.log("WebRTC connection state:", pc.connectionState)
  }
  pc.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", pc.iceConnectionState)
  }

  return pc
}

/**
 * Convenience wrapper around `navigator.mediaDevices.getUserMedia`
 * with simple logging.
 */
export async function getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  console.log("getUserMedia constraints:", constraints)
  const stream = await navigator.mediaDevices.getUserMedia(constraints)
  return stream
}

/** Stop every track in a MediaStream and release the camera / mic. */
export function stopMediaStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((t) => t.stop())
}

/** Check if the browser already has permissions for mic / cam. */
export async function checkMediaPermissions(): Promise<{ audio: boolean; video: boolean }> {
  try {
    const [mic, cam] = await Promise.all([
      navigator.permissions.query({ name: "microphone" as PermissionName }),
      navigator.permissions.query({ name: "camera" as PermissionName }),
    ])
    return { audio: mic.state === "granted", video: cam.state === "granted" }
  } catch {
    return { audio: false, video: false }
  }
}

export async function requestMediaPermissions(
  audio = true,
  video = true,
  facingMode: "user" | "environment" = "user",
): Promise<MediaStream | null> {
  try {
    console.log("Requesting media permissions:", { audio, video, facingMode })

    const constraints: MediaStreamConstraints = {
      audio: audio
        ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }
        : false,
      video: video
        ? {
            width: { min: 320, ideal: 640, max: 1280 },
            height: { min: 240, ideal: 480, max: 720 },
            frameRate: { min: 15, ideal: 30, max: 60 },
            facingMode: facingMode,
          }
        : false,
    }

    console.log("Media constraints:", constraints)
    const stream = await navigator.mediaDevices.getUserMedia(constraints)

    // Log detailed stream information
    const audioTracks = stream.getAudioTracks()
    const videoTracks = stream.getVideoTracks()

    console.log("Successfully got media stream:", {
      audioTracks: audioTracks.length,
      videoTracks: videoTracks.length,
      audioTrackDetails: audioTracks.map((t) => ({
        id: t.id,
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        settings: t.getSettings(),
      })),
      videoTrackDetails: videoTracks.map((t) => ({
        id: t.id,
        kind: t.kind,
        enabled: t.enabled,
        readyState: t.readyState,
        settings: t.getSettings(),
      })),
    })

    // Ensure video tracks are enabled
    videoTracks.forEach((track) => {
      if (track.readyState === "live") {
        track.enabled = true
        console.log(`Video track ${track.id} enabled:`, track.enabled)
      }
    })

    return stream
  } catch (error) {
    console.error("Error requesting media permissions:", error)

    // Try with less strict constraints if the first attempt fails
    try {
      console.log("Trying fallback constraints...")
      const fallbackConstraints: MediaStreamConstraints = {
        audio: audio,
        video: video ? { width: 640, height: 480, facingMode } : false, // added facingMode to fallback
      }

      console.log("Fallback constraints:", fallbackConstraints)
      const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints)
      console.log("Got media stream with fallback constraints")

      // Log fallback stream details
      const audioTracks = stream.getAudioTracks()
      const videoTracks = stream.getVideoTracks()

      console.log("Fallback stream details:", {
        audioTracks: audioTracks.length,
        videoTracks: videoTracks.length,
        videoTrackDetails: videoTracks.map((t) => ({
          id: t.id,
          enabled: t.enabled,
          readyState: t.readyState,
          settings: t.getSettings(),
        })),
      })

      return stream
    } catch (fallbackError) {
      console.error("Fallback media request also failed:", fallbackError)
      return null
    }
  }
}
