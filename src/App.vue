<script setup lang="ts">
import axios from 'axios'
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'

import { API_BASE_URL } from './lib/http'
import MindMap from './components/MindMap.vue'

const query = ref('')
const isChatStarted = ref(false)
const output = ref('')
const status = ref('状态：待机')
const selectedFileName = ref('未选择文件')
const uploadedFiles = ref<{ name: string; status: 'uploading' | 'success' }[]>([])
const isUploading = ref(false)
const isConnecting = ref(false)
const isStreaming = ref(false)
const hasReceivedChunk = ref(false)
const isReading = ref(false)
const isMuted = ref(false)
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

const mindmapCode = computed(() => {
  const match = output.value.match(/```mindmap\n([\s\S]*?)\n```/)
  return match ? match[1] : ''
})

const cleanOutput = computed(() => {
  return output.value.replace(/```mindmap\n[\s\S]*?\n```/g, '').trim()
})

const renderedOutput = computed(() =>
  DOMPurify.sanitize(marked.parse(cleanOutput.value, { breaks: true }) as string),
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

  // Skip the initial "waiting" message to avoid status flicker
  if (message === '等待上传开始') {
    return
  }

  if (message === '上传完成' || progress.status === 'completed') {
    message = '文件已上传'
  }

  status.value = `状态：${message}${percent}`

  if (progress.status === 'completed' || progress.status === 'failed') {
    isUploading.value = false
    currentUploadTaskId = null
    closeRagProgressEventSource()

    // Clear status and output after 1 second on completion
    if (progress.status === 'completed') {
      setTimeout(() => {
        status.value = '状态：待机'
        output.value = ''
      }, 1000)
    }
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
      if (message === '等待上传开始') {
        return
      }
      if (message === '上传完成') {
        message = '文件已上传'
        
        // Handle completion in catch block for plain text messages
        setTimeout(() => {
          status.value = '状态：待机'
          output.value = ''
          isUploading.value = false
        }, 1000)
      }
      status.value = `状态：${message}`
    }
  }

  ragProgressEs.onerror = () => {
    if (ragProgressEs) {
      status.value = '状态：进度流连接异常'
    }
  }
}

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
  openUploadProgressStream(currentUploadTaskId)

  // Add to sidebar list with uploading status
  const existingFileIndex = uploadedFiles.value.findIndex(f => f.name === file.name)
  if (existingFileIndex > -1) {
    uploadedFiles.value[existingFileIndex].status = 'uploading'
  } else {
    uploadedFiles.value.push({ name: file.name, status: 'uploading' })
  }

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

    // Clear selected file UI immediately after successful upload initiation/completion
    selectedFileName.value = '未选择文件'
    if (fileInput.value) fileInput.value.value = ''

    if (typeof result === 'string') {
      const displayMsg = result === '上传完成' ? '文件已上传' : result
      status.value = `状态：${displayMsg}`

      // Clear status after 1 second if it was successful
      setTimeout(() => {
        status.value = '状态：待机'
      }, 1000)

      if (result === '上传完成' || result.includes('完成')) {
        const fileObj = uploadedFiles.value.find(f => f.name === file.name)
        if (fileObj) fileObj.status = 'success'
      }
      isUploading.value = false
    } else {
      status.value = '状态：文件已上传，后台处理中...'
      
      // Clear status after 1 second
      setTimeout(() => {
        status.value = '状态：待机'
      }, 1000)

      const fileObj = uploadedFiles.value.find(f => f.name === file.name)
      if (fileObj) fileObj.status = 'success'
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
  isChatStarted.value = true
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

watchEffect(() => {
  if (audioRef.value) {
    audioRef.value.muted = isMuted.value
  }
})

watch(()=>selectedFileName.value, (newVal) => {
  if (newVal==='未选择文件') {
    status.value = `状态：待机`
    output.value = ''
    isUploading.value = false
  }
})

onMounted(() => {
  if (audioRef.value) {
    audioRef.value.onplaying = () => { isReading.value = true }
    audioRef.value.onpause = () => { isReading.value = false }
    audioRef.value.onended = () => { isReading.value = false }
    audioRef.value.onerror = () => { isReading.value = false }
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
    class="relative flex h-screen flex-col overflow-hidden bg-[#05010d] text-white antialiased"
  >
    <!-- Background elements omitted for brevity, but they should stay -->
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

    <!-- Header (Always visible) -->
    <header class="relative z-20 w-full border-b border-white/8 bg-[#05010d]/50 px-6 py-4 backdrop-blur-md md:px-8">
      <div class="mx-30px flex max-w-[1440px] items-center justify-between">
        <h1 class="text-xl font-semibold tracking-tight text-white md:text-2xl">
          AI Copoilot
        </h1>
      </div>
    </header>

    <div class="relative z-10 flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <aside class="flex w-64 flex-col border-r border-white/8 bg-white/2 backdrop-blur-xl">
        <!-- Sidebar Top: Upload controls -->
        <div class="p-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-medium text-white/40 uppercase tracking-widest">知识文档</span>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/3 text-lg text-white/40 transition hover:bg-white/8 hover:text-white/80"
              title="选择并上传文件"
              @click="fileInput?.click()"
            >
              +
            </button>
          </div>
          
          <input
            ref="fileInput"
            type="file"
            class="hidden"
            @change="handleFileChange"
          />

          <div v-if="selectedFileName !== '未选择文件'" class="mb-4">
            <div class="rounded-xl border border-nebula-500/30 bg-nebula-500/10 p-2.5">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] text-nebula-200 truncate pr-2">📎 {{ selectedFileName }}</span>
                <button 
                  class="text-white/40 hover:text-white text-xs" 
                  @click="selectedFileName = '未选择文件'; if(fileInput) fileInput.value = ''"
                >
                  ×
                </button>
              </div>
              <button
                class="w-full btn-primary !py-1.5 !text-xs !rounded-lg"
                type="button"
                :disabled="isUploading"
                @click="uploadSelectedFile"
              >
                <span
                  v-if="isUploading"
                  class="mr-2 h-3 w-3 rounded-full border-2 border-white/20 border-t-white animate-spin"
                />
                上传至知识库
              </button>
            </div>
          </div>
        </div>

        <!-- Sidebar Content: Uploaded Files List -->
        <div class="flex-1 overflow-y-auto px-2">
          <div v-if="uploadedFiles.length === 0" class="flex flex-col items-center justify-center py-10 px-4 text-center">
            <div class="mb-3 text-2xl opacity-20">📁</div>
            <p class="text-xs text-white/30">暂无上传文档</p>
          </div>
          <ul v-else class="list-none m-0 p-0 space-y-1">
            <li v-for="file in uploadedFiles" :key="file.name" class="group relative">
              <div class="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white">
                <div class="flex items-center gap-3 overflow-hidden">
                  <span class="text-nebula-400 shrink-0">📄</span>
                  <span class="truncate">{{ file.name }}</span>
                </div>
                <div class="flex shrink-0 items-center ml-2">
                  <span v-if="file.status === 'uploading'" class="h-3 w-3 rounded-full border-2 border-white/20 border-t-nebula-400 animate-spin" />
                  <span v-else-if="file.status === 'success'" class="text-green-400 font-bold text-xs">√</span>
                </div>
              </div>
            </li>
          </ul>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="relative flex flex-1 flex-col overflow-hidden">
        <!-- Output / Welcome Area -->
        <div class="flex flex-1 flex-col overflow-y-auto py-6 px-6 md:px-1">
          <div class="flex flex-1 flex-col items-center">
            <!-- Welcome View (Shown when no content) -->
            <div v-if="!hasContent && !isLoading" class="flex flex-1 flex-col items-center justify-center">
              <h2 class="mb-12 text-4xl font-medium tracking-tight text-white/90">
                有什么想问的吗?
              </h2>
            </div>

            <!-- Chat Output Area -->
            <div v-else class="w-full max-w-4xl">
              <div
                class="markdown-body px-4 py-4 text-base leading-7 text-white/84"
              >
                <div class="space-y-6">
                  <div v-if="isLoading && !hasContent" class="space-y-4 py-6">
                    <div class="h-4 w-[60%] animate-pulse rounded-full bg-white/5" />
                    <div class="h-4 w-[80%] animate-pulse rounded-full bg-nebula-300/5" />
                    <div class="h-4 w-[40%] animate-pulse rounded-full bg-white/5" />
                  </div>

                  <div v-if="hasContent" class="group/msg relative">
                    <div
                      class="break-words text-white/90"
                      v-html="renderedOutput"
                    />
                  </div>

                  <MindMap v-if="mindmapCode" :code="mindmapCode" />

                  <div
                    v-if="isStreaming"
                    class="flex items-center gap-3 text-xs text-nebula-300/60"
                  >
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-nebula-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-nebula-500"></span>
                    </span>
                    AI 正在输入...
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Input Area (Bottom) -->
        <div class="px-6 pb-8 pt-2 md:px-10">
          <div class="mx-auto max-w-4xl">
            <div v-if="isChatStarted || isUploading || isReading" class="flex justify-between items-center mb-2">
              <!-- Left side: Reading status & Toggle -->
              <div v-if="isReading" class="flex items-center gap-3">
                <div class="flex items-center gap-2 text-[13px] text-nebula-400 font-medium">
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-nebula-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-nebula-500"></span>
                  </span>
                  AI 正在朗读...
                </div>
                <button 
                  @click="isMuted = !isMuted"
                  class="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-2.5 py-1 text-[11px] text-white/50 transition hover:bg-white/10 hover:text-white"
                  :class="{ '!text-nebula-400 !border-nebula-500/30 !bg-nebula-500/10': isMuted }"
                >
                  <span v-if="isMuted">🔇 静音中</span>
                  <span v-else>🔊 朗读中</span>
                </button>
              </div>
              <div v-else></div>

              <!-- Right side: General status -->
              <span class="text-[13px] text-white/30 tracking-widest uppercase font-medium">{{ status }}</span>
            </div>
            <div class="panel-sci !rounded-[24px] p-2 bg-[#1a1625]/80 border-white/5 shadow-2xl">
              <div class="flex items-center gap-2">
                <!-- Textarea -->
                <div class="relative flex-1">
                  <textarea
                    id="query-input"
                    v-model="query"
                    class="w-full bg-transparent border-none outline-none py-3 text-sm text-white/90 placeholder:text-white/20 resize-none max-h-[200px] min-h-[44px]"
                    placeholder="有问题，尽管问"
                    @keydown.ctrl.enter.prevent="startChat"
                  />
                  <!-- File badge if selected -->
                  <div
                    v-if="selectedFileName !== '未选择文件'"
                    class="absolute -top-12 left-0 flex items-center gap-2 rounded-lg bg-nebula-500/20 border border-nebula-500/30 px-3 py-1.5 text-[10px] text-nebula-200 backdrop-blur-md"
                  >
                    <span>📎</span>
                    <span class="max-w-[150px] truncate">{{ selectedFileName }}</span>
                    <button 
                      class="ml-1 text-white/40 hover:text-white" 
                      @click="selectedFileName = '未选择文件'; if(fileInput) fileInput.value = ''"
                    >
                      ×
                    </button>
                  </div>
                </div>

                <!-- Action Button -->
                <button
                  class="btn-primary !rounded-2xl h-10 px-6 min-w-[100px] !text-xs font-bold tracking-wide"
                  type="button"
                  :disabled="!canSend"
                  @click="startChat"
                >
                  <span v-if="isLoading" class="mr-2 inline-flex items-center gap-1">
                    <span class="loading-dot !w-1 !h-1" />
                    <span class="loading-dot !w-1 !h-1" />
                  </span>
                  {{ isStreaming ? '对话中' : '开始对话' }}
                </button>
              </div>
            </div>
            <p class="mt-4 text-center text-[14px] text-white/30 tracking-tight">
              AI 可能会产生错误，请核查重要信息。
            </p>
          </div>
        </div>
      </main>
    </div>
    <audio ref="audioRef" autoplay preload="none" class="hidden" />
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
