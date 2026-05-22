import { computed, ref } from 'vue'
import { API_BASE_URL } from './http'
import { isFreeTierExhausted, FREE_TIER_EXHAUSTED_MSG } from './utils'
import { createDiscreteApi, darkTheme } from 'naive-ui'

const { message: nMessage } = createDiscreteApi(['message'], {
  configProviderProps: {
    theme: darkTheme
  }
})

export function useVideo() {
  const mediaAttachments = ref<Array<{
    id: string
    type: 'image' | 'video'
    name: string
    filePath: string
    previewUrl: string
  }>>([])
  const isUploading = ref(false)
  const uploadProgress = ref(0)

  const selectedVideoName = computed(() => {
    const latestVideo = [...mediaAttachments.value].reverse().find((item) => item.type === 'video')
    return latestVideo?.name ?? '未选择视频'
  })

  const selectedImageName = computed(() => {
    const latestImage = [...mediaAttachments.value].reverse().find((item) => item.type === 'image')
    return latestImage?.name ?? '未选择图片'
  })

  const mediaPath = computed(() => mediaAttachments.value[0]?.filePath ?? '')
  const previewUrl = computed(() => mediaAttachments.value[0]?.previewUrl ?? '')
  const mediaType = computed<'image' | 'video' | null>(() => mediaAttachments.value[0]?.type ?? null)

  async function uploadMedia(file: File) {
    if (!file) return
    
    isUploading.value = true
    uploadProgress.value = 0
    
    const isImage = file.type.startsWith('image/')
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
      mediaAttachments.value.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: isImage ? 'image' : 'video',
        name: file.name,
        filePath: data.filePath,
        previewUrl: data.previewUrl
      })
      nMessage.success(isImage ? '图片上传成功' : '视频上传成功')
    } catch (error) {
      console.error('Media upload error:', error)
      if (isFreeTierExhausted(error)) {
        nMessage.error(FREE_TIER_EXHAUSTED_MSG)
      } else {
        nMessage.error(isImage ? '图片上传失败' : '视频上传失败')
      }
    } finally {
      isUploading.value = false
    }
  }

  function removeMedia(mediaId: string) {
    mediaAttachments.value = mediaAttachments.value.filter((item) => item.id !== mediaId)
  }

  function clearMedia() {
    mediaAttachments.value = []
    uploadProgress.value = 0
  }

  return {
    mediaAttachments,
    selectedVideoName,
    selectedImageName,
    mediaPath,
    previewUrl,
    mediaType,
    isUploading,
    uploadProgress,
    uploadMedia,
    removeMedia,
    clearMedia
  }
}
