import { ref, onBeforeUnmount } from 'vue'
import { API_BASE_URL } from './http'
import { formatError, createUploadTaskId } from './utils'
import { createDiscreteApi, darkTheme } from 'naive-ui'

const { message: nMessage } = createDiscreteApi(['message'], {
  configProviderProps: {
    theme: darkTheme
  }
})

export function useRag() {
  const selectedFileName = ref('未选择文件')
  const uploadedFiles = ref<{ name: string; status: 'uploading' | 'success' | 'error' }[]>([])
  const isUploading = ref(false)
  const status = ref('状态：待机')
  const output = ref('')

  let ragProgressEs: EventSource | null = null
  let currentUploadTaskId: string | null = null

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

  async function uploadSelectedFile(file: File | undefined) {
    if (!file) {
      nMessage.warning('请选择要上传的文件')
      return
    }

    isUploading.value = true
    status.value = '状态：文件上传中...'
    currentUploadTaskId = createUploadTaskId()
    openUploadProgressStream(currentUploadTaskId)

    const existingFileIndex = uploadedFiles.value.findIndex(f => f.name === file.name)
    if (existingFileIndex > -1) {
      uploadedFiles.value[existingFileIndex].status = 'uploading'
    } else {
      uploadedFiles.value.push({ name: file.name, status: 'uploading' })
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('fileName', selectedFileName.value)
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

      selectedFileName.value = '未选择文件'

      if (typeof result === 'string') {
        const displayMsg = result === '上传完成' ? '文件已上传' : result
        status.value = `状态：${displayMsg}`
        setTimeout(() => { status.value = '状态：待机' }, 1000)
        isUploading.value = false
      } else {
        status.value = '状态：文件已上传，后台处理中...'
        setTimeout(() => { status.value = '状态：待机' }, 1000)
      }
    } catch (error) {
      status.value = '状态：文件上传失败'
      output.value = `上传失败：${formatError(error)}`
      const fileObj = uploadedFiles.value.find(f => f.name === file.name)
      if (fileObj) fileObj.status = 'error'
      currentUploadTaskId = null
      closeRagProgressEventSource()
      isUploading.value = false
    }
  }

  function removeFile(fileName: string) {
    uploadedFiles.value = uploadedFiles.value.filter(f => f.name !== fileName)
    if (selectedFileName.value === fileName) {
      selectedFileName.value = '未选择文件'
    }
  }

  onBeforeUnmount(() => {
    closeRagProgressEventSource()
  })

  return {
    selectedFileName,
    uploadedFiles,
    isUploading,
    status,
    output,
    uploadSelectedFile,
    removeFile,
    closeRagProgressEventSource
  }
}
