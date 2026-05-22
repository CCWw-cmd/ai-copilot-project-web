import { ref, onBeforeUnmount, onMounted } from 'vue'
import { API_BASE_URL, http } from './http'
import { formatError, createUploadTaskId, isFreeTierExhausted, FREE_TIER_EXHAUSTED_MSG } from './utils'
import { createDiscreteApi, darkTheme } from 'naive-ui'

const { message: nMessage } = createDiscreteApi(['message'], {
  configProviderProps: {
    theme: darkTheme
  }
})

export function useRag() {
  const selectedFile = ref<File | null>(null)
  const selectedFileName = ref('未选择文件')
  const uploadedFiles = ref<{ name: string; fullName?: string; status: 'uploading' | 'success' | 'error'; createdAt?: number }[]>([])
  const isUploading = ref(false)
  const status = ref('状态：待机')
  const output = ref('')

  let ragProgressEs: EventSource | null = null
  let currentUploadTaskId: string | null = null

  async function fetchUploadedFiles() {
    try {
      const response = await http.get('/rag/files')
      if (Array.isArray(response.data)) {
        uploadedFiles.value = response.data.map((f: any) => ({
          name: f.name,
          fullName: f.fullName,
          status: 'success',
          createdAt: f.createdAt
        }))
      }
    } catch (err) {
      console.error('获取知识库文件列表失败:', err)
    }
  }

  onMounted(() => {
    fetchUploadedFiles()
  })

  function closeRagProgressEventSource() {
    if (ragProgressEs) {
      ragProgressEs.close()
      ragProgressEs = null
    }
  }

  function renderUploadProgress(progress: any) {
    const percent = typeof progress.progress === 'number' ? ` ${progress.progress}%` : ''
    let msg = progress.message ?? '后台处理中'

    if (msg === '等待上传开始') return

    if (progress.fileName) {
      const fileObj = uploadedFiles.value.find(f => f.name === progress.fileName)
      if (fileObj) {
        if (progress.status === 'completed' || msg.includes('Verified')) {
          fileObj.status = 'success'
        } else if (progress.status === 'failed' || progress.status === 'error') {
          fileObj.status = 'error'
        } else {
          fileObj.status = 'uploading'
        }
      }
    }

    if (msg === '上传完成' || progress.status === 'completed') {
      msg = '文件已上传'
    }

    status.value = `状态：${msg}${percent}`

    if (progress.status === 'completed' || progress.status === 'failed') {
      isUploading.value = false
      currentUploadTaskId = null
      closeRagProgressEventSource()

      if (progress.status === 'completed') {
        fetchUploadedFiles() // 刷新列表以获取最新的 fullName 和状态
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
        const progress = JSON.parse(event.data)
        renderUploadProgress(progress)
      } catch {
        let msg = event.data
        if (msg === '等待上传开始') return
        if (msg === '上传完成') {
          msg = '文件已上传'
          setTimeout(() => {
            status.value = '状态：待机'
            output.value = ''
            isUploading.value = false
          }, 1000)
        }
        status.value = `状态：${msg}`
      }
    }

    ragProgressEs.onerror = () => {
      if (ragProgressEs) {
        status.value = '状态：进度流连接异常'
      }
    }
  }

  function selectFile(file: File | undefined) {
    if (!file) {
      selectedFile.value = null
      selectedFileName.value = '未选择文件'
      return
    }

    selectedFile.value = file
    selectedFileName.value = file.name
  }

  function clearSelectedFile() {
    selectedFile.value = null
    selectedFileName.value = '未选择文件'
  }

  async function uploadSelectedFile(file?: File) {
    const targetFile = file ?? selectedFile.value

    if (!targetFile) {
      nMessage.warning('请选择要上传的文件')
      return
    }

    isUploading.value = true
    status.value = '状态：文件上传中...'
    currentUploadTaskId = createUploadTaskId()
    openUploadProgressStream(currentUploadTaskId)

    const existingFileIndex = uploadedFiles.value.findIndex(f => f.name === targetFile.name)
    if (existingFileIndex > -1) {
      uploadedFiles.value[existingFileIndex].status = 'uploading'
    } else {
      uploadedFiles.value.push({ name: targetFile.name, status: 'uploading' })
    }

    const formData = new FormData()
    formData.append('file', targetFile)
    formData.append('fileName', targetFile.name)
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
          const percent = Math.min(99, Math.round((event.loaded / event.total) * 100))
          status.value = `状态：文件上传中 ${percent}%`
        }

        xhr.onerror = () => reject(new Error('上传请求失败'))
        xhr.onload = () => {
          const contentType = xhr.getResponseHeader('content-type') || ''
          const rawText = xhr.responseText || ''
          if (xhr.status < 200 || xhr.status >= 300) {
            reject(new Error(rawText || `上传失败，状态码：${xhr.status}`))
            return
          }
          if (contentType.includes('application/json')) {
            try { resolve(JSON.parse(rawText)) } catch { reject(new Error('上传响应 JSON 解析失败')) }
            return
          }
          resolve(rawText)
        }
        xhr.send(formData)
      })

      clearSelectedFile()

      if (typeof result === 'string') {
        const displayMsg = result === '上传完成' ? '文件已上传' : result
        status.value = `状态：${displayMsg}`
        setTimeout(() => {
          if (status.value === `状态：${displayMsg}`) {
            status.value = '状态：待机'
          }
        }, 3000)
        isUploading.value = false
      } else {
        status.value = '状态：文件已上传，后台处理中...'
      }
    } catch (error) {
      if (isFreeTierExhausted(error)) {
        status.value = `状态：${FREE_TIER_EXHAUSTED_MSG}`
        output.value = FREE_TIER_EXHAUSTED_MSG
      } else {
        status.value = '状态：文件上传失败'
        output.value = `上传失败：${formatError(error)}`
      }
      const fileObj = uploadedFiles.value.find(f => f.name === targetFile.name)
      if (fileObj) fileObj.status = 'error'
      currentUploadTaskId = null
      closeRagProgressEventSource()
      isUploading.value = false
    }
  }

  async function removeFile(identifier: string) {
    const fileObj = uploadedFiles.value.find(f => (f.fullName || f.name) === identifier)
    if (fileObj?.fullName) {
      try {
        await http.delete(`/rag/files/${encodeURIComponent(fileObj.fullName)}`)
        nMessage.success('知识库文件已删除')
      } catch (err) {
        console.error('删除知识库文件失败:', err)
        nMessage.error('删除知识库文件失败')
      }
    }
    
    uploadedFiles.value = uploadedFiles.value.filter(f => (f.fullName || f.name) !== identifier)
    if (selectedFileName.value === identifier || (fileObj && selectedFileName.value === fileObj.name)) {
      clearSelectedFile()
    }
  }

  onBeforeUnmount(() => {
    closeRagProgressEventSource()
  })

  return {
    selectedFile,
    selectedFileName,
    uploadedFiles,
    isUploading,
    status,
    output,
    selectFile,
    clearSelectedFile,
    uploadSelectedFile,
    removeFile,
    closeRagProgressEventSource
  }
}
