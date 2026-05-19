<script setup lang="ts">
import axios from 'axios'
import { computed, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

import { API_BASE_URL } from './lib/http'

const query = ref('')
const output = ref('')
const status = ref('状态：待机')
const selectedFileName = ref('未选择文件')
const isUploading = ref(false)
const isConnecting = ref(false)
const isStreaming = ref(false)
const hasReceivedChunk = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)

let es: EventSource | null = null
let ttsWs: WebSocket | null = null
let ttsSessionId: string | null = null
let ttsMediaSource: MediaSource | null = null
let ttsObjectUrl: string | null = null
let ttsSourceBuffer: SourceBuffer | null = null
let ttsPendingBuffers: ArrayBuffer[] = []
let ttsStreamFinal = false

const wsBaseUrl = API_BASE_URL.replace(/^http/, 'ws')

const hasContent = computed(() => output.value.trim().length > 0)
const isLoading = computed(
  () => isConnecting.value || (isStreaming.value && !hasReceivedChunk.value),
)
const canSend = computed(
  () => !isUploading.value && !isStreaming.value && query.value.trim().length > 0,
)
const renderedOutput = computed(() =>
  DOMPurify.sanitize(marked.parse(output.value, { breaks: true }) as string),
)

interface UploadProgressPayload {
  taskId?: string
  stage?: string
  status?: string
  progress?: number
  message?: string
  fileName?: string
  note?: string
  [key: string]: unknown
}

function serializePayload(payload: unknown) {
  if (typeof payload === 'string') {
    return payload
  }

  try {
    return JSON.stringify(payload, null, 2)
  } catch {
    return String(payload)
  }
}

function formatError(error: unknown) {
  if (axios.isAxiosError(error)) {
    if (error.response?.data) {
      return serializePayload(error.response.data)
    }

    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function setJsonOutput(payload: unknown) {
  output.value = `\`\`\`json\n${serializePayload(payload)}\n\`\`\``
}

function closeEventSource() {
  if (es) {
    es.close()
    es = null
  }

  isConnecting.value = false
  isStreaming.value = false
}

let ragProgressEs: EventSource | null = null
let currentUploadTaskId: string | null = null

function closeRagProgressEventSource() {
  if (ragProgressEs) {
    ragProgressEs.close()
    ragProgressEs = null
  }
}

function createUploadTaskId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID()
  }

  return `rag-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function renderUploadProgress(progress: UploadProgressPayload) {
  const percent =
    typeof progress.progress === 'number' ? ` ${progress.progress}%` : ''
  let message = progress.message ?? '后台处理中'

  if (message === '上传完成' || progress.status === 'completed') {
    message = '文件已上传'
  }

  status.value = `状态：${message}${percent}`
  setJsonOutput(progress)

  if (progress.status === 'completed' || progress.status === 'failed') {
    isUploading.value = false
    currentUploadTaskId = null
    closeRagProgressEventSource()
  }
}

function openUploadProgressStream(taskId: string) {
  closeRagProgressEventSource()

  ragProgressEs = new EventSource(
    `${API_BASE_URL}/rag/upload/progress?taskId=${encodeURIComponent(taskId)}`,
  )

  ragProgressEs.onmessage = (event) => {
    try {
      const progress = JSON.parse(event.data) as UploadProgressPayload
      renderUploadProgress(progress)
    } catch {
      let message = event.data
      if (message === '上传完成') {
        message = '文件已上传'
      }
      status.value = `状态：${message}`
      output.value = `\`\`\`\n${event.data}\n\`\`\``
    }
  }

  ragProgressEs.onerror = () => {
    if (ragProgressEs) {
      status.value = '状态：进度流连接异常'
    }
  }
}

function resetTtsPlayer() {
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

function handleFileChange() {
  const file = fileInput.value?.files?.[0]
  selectedFileName.value = file?.name ?? '未选择文件'
}

async function uploadSelectedFile() {
  const file = fileInput.value?.files?.[0]

  if (!file) {
    window.alert('请选择要上传的文件')
    return
  }

  isUploading.value = true
  status.value = '状态：文件上传中...'
  currentUploadTaskId = createUploadTaskId()
  output.value = `正在上传文件：${file.name}`
  openUploadProgressStream(currentUploadTaskId)

  const formData = new FormData()
  formData.append('file', file)
  formData.append('fileName',selectedFileName.value)
  formData.append('taskId', currentUploadTaskId)

  try {
    const result = await new Promise<unknown>((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.open('POST', `${API_BASE_URL}/rag/upload`)

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) {
          status.value = '状态：文件上传中...'
          return
        }

        const percent = Math.min(
          99,
          Math.round((event.loaded / event.total) * 100),
        )

        status.value = `状态：文件上传中 ${percent}%`
        setJsonOutput({
          taskId: currentUploadTaskId,
          stage: 'uploading',
          status: 'processing',
          progress: percent,
          message: `文件上传中 ${percent}%`,
          fileName: file.name,
        })
      }

      xhr.onerror = () => {
        reject(new Error('上传请求失败'))
      }

      xhr.onload = () => {
        const contentType = xhr.getResponseHeader('content-type') || ''
        const rawText = xhr.responseText || ''

        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(rawText || `上传失败，状态码：${xhr.status}`))
          return
        }

        if (contentType.includes('application/json')) {
          try {
            resolve(JSON.parse(rawText))
          } catch {
            reject(new Error('上传响应 JSON 解析失败'))
          }
          return
        }

        resolve(rawText)
      }

      xhr.send(formData)
    })

    if (typeof result === 'string') {
      output.value = result
      const displayMsg = result === '上传完成' ? '文件已上传' : result
      status.value = `状态：${displayMsg}`
      isUploading.value = false
    } else {
      status.value = '状态：文件已上传，后台处理中...'
      setJsonOutput({
        ...((result as Record<string, unknown>) ?? {}),
        note: '文件上传完成，等待服务端处理进度推送',
      })
    }
  } catch (error) {
    status.value = '状态：文件上传失败'
    output.value = `上传失败：${formatError(error)}`
    currentUploadTaskId = null
    closeRagProgressEventSource()
    isUploading.value = false
  }
}

