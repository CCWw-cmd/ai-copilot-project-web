<script setup lang="ts">
import { darkTheme, createDiscreteApi } from 'naive-ui'
import { computed, nextTick, ref, watch } from 'vue'
import ChatOutput from './components/ChatOutput.vue'
import AppHeader from './components/AppHeader.vue'
import AppSidebar from './components/AppSidebar.vue'
import ChatInputArea from './components/ChatInputArea.vue'
import WelcomeView from './components/WelcomeView.vue'
import { useAppLogic } from './lib/useAppLogic'
import { API_BASE_URL } from './lib/http'
import './styles/markdown.css'

const ChatbitLottieUrl = new URL('./assets/Chatbit.json', import.meta.url).href

type MediaPreviewPayload = {
  type: 'image' | 'video'
  src: string
  name?: string
}

type MessageMediaItem = {
  type: 'image' | 'video'
  name: string
  previewUrl: string
}

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
  conversations,
  currentConversationId,
  currentConversationTitle,
  conversationMessages,
  streamingAssistantMessageId,
  isCurrentConversationStreaming,
  knowledgeBaseStatus,
  modelName,
  isChatStarted,
  currentAction,
  hasReceivedChunk,
  showPdfButton,
  isLoading,
  canSend,
  handleFileChange,
  handleChatFileChange,
  handleRemoveFile,
  handleRemoveMedia,
  createNewConversation,
  switchConversation,
  renameConversation,
  deleteConversation,
  clearCurrentConversation,
  startChat,
  clearFile,
  uploadSelectedFile,
  mediaAttachments,
  isUploadingVideo
} = useAppLogic()

void sidebarRef
void audioRef

const isVideoPreviewOpen = ref(false)
const messagesEndRef = ref<HTMLElement | null>(null)
const activeMediaPreview = ref<MediaPreviewPayload | null>(null)

const { message } = createDiscreteApi(['message'], {
  configProviderProps: {
    theme: darkTheme
  }
})

const composerMediaList = computed(() =>
  mediaAttachments.value.map((item) => ({
    ...item,
    previewSrc: `${API_BASE_URL}${item.previewUrl}`
  })),
)

function resolveMediaSrc(mediaPreviewUrl?: string) {
  if (!mediaPreviewUrl) return undefined
  return `${API_BASE_URL}${mediaPreviewUrl}`
}

function scrollToBottom() {
  messagesEndRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

watch(
  conversationMessages,
  async () => {
    await nextTick()
    scrollToBottom()
  },
  { deep: true, immediate: true },
)

watch(
  () => currentConversationId.value,
  async () => {
    await nextTick()
    scrollToBottom()
  },
)

watch(
  () => output.value,
  async () => {
    await nextTick()
    scrollToBottom()
  },
)

function openMediaPreview(payload: any) {
  activeMediaPreview.value = {
    type: payload.type,
    src: payload.src || payload.previewSrc,
    name: payload.name
  }
  isVideoPreviewOpen.value = true
}

function handleVideoSeek(messageItem: { mediaList?: MessageMediaItem[] }, time: number) {
  const videoMedia = getPrimaryVideoMedia(messageItem)
  const src = videoMedia ? resolveMediaSrc(videoMedia.previewUrl) : undefined
  if (!src) return

  openMediaPreview({
    type: 'video',
    src,
    name: videoMedia?.name
  })

  setTimeout(() => {
    const video = document.querySelector('.video-preview-modal video') as HTMLVideoElement | null
    if (video) {
      video.currentTime = time
      video.play().catch(() => undefined)
    }
  }, 300)
}

function handleCitationClick() {
  // 引用点击逻辑在 ChatOutput 中处理
}

function handleVideoError(event: Event) {
  const video = event.target as HTMLVideoElement
  message.error(`视频加载失败: ${video.error?.message || '未知错误'}`)
}

function formatMessageTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
}

function isAssistantMessageStreaming(messageId: string) {
  return isCurrentConversationStreaming.value && streamingAssistantMessageId.value === messageId
}

function getPrimaryVideoMedia(messageItem: { mediaList?: MessageMediaItem[] }) {
  return messageItem.mediaList?.find((item) => item.type === 'video')
}

function getMessageMediaSrc(mediaItem?: MessageMediaItem) {
  return resolveMediaSrc(mediaItem?.previewUrl)
}

function previewMessageMedia(mediaItem?: MessageMediaItem) {
  const src = getMessageMediaSrc(mediaItem)
  if (!src || !mediaItem) return
  openMediaPreview({
    type: mediaItem.type,
    src,
    name: mediaItem.name
  })
}

function handleRenameConversation(conversationId: string) {
  const conversation = conversations.value.find((item) => item.id === conversationId)
  const currentTitle = conversation?.title || '新对话'
  const nextTitle = window.prompt('请输入新的会话标题', currentTitle)

  if (nextTitle === null) return
  renameConversation(conversationId, nextTitle)
}

