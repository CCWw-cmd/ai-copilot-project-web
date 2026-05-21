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

  async function startChat(
    query: string, 
    ttsSessionId: string | null, 
    resetTts: () => void, 
    ensureTts: () => Promise<void>,
    videoPath?: string
  ) {
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

    if (videoPath) {
      params.set('videoPath', videoPath)
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

    // 处理特殊的错误事件（如模型用量耗尽）
    es.addEventListener('error', (event: any) => {
      let errorMsg = '连接结束或发生错误'
      const data = event.data

      if (data && typeof data === 'string') {
        if (data.includes('free tier') && data.includes('exhausted')) {
          errorMsg = '抱歉，AI 模型免费额度已用尽，请稍后再试或切换模型。'
          nMessage.error('模型用量已耗尽')
        } else {
          errorMsg = `服务异常: ${data}`
        }
      }

      status.value = hasReceivedChunk.value ? '状态：响应结束' : `状态：${errorMsg}`
      
      // 如果还没收到过内容就报错了，直接显示在输出框
      if (!hasReceivedChunk.value && data) {
        output.value = `【系统提示】${errorMsg}`
      }
      
      closeEventSource()
    })

    es.onerror = (e) => {
      // 如果已经通过 addEventListener('error') 处理过了，这里就不重复处理
      if (es === null) return 

      status.value = hasReceivedChunk.value
        ? '状态：响应结束'
        : '状态：连接丢失，请检查网络'
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
