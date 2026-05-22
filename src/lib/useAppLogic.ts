import { ref, computed, watchEffect, watch, onMounted, onBeforeUnmount } from 'vue'
import { createDiscreteApi, darkTheme } from 'naive-ui'
import { usePdfExport } from './usePdfExport'
import { useTts } from './useTts'
import { useRag } from './useRag'
import { useChat } from './useChat'
import { useVideo } from './useVideo'
import { http } from './http'

type ChatRole = 'user' | 'assistant'

interface ChatMediaAttachment {
  type: 'image' | 'video'
  name: string
  filePath: string
  previewUrl: string
}

interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  mediaList?: ChatMediaAttachment[]
}

interface Conversation {
  id: string
  title: string
  updatedAt: number
  messages: ChatMessage[]
}

const STORAGE_KEY = 'ai-copilot-conversations-v1'
const UNTITLED_CONVERSATION = '新对话'
const DEFAULT_MODEL_NAME = '默认模型'

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function createConversation(title = UNTITLED_CONVERSATION): Conversation {
  return {
    id: createId('conversation'),
    title,
    updatedAt: Date.now(),
    messages: []
  }
}

function normalizeMediaAttachment(raw: unknown): ChatMediaAttachment | undefined {
  if (!raw || typeof raw !== 'object') return undefined

  const candidate = raw as Partial<ChatMediaAttachment>
  if (candidate.type !== 'image' && candidate.type !== 'video') return undefined
  if (typeof candidate.name !== 'string' || !candidate.name.trim()) return undefined
  if (typeof candidate.filePath !== 'string') return undefined
  if (typeof candidate.previewUrl !== 'string' || !candidate.previewUrl.trim()) return undefined

  return {
    type: candidate.type,
    name: candidate.name.trim(),
    filePath: candidate.filePath,
    previewUrl: candidate.previewUrl.trim()
  }
}

function normalizeMediaAttachments(raw: unknown): ChatMediaAttachment[] | undefined {
  if (!Array.isArray(raw)) return undefined

  const items = raw
    .map((item) => normalizeMediaAttachment(item))
    .filter((item): item is ChatMediaAttachment => Boolean(item))

  return items.length > 0 ? items : undefined
}

function normalizeConversation(raw: unknown): Conversation | null {
  if (!raw || typeof raw !== 'object') return null

  const candidate = raw as Partial<Conversation>
  if (typeof candidate.id !== 'string') return null

  const messages = Array.isArray(candidate.messages)
    ? candidate.messages
      .filter((message) => message && typeof message === 'object')
      .map((message) => {
        const msg = message as Partial<ChatMessage>
        return {
          id: typeof msg.id === 'string' ? msg.id : createId('message'),
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: typeof msg.content === 'string' ? msg.content : '',
          createdAt: typeof msg.createdAt === 'number' ? msg.createdAt : Date.now(),
          mediaList: normalizeMediaAttachments((msg as any).mediaList)
            ?? (normalizeMediaAttachment((msg as any).media) ? [normalizeMediaAttachment((msg as any).media)!] : undefined)
        } satisfies ChatMessage
      })
    : []

  return {
    id: candidate.id,
    title: typeof candidate.title === 'string' && candidate.title.trim()
      ? candidate.title.trim()
      : UNTITLED_CONVERSATION,
    updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : Date.now(),
    messages
  }
}

function loadStoredConversations() {
  if (typeof window === 'undefined') {
    return [createConversation()]
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return [createConversation()]
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return [createConversation()]
    }

    const conversations = parsed
      .map(normalizeConversation)
      .filter((item): item is Conversation => Boolean(item))

    return conversations.length > 0 ? conversations : [createConversation()]
  } catch {
    return [createConversation()]
  }
}

function buildConversationTitle(text: string) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!normalized) return UNTITLED_CONVERSATION
  return normalized.length > 22 ? `${normalized.slice(0, 22)}...` : normalized
}

