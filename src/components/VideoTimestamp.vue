<template>
  <div class="inline-flex flex-col items-start my-1">
    <n-button 
      text 
      type="primary" 
      class="!text-nebula-400 hover:!text-nebula-300 transition-colors cursor-pointer font-mono"
      @click="handleClick"
    >
      <template #icon>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      </template>
      {{ timestamp }}
    </n-button>
    
    <div v-if="screenshotUrl" class="mt-2 rounded-lg overflow-hidden border border-white/10 shadow-lg max-w-[320px] group relative">
      <img 
        :src="screenshotUrl" 
        class="w-full h-auto cursor-pointer hover:scale-105 transition-transform duration-300" 
        @click="handleClick"
      />
      <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
        <div class="bg-white/20 backdrop-blur-md rounded-full p-2">
           <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

const props = defineProps<{
  timestamp: string // 格式: "MM:SS" 或 "HH:MM:SS"
  videoUrl: string
}>()

const emit = defineEmits(['seek'])

const screenshotUrl = ref<string | null>(null)

function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number)
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]
  }
  return 0
}

async function captureFrame() {
  if (!props.videoUrl) return

  const video = document.createElement('video')
  video.src = props.videoUrl
  video.crossOrigin = 'anonymous'
  video.currentTime = parseTimestamp(props.timestamp)
  video.muted = true
  
  // 必须等待视频加载到指定位置
  video.onseeked = () => {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      screenshotUrl.value = canvas.toDataURL('image/jpeg', 0.8)
    }
    // 清理
    video.remove()
  }

  video.onerror = () => {
    console.error('Failed to load video for screenshot')
    video.remove()
  }

  // 开始加载
  video.load()
}

function handleClick() {
  emit('seek', parseTimestamp(props.timestamp))
}

onMounted(() => {
  captureFrame()
})

// 如果视频 URL 改变（虽然在这个场景下不太可能），重新截图
watch(() => props.videoUrl, () => {
  captureFrame()
})
</script>

<style scoped>
.video-timestamp-container {
  display: inline-flex;
  flex-direction: column;
}
</style>
