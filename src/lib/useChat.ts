import { ref, onBeforeUnmount } from 'vue'
import { API_BASE_URL } from './http'
import { createDiscreteApi, darkTheme } from 'naive-ui'

const { message: nMessage } = createDiscreteApi(['message'], {
  configProviderProps: {
    theme: darkTheme
  }
})

export function useChat() {
  const isChatStarted = ref(false)
  const isConnecting = ref(false)
  const isStreaming = ref(false)
  const hasReceivedChunk = ref(false)
  const output = ref('')
  const status = ref('状态：待机')
  const currentAction = ref('')

  let es: EventSource | null = null

  function closeEventSource() {
    if (es) {
      es.close()
      es = null
    }
    isConnecting.value = false
    isStreaming.value = false
  }

  async function startChat(query: string, ttsSessionId: string | null, resetTts: () => void, ensureTts: () => Promise<void>) {
    const trimmedQuery = query.trim()

    if (!trimmedQuery || isStreaming.value) {
      if (!trimmedQuery) {
        nMessage.warning('请输入问题')
      }
      return
    }

    closeEventSource()
    resetTts()
    isChatStarted.value = true
    output.value = ''
    status.value = '状态：连接中...'
    currentAction.value = '准备连接...'
    isConnecting.value = true
    isStreaming.value = true
    hasReceivedChunk.value = false

    await ensureTts()

    const params = new URLSearchParams({
      query: trimmedQuery,
    })

    if (ttsSessionId) {
      params.set('ttsSessionId', ttsSessionId)
    }

    es = new EventSource(`${API_BASE_URL}/ai/chat/stream?${params.toString()}`)

    es.onopen = () => {
      status.value = '状态：已连接，AI 思考中...'
      currentAction.value = '正在思考...'
    }

    es.onmessage = (event) => {
      const data = event.data
      
      // 处理状态更新消息
      if (data.startsWith('[STATUS]:')) {
        currentAction.value = data.replace('[STATUS]:', '')
        return
      }

      if (!hasReceivedChunk.value) {
        hasReceivedChunk.value = true
        isConnecting.value = false
        status.value = '状态：AI 回复中...'
      }
      output.value += data
    }

    es.onerror = () => {
      status.value = hasReceivedChunk.value
        ? '状态：响应结束'
        : '状态：连接结束或发生错误'
      closeEventSource()
    }
  }

  onBeforeUnmount(() => {
    closeEventSource()
  })

  return {
    isChatStarted,
    isConnecting,
    isStreaming,
    hasReceivedChunk,
    output,
    status,
    currentAction,
    startChat,
    closeEventSource
  }
}
