<template>
  <div class="px-6 pb-8 pt-2 md:px-10">
    <div class="mx-auto max-w-4xl">
      <div v-if="isChatStarted || isUploading || isReading" class="flex justify-between items-center mb-2 h-8">
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
            @click="$emit('update:isMuted', !isMuted)"
            class="!rounded-lg"
          >
            {{ isMuted ? '🔇 静音中' : '🔊 朗读中' }}
          </n-button>
        </div>
      </div>

      <n-card 
        class="!bg-[#1a1625]/80 !border-white/5 shadow-2xl !rounded-[24px] transition-all duration-300 focus-within:!border-nebula-500/60 focus-within:!shadow-[0_0_0_3px_rgba(139,92,246,0.18)]" 
        content-style="padding: 8px 12px"
      >
        <div class="flex items-end gap-2">
          <div class="relative flex-1">
            <n-input
              :value="query"
              @update:value="$emit('update:query', $event)"
              type="textarea"
              placeholder="有问题，尽管问"
              :autosize="{ minRows: 1, maxRows: 8 }"
              :bordered="false"
              class="!bg-transparent shadow-none"
              @keydown.ctrl.enter.prevent="$emit('send')"
            />
            <div
              v-if="selectedFileName !== '未选择文件' || selectedVideoName !== '未选择视频'"
              class="absolute -top-14 left-0 flex gap-2"
            >
              <n-tag
                v-if="selectedFileName !== '未选择文件'"
                closable
                @close="$emit('clear-file')"
                type="primary"
                round
                size="small"
                class="!bg-nebula-500/20 !border-nebula-500/30 !text-nebula-200 backdrop-blur-md"
              >
                <template #icon>📎</template>
                {{ selectedFileName }}
              </n-tag>
              <n-tag
                v-if="selectedVideoName !== '未选择视频'"
                closable
                @close="$emit('clear-file')"
                @click="$emit('preview-video')"
                type="success"
                round
                size="small"
                class="!bg-emerald-500/20 !border-emerald-500/30 !text-emerald-200 backdrop-blur-md cursor-pointer hover:!bg-emerald-500/30 transition-colors"
              >
                <template #icon>🎬</template>
                {{ selectedVideoName }}
              </n-tag>
            </div>
          </div>

          <n-button
            type="primary"
            class="!rounded-2xl h-10 px-6 min-w-[100px]"
            :disabled="!canSend"
            :loading="isLoading && !hasReceivedChunk"
            @click="$emit('send')"
          >
            {{ isStreaming ? '对话中' : '开始对话' }}
          </n-button>
        </div>
      </n-card>
      <n-text depth="3" class="mt-4 block text-center text-[14px] tracking-tight">
        AI 可能会产生错误，请核查重要信息。
      </n-text>
    </div>
  </div>
</template>

<script setup lang="ts">
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
}>()

defineEmits(['update:query', 'update:isMuted', 'send', 'clear-file', 'preview-video'])
</script>
