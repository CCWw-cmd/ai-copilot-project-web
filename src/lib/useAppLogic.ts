import { ref, computed, watchEffect, watch, onMounted, onBeforeUnmount } from 'vue'
import { createDiscreteApi, darkTheme } from 'naive-ui'
import { usePdfExport } from './usePdfExport'
import { useTts } from './useTts'
import { useRag } from './useRag'
import { useChat } from './useChat'

export function useAppLogic() {
  const { message } = createDiscreteApi(['message'], {
    configProviderProps: computed(() => ({
      theme: darkTheme
    }))
  })

  const query = ref('')
  const exportContentRef = ref<HTMLElement | null>(null)
  const sidebarRef = ref<any>(null)

  // 使用组合式函数提取逻辑
  const { isExporting, exportToPdf } = usePdfExport()

  const pageTitle = computed(() => {
    if (!output.value) return ''
    
    // 尝试提取第一个标题 (# 标题) 或 加粗标题 (**标题**)
    const lines = output.value.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      
      // 移除可能存在的 emoji (简单处理)
      const cleanLine = trimmed.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim()
      
      // 匹配 # 标题
      const hMatch = cleanLine.match(/^#+\s+(.+)$/)
      if (hMatch) return hMatch[1].trim()
      
      // 匹配 **标题** (可能包含在行内)
      const bMatch = cleanLine.match(/\*\*(.+?)\*\*/)
      if (bMatch) return bMatch[1].trim()
      
      // 如果没有 Markdown 标记，取第一行非空文本
      return cleanLine || trimmed
    }
    return ''
  })

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
    selectedFileName, 
    uploadedFiles, 
    isUploading, 
    status: ragStatus, 
    output: ragOutput, 
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
    closeEventSource 
  } = useChat()

  // 综合状态管理
  const status = computed(() => {
    if (isUploading.value) return ragStatus.value
    return chatStatus.value
  })

  const output = computed({
    get: () => isUploading.value ? ragOutput.value : chatOutput.value,
    set: (val) => {
      // 主要是为了支持外部直接设置 output 的情况（如报错显示）
      if (isUploading.value) ragOutput.value = val
      else chatOutput.value = val
    }
  })

  const hasContent = computed(() => output.value.trim().length > 0)
  const isLoading = computed(
    () => isConnecting.value || (isStreaming.value && !hasReceivedChunk.value),
  )
  const canSend = computed(
    () => !isUploading.value && !isStreaming.value && query.value.trim().length > 0,
  )

  function handleFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    selectedFileName.value = file?.name ?? '未选择文件'
  }

  function handleRemoveFile(fileName: string) {
    removeFile(fileName)
    if (selectedFileName.value === '未选择文件' && sidebarRef.value?.fileInput) {
      sidebarRef.value.fileInput.value = ''
    }
  }

  async function handleUpload() {
    const file = sidebarRef.value?.fileInput?.files?.[0]
    await uploadSelectedFile(file)
    if (selectedFileName.value === '未选择文件' && sidebarRef.value?.fileInput) {
      sidebarRef.value.fileInput.value = ''
    }
  }

  async function startChat() {
    const currentQuery = query.value.trim()
    if (!currentQuery) return
    
    await startChatLogic(currentQuery, ttsSessionId, resetTtsPlayer, ensureTtsConnection)
    query.value = '' // 发送后清空输入框
  }

  function clearFile() {
    selectedFileName.value = '未选择文件'
    if (sidebarRef.value?.fileInput) {
      sidebarRef.value.fileInput.value = ''
    }
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
    uploadedFiles,
    isUploading,
    status,
    output,
    isChatStarted,
    isConnecting,
    isStreaming,
    currentAction,
    hasReceivedChunk,
    hasContent,
    isLoading,
    canSend,
    handleFileChange,
    handleRemoveFile,
    handleUpload,
    startChat,
    clearFile,
    uploadSelectedFile,
    removeFile
  }
}
