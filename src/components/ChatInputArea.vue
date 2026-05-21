<template>
  <div class="absolute bottom-10px left-4 right-4 px-4 pt-3 md:px-6">
    <div class="mx-auto max-w-5xl">
      <div v-if="isChatStarted || isUploading || isReading" class="mb-3 flex min-h-8 items-center justify-between">
        <div v-if="isReading" class="flex items-center gap-3">
          <n-text depth="3" class="flex items-center gap-2 text-[13px] font-medium text-nebula-400">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-nebula-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-nebula-500"></span>
            </span>
            AI 正在朗读...
          </n-text>
          <n-button
            size="tiny"
            secondary
            :type="isMuted ? 'primary' : 'default'"
            class="!rounded-lg"
            @click="$emit('update:isMuted', !isMuted)"
          >
            {{ isMuted ? '静音中' : '朗读中' }}
          </n-button>
        </div>
      </div>

      <n-card
        class="!rounded-[28px] !border-white/8 !bg-#25222C shadow-[0_20px_50px_rgba(5,1,13,0.18)] backdrop-blur-2xl transition-all duration-300 focus-within:!border-nebula-500/60 focus-within:!shadow-[0_0_0_3px_rgba(139,92,246,0.16)]"
        content-style="padding: 10px"
      >
        <div
          v-if="selectedFileName !== '未选择文件' || selectedVideoName !== '未选择视频' || selectedImageName !== '未选择图片'"
          class="mb-3 flex flex-wrap gap-2"
        >
          <n-tag
            v-if="selectedFileName !== '未选择文件'"
            closable
            type="primary"
            round
            size="small"
            class="!border-nebula-500/30 !bg-nebula-500/20 !text-nebula-200 backdrop-blur-md"
            @close="$emit('clear-file')"
          >
            <template #icon>📎</template>
            {{ selectedFileName }}
          </n-tag>
          <n-tag
            v-if="selectedImageName !== '未选择图片'"
            closable
            type="warning"
            round
            size="small"
            class="!border-amber-500/30 !bg-amber-500/20 !text-amber-200 backdrop-blur-md cursor-pointer hover:!bg-amber-500/30 transition-colors"
            @close="$emit('clear-file')"
            @click="$emit('preview-video')"
          >
            <template #icon>🖼️</template>
            {{ selectedImageName }}
          </n-tag>
          <n-tag
            v-if="selectedVideoName !== '未选择视频'"
            closable
            type="success"
            round
            size="small"
            class="!border-emerald-500/30 !bg-emerald-500/20 !text-emerald-200 backdrop-blur-md cursor-pointer hover:!bg-emerald-500/30 transition-colors"
            @close="$emit('clear-file')"
            @click="$emit('preview-video')"
          >
            <template #icon>🎬</template>
            {{ selectedVideoName }}
          </n-tag>
        </div>

        <div class="flex items-center gap-3">
          <div class="pl-2">
            <n-button
              circle
              quaternary
              class="!text-white/40 hover:!text-white hover:!bg-white/10"
              @click="chatFileInput?.click()"
            >
              <template #icon>
                <svg viewBox="0 0 24 24" fill="none" class="h-5 w-5">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
                </svg>
              </template>
            </n-button>
            <input
              ref="chatFileInput"
              type="file"
              class="hidden"
              accept="image/*,video/*"
              @change="$emit('file-change', $event)"
            />
          </div>

          <div class="flex-1 px-2">
            <n-input
              :value="query"
              type="textarea"
              placeholder="输入你的问题，按 Ctrl + Enter 发送"
              :autosize="{ minRows: 1, maxRows: 8 }"
              :bordered="false"
              class="!bg-transparent shadow-none"
              @update:value="$emit('update:query', $event)"
              @keydown.ctrl.enter.prevent="$emit('send')"
            />
          </div>

          <n-button
            type="primary"
            class="!h-8 !rounded-full px-10 !bg-gradient-to-r !from-violet-500 !to-fuchsia-500 !border-none shadow-[0_10px_25px_rgba(139,92,246,0.28)]"
            :disabled="!canSend"
            :loading="isLoading && !hasReceivedChunk"
            @click="$emit('send')"
          >
            {{ isStreaming ? '生成中' : '发送' }}
          </n-button>
        </div>
      </n-card>

      <n-text depth="3" class="mt-5px block text-center text-[13px] tracking-tight text-white/45">
        AI 可能会产生错误，请核查重要信息。
      </n-text>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  query: string
  isChatStarted: boolean
  isUploading: boolean
  isReading: boolean
  isMuted: boolean
  isStreaming: boolean
  canSend: boolean
  isLoading: boolean
  hasReceivedChunk: boolean
  selectedFileName: string
  selectedVideoName: string
  selectedImageName: string
}>()

defineEmits(['update:query', 'update:isMuted', 'send', 'clear-file', 'preview-video', 'file-change'])

const chatFileInput = ref<HTMLInputElement | null>(null)
</script>