function handleRenameCurrentConversation() {
  handleRenameConversation(currentConversationId.value)
}

function handleDeleteConversation(conversationId: string) {
  const conversation = conversations.value.find((item) => item.id === conversationId)
  if (!conversation) return

  const confirmed = window.confirm(`确认删除会话“${conversation.title}”吗？`)
  if (!confirmed) return
  deleteConversation(conversationId)
}
</script>

<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <n-dialog-provider>
        <div class="relative flex h-screen overflow-hidden bg-[#05010d] text-white antialiased">
          <div class="pointer-events-none absolute inset-0 z-0">
            <div class="absolute left-1/2 top-[-9rem] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-nebula-500/25 blur-[120px]" />
            <div class="absolute bottom-[-6rem] left-[-4rem] h-[20rem] w-[20rem] rounded-full bg-fuchsia-500/12 blur-[100px]" />
            <div class="absolute right-[-5rem] top-[20%] h-[18rem] w-[18rem] rounded-full bg-violet-400/10 blur-[120px]" />
            <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_35%)]" />
            <div class="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-10" />
          </div>

          <n-layout has-sider position="absolute">
            <AppSidebar
              ref="sidebarRef"
              :conversations="conversations"
              :current-conversation-id="currentConversationId"
              :uploaded-files="uploadedFiles"
              :selected-file-name="selectedFileName"
              :is-uploading="isUploading"
              @create-conversation="createNewConversation"
              @select-conversation="switchConversation"
              @rename-conversation="handleRenameConversation"
              @delete-conversation="handleDeleteConversation"
              @file-change="handleFileChange"
              @clear-selection="clearFile"
              @upload="uploadSelectedFile"
              @remove-file="handleRemoveFile"
            />

            <n-layout-content content-style="display: flex; flex-direction: column; height: 100%; background: transparent">
              <div class="flex h-full min-h-0 flex-col gap-2 p-1 pl-0">
                <AppHeader
                  :conversation-title="currentConversationTitle"
                  :ai-status="status"
                  :model-name="modelName"
                  :knowledge-base-status="knowledgeBaseStatus"
                  :can-export="showPdfButton"
                  :is-exporting="isExporting"
                  @clear-conversation="clearCurrentConversation"
                  @export="exportToPdf(exportContentRef)"
                  @new-conversation="createNewConversation"
                  @rename-current="handleRenameCurrentConversation"
                />

                <div class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[5px] border border-white/8 bg-white/4 backdrop-blur-2xl shadow-[0_20px_50px_rgba(5,1,13,0.14)]">
                  <n-scrollbar class="flex-1 box-border pb-100px">
                    <div ref="exportContentRef" class="mx-auto flex min-h-full w-full max-w-5xl flex-col px-6 py-6">
                      <WelcomeView v-if="conversationMessages.length === 0" :lottie-url="ChatbitLottieUrl" />

                      <div v-else class="space-y-10">
                        <div
                          v-for="messageItem in conversationMessages"
                          :key="messageItem.id"
                          class="flex w-full"
                          :class="messageItem.role === 'user' ? 'justify-end' : 'justify-start'"
                        >
                          <div
                            class="flex w-full gap-4"
                            :class="messageItem.role === 'user' ? 'max-w-3xl flex-row-reverse' : 'max-w-none'"
                          >
                            <div
                              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold"
                              :class="messageItem.role === 'user'
                                ? 'bg-white/10 text-white/80'
                                : 'bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.35)]'"
                            >
                              {{ messageItem.role === 'user' ? '你' : 'AI' }}
                            </div>

                            <div
                              class="min-w-0 flex-1 rounded-[28px] border px-5 py-4"
                              :class="messageItem.role === 'user'
                                ? 'border-violet-300/18 bg-gradient-to-br from-violet-500/16 to-fuchsia-500/12'
                                : 'border-white/8 bg-black/12'"
                            >
                              <div class="mb-3 flex items-center justify-between gap-3 text-xs">
                                <span class="font-medium text-white/70">
                                  {{ messageItem.role === 'user' ? '你' : 'AI 助手' }}
                                </span>
                                <span class="text-white/35">{{ formatMessageTime(messageItem.createdAt) }}</span>
                              </div>

                              <template v-if="messageItem.role === 'user'">
                                <div class="whitespace-pre-wrap break-words text-[15px] leading-7 text-white/92">
                                  {{ messageItem.content }}
                                </div>

                                <div
                                  v-if="messageItem.mediaList?.length"
                                  class="mt-4 flex flex-wrap gap-3"
                                >
                                  <div
                                    v-for="(mediaItem, mediaIndex) in messageItem.mediaList"
                                    :key="`${messageItem.id}_${mediaIndex}_${mediaItem.name}`"
                                    class="w-[140px] h-[140px] overflow-hidden rounded-10px border border-white/10 bg-black/20"
                                  >
                                    <n-image
                                      v-if="mediaItem.type === 'image'"
                                      width="140"
                                      height="140"
                                      object-fit="cover"
                                      :src="getMessageMediaSrc(mediaItem)"
                                      :preview-src="getMessageMediaSrc(mediaItem)"
                                      :img-props="{ alt: mediaItem.name, class: 'h-[140px] w-[140px] bg-black object-cover cursor-zoom-in' }"
                                    />
                                    <video
                                      v-else
                                      controls
                                      preload="metadata"
                                      playsinline
                                      disablePictureInPicture
                                      disableRemotePlayback
                                      controlsList="nopictureinpicture"
                                      crossorigin="anonymous"
                                      class="h-[140px] w-[140px] cursor-zoom-in bg-black object-cover notranslate"
                                      :src="getMessageMediaSrc(mediaItem)"
                                      @click="previewMessageMedia(mediaItem)"
                                    >
                                      您的浏览器不支持视频播放。
                                    </video>
                                    <div class="border-t border-white/8 px-3 py-2 text-xs text-white/55">
                                      {{ mediaItem.name }}
                                    </div>
                                  </div>
                                </div>
                              </template>

                              <div v-else class="min-w-0">
                                <div v-if="messageItem.content.trim()" class="markdown-body text-base leading-7 text-white/88">
                                  <ChatOutput
                                    :output="messageItem.content"
                                    :video-url="getMessageMediaSrc(getPrimaryVideoMedia(messageItem))"
                                    @citation-click="handleCitationClick"
                                    @video-seek="handleVideoSeek(messageItem, $event)"
                                  />
                                </div>

                                <div v-else-if="isAssistantMessageStreaming(messageItem.id)" class="py-4">
                                  <n-space vertical size="medium">
                                    <div class="flex items-center gap-3 text-sm text-nebula-200/70">
                                      <span class="relative flex h-2.5 w-2.5">
                                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-nebula-400 opacity-75"></span>
                                        <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-nebula-500"></span>
                                      </span>
                                      {{ currentAction || 'AI 正在输入...' }}
                                    </div>
                                    <n-skeleton text :repeat="2" />
                                    <n-skeleton text style="width: 55%" />
                                  </n-space>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div ref="messagesEndRef" />
                    </div>
                  </n-scrollbar>

                  <ChatInputArea
                    v-model:query="query"
                    v-model:isMuted="isMuted"
                    :is-chat-started="isChatStarted"
                    :is-uploading="isUploading || isUploadingVideo"
                    :is-reading="isReading"
                    :is-streaming="isCurrentConversationStreaming"
                    :can-send="canSend"
                    :is-loading="isLoading"
                    :has-received-chunk="hasReceivedChunk"
                    :selected-file-name="selectedFileName"
                    :media-attachments="composerMediaList"
                    @send="startChat"
                    @clear-file="clearFile"
                    @preview-media="openMediaPreview"
                    @remove-media="handleRemoveMedia"
                    @file-change="handleChatFileChange"
                  />
                </div>
              </div>
            </n-layout-content>
          </n-layout>

          <audio ref="audioRef" autoplay preload="none" class="hidden" />

          <n-modal
            v-model:show="isVideoPreviewOpen"
            preset="card"
            style="width: 80vw; max-width: 1000px"
            :title="activeMediaPreview?.type === 'image' ? '图片预览' : '视频预览'"
            class="!border-white/10 !bg-[#1a1625] video-preview-modal"
          >
            <div class="aspect-video flex items-center justify-center overflow-hidden rounded-lg bg-black">
              <template v-if="isVideoPreviewOpen">
                <n-image
                  v-if="activeMediaPreview?.type === 'image'"
                  width="100%"
                  object-fit="contain"
                  :src="activeMediaPreview?.src"
                  :preview-src="activeMediaPreview?.src"
                  :img-props="{ class: 'h-full w-full object-contain' }"
                />
                <video
                  v-else
                  :key="activeMediaPreview?.src"
                  controls
                  autoplay
                  muted
                  playsinline
                  disablePictureInPicture
                  disableRemotePlayback
                  controlsList="nopictureinpicture"
                  preload="auto"
                  crossorigin="anonymous"
                  class="h-full w-full object-contain notranslate"
                  :src="activeMediaPreview?.src"
                  @error="handleVideoError"
                >
                  您的浏览器不支持视频预览。
                </video>
              </template>
            </div>
          </n-modal>
        </div>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<style scoped>
:deep(.n-layout-scroll-container) {
  display: flex;
  flex-direction: column;
}

:deep(.n-layout) {
  background: transparent;
}
</style>