async function startChat() {
  const trimmedQuery = query.value.trim()

  if (!trimmedQuery || isStreaming.value) {
    if (!trimmedQuery) {
      window.alert('请输入问题')
    }

    return
  }

  closeEventSource()
  resetTtsPlayer()
  output.value = ''
  status.value = '状态：连接中...'
  isConnecting.value = true
  isStreaming.value = true
  hasReceivedChunk.value = false

  await ensureTtsConnection()

  const params = new URLSearchParams({
    query: trimmedQuery,
  })

  if (ttsSessionId) {
    params.set('ttsSessionId', ttsSessionId)
  }

  es = new EventSource(`${API_BASE_URL}/ai/chat/stream?${params.toString()}`)

  es.onopen = () => {
    status.value = '状态：已连接，AI 思考中...'
  }

  es.onmessage = (event) => {
    if (!hasReceivedChunk.value) {
      hasReceivedChunk.value = true
      isConnecting.value = false
      status.value = '状态：AI 回复中...'
    }

    output.value += event.data
  }

  es.onerror = () => {
    status.value = hasReceivedChunk.value
      ? '状态：响应结束'
      : '状态：连接结束或发生错误'
    closeEventSource()
  }
}

watch(()=>selectedFileName.value, (newVal) => {
  if (newVal==='未选择文件') {
    status.value = `状态：待机`
    output.value = ''
    isUploading.value = false
  }
})

onBeforeUnmount(() => {
  closeEventSource()
  closeRagProgressEventSource()
  closeTtsWs()
  resetTtsPlayer()
})
</script>

