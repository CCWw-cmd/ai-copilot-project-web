import { ref } from 'vue'
import { API_BASE_URL } from './http'
import { isFreeTierExhausted, FREE_TIER_EXHAUSTED_MSG } from './utils'
import { createDiscreteApi, darkTheme } from 'naive-ui'

const { message: nMessage } = createDiscreteApi(['message'], {
  configProviderProps: {
    theme: darkTheme
  }
})

export function useVideo() {
  const selectedVideoName = ref('未选择视频')
  const selectedImageName = ref('未选择图片')
  const mediaPath = ref('')
  const previewUrl = ref('')
  const mediaType = ref<'image' | 'video' | null>(null)
  const isUploading = ref(false)
  const uploadProgress = ref(0)

  async function uploadMedia(file: File) {
    if (!file) return
    
    isUploading.value = true
    uploadProgress.value = 0
    
    const isImage = file.type.startsWith('image/')
    if (isImage) {
      selectedImageName.value = file.name
      selectedVideoName.value = '未选择视频'
      mediaType.value = 'image'
    } else {
      selectedVideoName.value = file.name
      selectedImageName.value = '未选择图片'
      mediaType.value = 'video'
    }

    const formData = new FormData()
    formData.append('file', file)

    try {
      const xhr = new XMLHttpRequest()
      
      const result = await new Promise((resolve, reject) => {
        xhr.open('POST', `${API_BASE_URL}/media/upload`)
        
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
      mediaPath.value = data.filePath
      previewUrl.value = data.previewUrl
      nMessage.success(isImage ? '图片上传成功' : '视频上传成功')
    } catch (error) {
      console.error('Media upload error:', error)
      if (isFreeTierExhausted(error)) {
        nMessage.error(FREE_TIER_EXHAUSTED_MSG)
      } else {
        nMessage.error(isImage ? '图片上传失败' : '视频上传失败')
      }
      selectedVideoName.value = '未选择视频'
      selectedImageName.value = '未选择图片'
      mediaType.value = null
    } finally {
      isUploading.value = false
    }
  }

  function clearMedia() {
    selectedVideoName.value = '未选择视频'
    selectedImageName.value = '未选择图片'
    mediaPath.value = ''
    previewUrl.value = ''
    uploadProgress.value = 0
    mediaType.value = null
  }

  return {
    selectedVideoName,
    selectedImageName,
    mediaPath,
    previewUrl,
    mediaType,
    isUploading,
    uploadProgress,
    uploadMedia,
    clearMedia
  }
}
