<script setup lang="ts">
import { darkTheme, createDiscreteApi } from 'naive-ui'
import { ref, onMounted } from 'vue'
import ChatOutput from './components/ChatOutput.vue'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import ChatInputArea from './components/ChatInputArea.vue'
import WelcomeView from './components/WelcomeView.vue'
import { useAppLogic } from './lib/useAppLogic'
import { API_BASE_URL } from './lib/http'
import './styles/markdown.css'

const ChatbitLottieUrl = new URL('./assets/Chatbit.json', import.meta.url).href

const {
  query,
  exportContentRef,
  sidebarRef,
  isExporting,
  exportToPdf,
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
  showPdfButton,
  isLoading,
  canSend,
  handleFileChange,
  handleRemoveFile,
  startChat,
  clearFile,
  uploadSelectedFile,
  removeFile,
  selectedVideoName,
  videoPath,
  previewUrl,
  isUploadingVideo,
  videoUploadProgress
} = useAppLogic()

const isVideoPreviewOpen = ref(false)

function handleCitationClick() {
  // 引用点击逻辑在 ChatOutput 中处理
}

const { message } = createDiscreteApi(['message'], {
  configProviderProps: {
    theme: darkTheme
  }
})

function openVideoPreview() {
  if (previewUrl.value) {
    console.log('Opening video preview with URL:', `${API_BASE_URL}${previewUrl.value}`)
    isVideoPreviewOpen.value = true
  }
}

function handleVideoError(e: any) {
  const video = e.target as HTMLVideoElement
  console.error('Video loading error:', video.error)
  message.error(`视频加载失败: ${video.error?.message || '未知错误'}`)
}
</script>

<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <n-dialog-provider>
        <div class="relative h-screen flex flex-col bg-[#05010d] text-white antialiased overflow-hidden">
          <!-- Background elements -->
          <div class="pointer-events-none absolute inset-0 z-0">
            <div class="absolute left-1/2 top-[-9rem] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-nebula-500/25 blur-[120px]" />
            <div class="absolute bottom-[-6rem] left-[-4rem] h-[20rem] w-[20rem] rounded-full bg-fuchsia-500/12 blur-[100px]" />
            <div class="absolute right-[-5rem] top-[20%] h-[18rem] w-[18rem] rounded-full bg-violet-400/10 blur-[120px]" />
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />
            <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-10" />
          </div>

          <n-layout position="absolute" style="background: transparent" has-sider>
            <AppHeader :status="status" />

            <n-layout has-sider position="absolute" style="top: 64px; background: transparent">
              <AppSidebar
                ref="sidebarRef"
                :uploaded-files="uploadedFiles"
                :selected-file-name="selectedFileName"
                :is-uploading="isUploading"
                @file-change="handleFileChange"
                @clear-selection="clearFile"
                @upload="uploadSelectedFile"
                @remove-file="handleRemoveFile"
              />

              <!-- Main Content -->
              <n-layout-content content-style="display: flex; flex-direction: column; height: 100%; background: transparent">
                <n-scrollbar class="flex-1">
                  <div class="py-6 px-6">
                    <div class="max-w-4xl mx-auto flex flex-col items-center min-h-full">
                      <WelcomeView v-if="!hasContent && !isLoading" :lottie-url="ChatbitLottieUrl" />

                      <div v-else class="w-full relative">
                        <div v-if="showPdfButton" class="absolute right-0 top-0 z-10">
                          <n-button
                            secondary
                            round
                            size="small"
                            type="primary"
                            :loading="isExporting"
                            @click="exportToPdf(exportContentRef)"
                            class="!bg-nebula-500/10 !border-nebula-500/30"
                          >
                            <template #icon>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            </template>
                            导出 PDF
                          </n-button>
                        </div>

                        <div ref="exportContentRef" class="markdown-body text-base leading-7 text-white/84 pt-10">
                           <n-space vertical size="large">
                            <div v-if="isLoading && !hasContent" class="py-6">
                              <n-space vertical size="medium">
                                <n-skeleton text :repeat="2" />
                                <n-skeleton text style="width: 60%" />
                              </n-space>
                            </div>

                            <ChatOutput :output="output" @citation-click="handleCitationClick" />

                            <div v-if="isStreaming" class="flex items-center gap-3 text-xs text-nebula-300/60 no-export">
                              <span class="relative flex h-2 w-2">
                                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-nebula-400 opacity-75"></span>
                                <span class="relative inline-flex rounded-full h-2 w-2 bg-nebula-500"></span>
                              </span>
                              {{ currentAction || 'AI 正在输入...' }}
                            </div>
                          </n-space>
                        </div>
                      </div>
                    </div>
                  </div>
                </n-scrollbar>

                <ChatInputArea
                  v-model:query="query"
                  v-model:isMuted="isMuted"
                  :is-chat-started="isChatStarted"
                  :is-uploading="isUploading || isUploadingVideo"
                  :is-reading="isReading"
                  :is-streaming="isStreaming"
                  :can-send="canSend"
                  :is-loading="isLoading"
                  :has-received-chunk="hasReceivedChunk"
                  :selected-file-name="selectedFileName"
                  :selected-video-name="selectedVideoName"
                  @send="startChat"
                  @clear-file="clearFile"
                  @preview-video="openVideoPreview"
                />
              </n-layout-content>
            </n-layout>
          </n-layout>

          <audio ref="audioRef" autoplay preload="none" class="hidden" />

          <!-- Video Preview Modal -->
          <n-modal
            v-model:show="isVideoPreviewOpen"
            preset="card"
            style="width: 80vw; max-width: 1000px"
            title="视频预览"
            class="!bg-[#1a1625] !border-white/10"
          >
            <div class="aspect-video bg-black rounded-lg overflow-hidden flex items-center justify-center">
              <video 
                  v-if="isVideoPreviewOpen"
                  :key="previewUrl"
                  controls 
                  autoplay
                  muted
                  playsinline
                  preload="auto"
                  crossorigin="anonymous"
                  class="w-full h-full object-contain"
                  :src="`${API_BASE_URL}${previewUrl}`"
                  @error="handleVideoError"
                >
                您的浏览器不支持视频预览。
              </video>
            </div>
          </n-modal>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
/* App specific layout adjustments can go here if needed */
:deep(.n-layout-scroll-container) {
  display: flex;
  flex-direction: column;
}
</style>