<template>
  <div
    class="relative min-h-screen overflow-hidden bg-[#05010d] text-white antialiased"
  >
    <div class="pointer-events-none absolute inset-0">
      <div
        class="absolute left-1/2 top-[-9rem] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-nebula-500/25 blur-[120px]"
      />
      <div
        class="absolute bottom-[-6rem] left-[-4rem] h-[20rem] w-[20rem] rounded-full bg-fuchsia-500/12 blur-[100px]"
      />
      <div
        class="absolute right-[-5rem] top-[20%] h-[18rem] w-[18rem] rounded-full bg-violet-400/10 blur-[120px]"
      />
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />
      <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-10" />
    </div>

    <main class="relative mx-auto flex min-h-screen max-w-5xl items-center px-4 md:px-6 lg:px-8">
      <div class="w-full">
        <section class="panel-sci relative overflow-hidden p-5 md:p-7">
          <div
            class="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-nebula-200/80 to-transparent"
          />

          <h1 class="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            AI Copoilot
          </h1>

          <div class="mt-8 grid gap-5">
            <div>
              <label class="mb-2 block text-sm text-white/68" for="query">
                输入你的问题
              </label>
              <textarea
                id="query"
                v-model="query"
                class="input-sci min-h-[150px] resize-y leading-7"
                placeholder="请输入要发送给 AI 的问题，支持 Ctrl + Enter 快速发送..."
                @keydown.ctrl.enter.prevent="startChat"
              />
            </div>

            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div>
                <label class="mb-2 block text-sm text-white/68" for="fileInput">
                  上传知识文件
                </label>
                <div
                  class="rounded-2xl border border-white/10 bg-white/4 p-3 shadow-soft"
                >
                  <input
                    id="fileInput"
                    ref="fileInput"
                    class="block w-full cursor-pointer text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-nebula-500/18 file:px-4 file:py-2 file:text-sm file:font-medium file:text-nebula-50 hover:file:bg-nebula-500/28"
                    type="file"
                    @change="handleFileChange"
                  />
                  <p class="mt-3 truncate text-xs text-white/42">
                    当前文件：{{ selectedFileName }}
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap gap-3 md:justify-end">
                <button
                  class="btn-secondary"
                  type="button"
                  :disabled="isUploading || isStreaming"
                  @click="uploadSelectedFile"
                >
                  <span
                    v-if="isUploading"
                    class="mr-2 h-3.5 w-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin"
                  />
                  上传文件
                </button>
                <button
                  class="btn-primary min-w-[160px]"
                  type="button"
                  :disabled="!canSend"
                  @click="startChat"
                >
                  <span v-if="isLoading" class="mr-2 inline-flex items-center gap-1.5">
                    <span class="loading-dot" />
                    <span class="loading-dot" />
                    <span class="loading-dot" />
                  </span>
                  {{ isStreaming ? '对话中...' : '开始对话' }}
                </button>
              </div>
            </div>
          </div>

          <div class="mt-6 rounded-3xl border border-white/10 bg-[#0b0715]/90 shadow-soft">
            <div
              class="flex items-center justify-between border-b border-white/8 px-4 py-3 text-xs tracking-[0.2em] text-white/40 uppercase"
            >
              <span>实时输出</span>
              <span class="text-nebula-100/80">{{ status }}</span>
            </div>

            <div
              class="markdown-body max-h-[460px] min-h-[320px] overflow-y-auto px-4 py-4 text-sm leading-7 text-white/84"
            >
              <div
                v-if="!hasContent && !isLoading"
                class="flex min-h-[288px] items-center justify-center text-center text-white/34"
              >
                发送问题后，AI 的流式内容会持续显示在这里。
              </div>

              <div v-else class="space-y-4">
                <div v-if="isLoading && !hasContent" class="space-y-3 py-3">
                  <div class="h-4 w-[72%] animate-pulse rounded-full bg-white/8" />
                  <div class="h-4 w-[88%] animate-pulse rounded-full bg-nebula-300/10" />
                  <div class="h-4 w-[66%] animate-pulse rounded-full bg-white/8" />
                  <div class="h-4 w-[80%] animate-pulse rounded-full bg-nebula-300/10" />
                </div>

                <div
                  v-if="hasContent"
                  class="break-words text-white/88"
                  v-html="renderedOutput"
                />

                <div
                  v-if="isStreaming"
                  class="inline-flex items-center gap-2 rounded-full border border-nebula-300/20 bg-nebula-400/8 px-3 py-1.5 text-xs text-nebula-100/88"
                >
                  <span class="h-2 w-2 rounded-full bg-nebula-300 shadow-[0_0_12px_rgba(167,139,250,0.95)]" />
                  AI 流式生成中
                </div>
              </div>
            </div>
          </div>
          <audio ref="audioRef" autoplay preload="none" class="hidden" />
        </section>
      </div>
    </main>
  </div>
</template>

<style scoped>
.markdown-body :deep(*) {
  box-sizing: border-box;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin: 1rem 0 0.65rem;
  font-weight: 700;
  line-height: 1.35;
  color: #fff;
}

.markdown-body :deep(h1) {
  font-size: 1.6rem;
}

.markdown-body :deep(h2) {
  font-size: 1.35rem;
}

.markdown-body :deep(h3) {
  font-size: 1.15rem;
}

.markdown-body :deep(p),
.markdown-body :deep(ul),
.markdown-body :deep(ol),
.markdown-body :deep(blockquote),
.markdown-body :deep(pre) {
  margin: 0.75rem 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  padding-left: 1.4rem;
}

.markdown-body :deep(li) {
  margin: 0.3rem 0;
}

.markdown-body :deep(strong) {
  color: #fff;
  font-weight: 700;
}

.markdown-body :deep(em) {
  color: rgba(255, 255, 255, 0.82);
}

.markdown-body :deep(a) {
  color: #c4b5fd;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.markdown-body :deep(code) {
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 0.5rem;
  background: rgba(255, 255, 255, 0.06);
  padding: 0.15rem 0.42rem;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 0.92em;
  color: #ddd6fe;
}

.markdown-body :deep(pre) {
  overflow-x: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 1rem;
  background: rgba(9, 4, 20, 0.92);
  padding: 1rem;
}

.markdown-body :deep(pre code) {
  border: 0;
  background: transparent;
  padding: 0;
  color: #f5f3ff;
}

.markdown-body :deep(blockquote) {
  border-left: 3px solid rgba(167, 139, 250, 0.7);
  margin-left: 0;
  padding: 0.2rem 0 0.2rem 1rem;
  color: rgba(255, 255, 255, 0.68);
  background: rgba(255, 255, 255, 0.03);
}

.markdown-body :deep(hr) {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin: 1rem 0;
}

.markdown-body :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1rem 0;
  overflow: hidden;
  border-radius: 0.9rem;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 0.75rem;
  text-align: left;
}

.markdown-body :deep(th) {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.loading-dot {
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.95);
  animation: loading-bounce 1s infinite ease-in-out;
}

.loading-dot:nth-child(2) {
  animation-delay: 0.12s;
}

.loading-dot:nth-child(3) {
  animation-delay: 0.24s;
}

@keyframes loading-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.35;
  }

  40% {
    transform: translateY(-0.22rem);
    opacity: 1;
  }
}
</style>