export function useAppLogic() {
  const { message } = createDiscreteApi(['message'], {
    configProviderProps: computed(() => ({
      theme: darkTheme
    }))
  })

  const query = ref('')
  const exportContentRef = ref<HTMLElement | null>(null)
  const sidebarRef = ref<any>(null)
  const conversations = ref<Conversation[]>(loadStoredConversations())
  const currentConversationId = ref(conversations.value[0]?.id ?? createConversation().id)
  const streamingConversationId = ref('')
  const streamingAssistantMessageId = ref('')
  const modelName = ref(DEFAULT_MODEL_NAME)

  const fetchModelName = async () => {
    try {
      const res = await http.get('/ai/model')
      if (res.data && res.data.model) {
        modelName.value = res.data.model
      }
    } catch (err) {
      console.error('获取模型名称失败:', err)
    }
  }

  onMounted(() => {
    fetchModelName()
  })

  // 使用组合式函数提取逻辑
  const { isExporting, exportToPdf } = usePdfExport()

  const currentConversation = computed(() =>
    conversations.value.find((item) => item.id === currentConversationId.value) ?? conversations.value[0],
  )

  const conversationMessages = computed(() => currentConversation.value?.messages ?? [])
  const conversationList = computed(() =>
    [...conversations.value].sort((a, b) => b.updatedAt - a.updatedAt),
  )
  const currentConversationTitle = computed(() => currentConversation.value?.title ?? UNTITLED_CONVERSATION)
  const streamingConversation = computed(() =>
    conversations.value.find((item) => item.id === streamingConversationId.value) ?? null,
  )
  const isCurrentConversationStreaming = computed(
    () => isStreaming.value && streamingConversationId.value === currentConversationId.value,
  )

  const pageTitle = computed(() => currentConversationTitle.value)

  const triggerPdfExport = (el?: HTMLElement | null) => {
    const targetEl = el || exportContentRef.value
    exportToPdf(targetEl, pageTitle.value)
  }
  const { 
    isReading, 
    isMuted, 
    audioRef, 
    ttsSessionId, 
    ensureTtsConnection, 
    resetTtsPlayer, 
    initAudioListeners, 
    closeTtsWs 
  } = useTts()
  
  const { 
    selectedFile: selectedRagFile,
    selectedFileName, 
    uploadedFiles, 
    isUploading, 
    status: ragStatus, 
    selectFile: selectRagFile,
    clearSelectedFile,
    uploadSelectedFile, 
    removeFile, 
    closeRagProgressEventSource 
  } = useRag()
  
  const { 
    isChatStarted, 
    isConnecting, 
    isStreaming, 
    currentAction,
    hasReceivedChunk, 
    output: chatOutput, 
    status: chatStatus, 
    startChat: startChatLogic, 
    closeEventSource,
    resetChatState
  } = useChat()

  const {
    mediaAttachments,
    selectedVideoName,
    selectedImageName,
    mediaPath: videoPath,
    previewUrl,
    mediaType,
    isUploading: isUploadingVideo,
    uploadProgress: videoUploadProgress,
    uploadMedia,
    removeMedia,
    clearMedia: clearVideo
  } = useVideo()

  // 综合状态管理
  const status = computed(() => {
    // 优先显示 RAG (上传/处理) 状态，只要不是“待机”就显示
    if (ragStatus.value !== '状态：待机' && ragStatus.value !== '') {
      return ragStatus.value
    }
    // 其次显示视频上传状态
    if (isUploadingVideo.value) {
      return `状态：视频上传中 ${videoUploadProgress.value}%`
    }
    if (isStreaming.value && !isCurrentConversationStreaming.value && streamingConversation.value) {
      return `状态：${streamingConversation.value.title} 正在后台生成`
    }
    // 最后显示对话状态
    return chatStatus.value
  })

  const displayCurrentAction = computed(() => {
    if (isCurrentConversationStreaming.value) {
      return currentAction.value
    }
    if (isStreaming.value && streamingConversation.value) {
      return `${streamingConversation.value.title} 正在后台生成...`
    }
    return ''
  })

  const output = computed(() => chatOutput.value)

  const hasContent = computed(() =>
    conversationMessages.value.some((message) => message.content.trim().length > 0),
  )
  const isSystemError = computed(() =>
    conversationMessages.value.some((message) => message.content.includes('【系统提示】')),
  )

  const showPdfButton = computed(() => hasContent.value && !isSystemError.value)
  const knowledgeBaseStatus = computed(() => {
    if (isUploading.value) return '知识库处理中'
    if (selectedFileName.value !== '未选择文件') return '待上传文档'
    if (mediaAttachments.value.length > 0) return `已关联 ${mediaAttachments.value.length} 个媒体文件`
    if (uploadedFiles.value.length === 0) return '未加载知识库'
    return `已加载 ${uploadedFiles.value.length} 份文档`
  })

  const isLoading = computed(
    () => isConnecting.value || (isStreaming.value && !hasReceivedChunk.value) || isUploadingVideo.value,
  )
  const canSend = computed(
    () => !isUploading.value && !isStreaming.value && !isUploadingVideo.value && query.value.trim().length > 0,
  )

  function updateConversation(conversationId: string, updater: (conversation: Conversation) => void) {
    const conversation = conversations.value.find((item) => item.id === conversationId)
    if (!conversation) return
    updater(conversation)
  }

  function persistConversations() {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations.value))
  }

  function stopStreamingConversation() {
    streamingConversationId.value = ''
    streamingAssistantMessageId.value = ''
    closeEventSource()
    resetChatState()
  }

  function resetComposerState() {
    query.value = ''
  }

  function createNewConversation() {
    resetComposerState()

    const conversation = createConversation()
    conversations.value = [conversation, ...conversations.value]
    currentConversationId.value = conversation.id
  }

  function switchConversation(conversationId: string) {
    if (conversationId === currentConversationId.value) return

    resetComposerState()
    currentConversationId.value = conversationId
  }

  function renameConversation(conversationId: string, title: string) {
    const normalizedTitle = title.trim()
    if (!normalizedTitle) {
      message.warning('会话标题不能为空')
      return
    }

    updateConversation(conversationId, (conversation) => {
      conversation.title = normalizedTitle
      conversation.updatedAt = Date.now()
    })
  }

  function deleteConversation(conversationId: string) {
    const conversation = conversations.value.find((item) => item.id === conversationId)
    if (!conversation) return

    conversations.value = conversations.value.filter((item) => item.id !== conversationId)

    if (conversations.value.length === 0) {
      const nextConversation = createConversation()
      conversations.value = [nextConversation]
      currentConversationId.value = nextConversation.id
    } else if (currentConversationId.value === conversationId) {
      currentConversationId.value = conversationList.value[0]?.id ?? conversations.value[0].id
    }

    if (streamingConversationId.value === conversationId) {
      stopStreamingConversation()
    } else {
      resetComposerState()
    }
  }

  function clearCurrentConversation() {
    if (!currentConversation.value) return

    if (streamingConversationId.value === currentConversation.value.id) {
      stopStreamingConversation()
    } else {
      resetComposerState()
    }
    updateConversation(currentConversation.value.id, (conversation) => {
      conversation.messages = []
      conversation.title = UNTITLED_CONVERSATION
      conversation.updatedAt = Date.now()
    })
  }

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    // 知识库不再允许添加视频和图片
    if (file.type.startsWith('video/') || file.type.startsWith('image/')) {
      message.warning('知识库仅支持文档格式（PDF、DOCX、TXT 等）')
      input.value = ''
      return
    }

    selectRagFile(file)
    input.value = ''
  }

  async function handleChatFileChange(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? [])
    if (files.length === 0) return

    const validFiles = files.filter((file) => file.type.startsWith('video/') || file.type.startsWith('image/'))
    if (validFiles.length !== files.length) {
      message.warning('聊天仅支持图片和视频上传')
    }

    for (const file of validFiles) {
      await uploadMedia(file)
    }

    input.value = ''
  }

  async function handleRemoveFile(fileName: string) {
    await removeFile(fileName)
    if (selectedFileName.value === '未选择文件' && mediaAttachments.value.length === 0 && sidebarRef.value?.fileInput) {
      sidebarRef.value.fileInput.value = ''
    }
  }

  function handleRemoveMedia(mediaId: string) {
    removeMedia(mediaId)
  }

  function getPendingMediaAttachments(): ChatMediaAttachment[] {
    return mediaAttachments.value.map((item) => ({
      type: item.type,
      name: item.name,
      filePath: item.filePath,
      previewUrl: item.previewUrl
    }))
  }

  async function startChat() {
    const currentQuery = query.value.trim()
    if (!currentQuery) return

    const conversation = currentConversation.value ?? conversations.value[0]
    if (!conversation) return

    const mediaList = getPendingMediaAttachments()
    const currentMediaPath = mediaList[0]?.filePath

    const userMessage: ChatMessage = {
      id: createId('message'),
      role: 'user',
      content: currentQuery,
      createdAt: Date.now(),
      mediaList: mediaList.length > 0 ? mediaList : undefined
    }

    const assistantMessage: ChatMessage = {
      id: createId('message'),
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      mediaList: mediaList.length > 0 ? mediaList : undefined
    }

    updateConversation(conversation.id, (target) => {
      if (target.messages.length === 0 || target.title === UNTITLED_CONVERSATION) {
        target.title = buildConversationTitle(currentQuery)
      }
      target.messages.push(userMessage, assistantMessage)
      target.updatedAt = Date.now()
    })

    streamingConversationId.value = conversation.id
    streamingAssistantMessageId.value = assistantMessage.id

    query.value = ''
    clearVideo()
    await startChatLogic(currentQuery, ttsSessionId, resetTtsPlayer, ensureTtsConnection, currentMediaPath)
  }

  function clearAllFiles() {
    clearSelectedFile()
    if (sidebarRef.value?.fileInput) {
      sidebarRef.value.fileInput.value = ''
    }
    clearVideo()
  }

  watchEffect(() => {
    if (audioRef.value) {
      audioRef.value.muted = isMuted.value
    }
  })

  watch(() => selectedFileName.value, (newVal) => {
    if (newVal === '未选择文件') {
      chatStatus.value = '状态：待机'
      chatOutput.value = ''
      isUploading.value = false
    }
  })

  watch(
    chatOutput,
    (value) => {
      if (!streamingConversationId.value || !streamingAssistantMessageId.value) return

      updateConversation(streamingConversationId.value, (conversation) => {
        const assistantMessage = conversation.messages.find(
          (message) => message.id === streamingAssistantMessageId.value,
        )

        if (!assistantMessage) return

        assistantMessage.content = value
        conversation.updatedAt = Date.now()
      })
    },
    { flush: 'sync' },
  )

  watch(isStreaming, (streaming) => {
    if (streaming) return
    streamingConversationId.value = ''
    streamingAssistantMessageId.value = ''
  })

  watch(
    conversations,
    () => {
      if (!currentConversation.value && conversations.value[0]) {
        currentConversationId.value = conversations.value[0].id
      }
      persistConversations()
    },
    { deep: true },
  )

  onMounted(() => {
    initAudioListeners()
  })

  onBeforeUnmount(() => {
    closeEventSource()
    closeRagProgressEventSource()
    closeTtsWs()
    resetTtsPlayer()
  })

  return {
    query,
    exportContentRef,
    sidebarRef,
    isExporting,
    exportToPdf: triggerPdfExport,
    isReading,
    isMuted,
    audioRef,
    selectedFileName,
    selectedRagFile,
    uploadedFiles,
    isUploading,
    status,
    output,
    conversations: conversationList,
    currentConversationId,
    currentConversationTitle,
    conversationMessages,
    streamingAssistantMessageId,
    isCurrentConversationStreaming,
    knowledgeBaseStatus,
    modelName,
    isChatStarted,
    isConnecting,
    isStreaming,
    currentAction: displayCurrentAction,
    hasReceivedChunk,
    hasContent,
    showPdfButton,
    isLoading,
    canSend,
    handleFileChange,
    handleChatFileChange,
    handleRemoveFile,
    handleRemoveMedia,
    createNewConversation,
    switchConversation,
    renameConversation,
    deleteConversation,
    clearCurrentConversation,
    startChat,
    clearFile: clearAllFiles,
    uploadSelectedFile,
    removeFile,
    mediaAttachments,
    selectedVideoName,
    selectedImageName,
    videoPath,
    previewUrl,
    mediaType,
    isUploadingVideo,
    videoUploadProgress
  }
}
