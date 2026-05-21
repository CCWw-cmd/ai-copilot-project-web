import { ref, onBeforeUnmount } from 'vue'
import { API_BASE_URL } from './http'

export function useTts() {
  const isReading = ref(false)
  const isMuted = ref(false)
  const audioRef = ref<HTMLAudioElement | null>(null)

  let ttsWs: WebSocket | null = null
  let ttsSessionId: string | null = null
  let ttsMediaSource: MediaSource | null = null
  let ttsObjectUrl: string | null = null
  let ttsSourceBuffer: SourceBuffer | null = null
  let ttsPendingBuffers: ArrayBuffer[] = []
  let ttsStreamFinal = false

  const wsBaseUrl = API_BASE_URL.replace(/^http/, 'ws')

  function resetTtsPlayer() {
    isReading.value = false
    ttsPendingBuffers = []
    ttsStreamFinal = false
    ttsSourceBuffer = null
    ttsMediaSource = null

    if (ttsObjectUrl) {
      URL.revokeObjectURL(ttsObjectUrl)
      ttsObjectUrl = null
    }

    const audioEl = audioRef.value
    if (audioEl) {
      audioEl.pause()
      audioEl.removeAttribute('src')
      audioEl.load()
    }
  }

  function flushTtsBufferQueue() {
    if (!ttsSourceBuffer || !ttsMediaSource || ttsSourceBuffer.updating) {
      return
    }

    if (ttsPendingBuffers.length > 0) {
      const next = ttsPendingBuffers.shift()

      if (next) {
        try {
          ttsSourceBuffer.appendBuffer(next)
          audioRef.value?.play().catch(() => undefined)
        } catch {
          ttsPendingBuffers.unshift(next)
        }
      }

      return
    }

    if (ttsStreamFinal && ttsMediaSource.readyState === 'open') {
      try {
        ttsMediaSource.endOfStream()
      } catch {
        // ignore endOfStream failures caused by abrupt socket close
      }
    }
  }

  function prepareStreamingAudio() {
    resetTtsPlayer()

    if (
      typeof MediaSource === 'undefined' ||
      !MediaSource.isTypeSupported('audio/mpeg') ||
      !audioRef.value
    ) {
      return
    }

    const mediaSource = new MediaSource()
    const objectUrl = URL.createObjectURL(mediaSource)

    ttsMediaSource = mediaSource
    ttsObjectUrl = objectUrl
    audioRef.value.src = objectUrl

    mediaSource.addEventListener('sourceopen', () => {
      if (!ttsMediaSource || ttsMediaSource !== mediaSource) {
        return
      }

      ttsSourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')
      ttsSourceBuffer.mode = 'sequence'
      ttsSourceBuffer.addEventListener('updateend', flushTtsBufferQueue)
      flushTtsBufferQueue()
    })
  }

  function closeTtsWs() {
    if (ttsWs && ttsWs.readyState !== WebSocket.CLOSED) {
      ttsWs.close()
    }

    ttsWs = null
    ttsSessionId = null
  }

  function ensureTtsConnection() {
    return new Promise<void>((resolve) => {
      if (ttsWs && ttsWs.readyState === WebSocket.OPEN && ttsSessionId) {
        resolve()
        return
      }

      closeTtsWs()

      const ws = new WebSocket(`${wsBaseUrl}/speech/tts/ws`)
      let settled = false

      const finish = () => {
        if (settled) {
          return
        }

        settled = true
        resolve()
      }

      ws.binaryType = 'arraybuffer'
      ttsWs = ws

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data) as {
              type?: string
              sessionId?: string
            }

            if (msg.type === 'session' && msg.sessionId) {
              ttsSessionId = msg.sessionId
              finish()
              return
            }

            if (msg.type === 'tts_started') {
              prepareStreamingAudio()
              return
            }

            if (
              msg.type === 'tts_final' ||
              msg.type === 'tts_closed' ||
              msg.type === 'tts_error'
            ) {
              ttsStreamFinal = true
              flushTtsBufferQueue()
            }
          } catch {
            // ignore malformed websocket metadata
          }

          return
        }

        if (event.data instanceof ArrayBuffer) {
          ttsPendingBuffers.push(event.data)
          flushTtsBufferQueue()
        }
      }

      ws.onerror = () => {
        closeTtsWs()
        finish()
      }

      ws.onclose = () => {
        ttsWs = null
        finish()
      }
    })
  }

  function initAudioListeners() {
    if (audioRef.value) {
      audioRef.value.onplaying = () => { isReading.value = true }
      audioRef.value.onpause = () => { isReading.value = false }
      audioRef.value.onended = () => { isReading.value = false }
      audioRef.value.onerror = () => { isReading.value = false }
    }
  }

  onBeforeUnmount(() => {
    closeTtsWs()
    resetTtsPlayer()
  })

  return {
    isReading,
    isMuted,
    audioRef,
    ttsSessionId,
    ensureTtsConnection,
    resetTtsPlayer,
    closeTtsWs,
    initAudioListeners
  }
}
