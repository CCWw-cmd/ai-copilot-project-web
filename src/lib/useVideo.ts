import { ref } from 'vue'
import { API_BASE_URL } from './http'
import { createDiscreteApi, darkTheme } from 'naive-ui'

const { message: nMessage } = createDiscreteApi(['message'], {
  configProviderProps: {
    theme: darkTheme
  }
})

export function useVideo() {
  const selectedVideoName = ref('未选择视频')
  const videoPath = ref('')
  const previewUrl = ref('')
  const isUploading = ref(false)
  const uploadProgress = ref(0)

  async function uploadVideo(file: File) {
    if (!file) return
    
    isUploading.value = true
    uploadProgress.value = 0
    selectedVideoName.value = file.name

    const formData = new FormData()
    formData.append('file', file)

    try {
      const xhr = new XMLHttpRequest()
      
      const result = await new Promise((resolve, reject) => {
        xhr.open('POST', `${API_BASE_URL}/video/upload`)
        
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            uploadProgress.value = Math.round((event.loaded / event.total) * 100)
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error(`上传失败: ${xhr.status}`))
          }
        }

        xhr.onerror = () => reject(new Error('网络错误'))
        xhr.send(formData)
      })

      const data = result as any
      videoPath.value = data.filePath
      previewUrl.value = data.previewUrl
      nMessage.success('视频上传成功')
    } catch (error) {
      console.error('Video upload error:', error)
      nMessage.error('视频上传失败')
      selectedVideoName.value = '未选择视频'
    } finally {
      isUploading.value = false
    }
  }

  function clearVideo() {
    selectedVideoName.value = '未选择视频'
    videoPath.value = ''
    previewUrl.value = ''
    uploadProgress.value = 0
  }

  return {
    selectedVideoName,
    videoPath,
    previewUrl,
    isUploading,
    uploadProgress,
    uploadVideo,
    clearVideo
  }
}
