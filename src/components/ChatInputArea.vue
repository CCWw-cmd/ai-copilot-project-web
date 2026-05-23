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
        <div v-if="selectedFileName !== '未选择文件'" class="mb-3 flex flex-wrap gap-2">
          <n-tag
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
        </div>

        <div v-if="mediaAttachments.length > 0" class="mb-3 flex flex-wrap gap-3 px-2">
          <div
            v-for="mediaItem in mediaAttachments"
            :key="mediaItem.id"
            class="group relative h-15 w-15 shrink-0 overflow-hidden"
          >
            <div
              class="absolute inset-0 z-0 cursor-pointer"
              @click="$emit('preview-media', mediaItem)"
            >
              <img
                :src="mediaItem.previewSrc"
                :alt="mediaItem.name"
                class="h-full w-full object-cover notranslate"
              />
              <div
                v-if="mediaItem.type === 'video'"
                class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[1px]"
              >
                <div class="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs text-white shadow-lg ring-1 ring-white/40">
                  ▶
                </div>
              </div>
            </div>

            <div
              class="absolute right-2px top-2px z-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-xs text-white transition-colors hover:bg-black/85"
              @click.stop="$emit('remove-media', mediaItem.id)"
            >
              ×
            </div>
          </div>
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
                  <div class="i-iconoir:attachment" />
                </template>
              </n-button>
            <input
              ref="chatFileInput"
              type="file"
              class="hidden"
              accept="image/*,video/*"
              multiple
              @change="$emit('file-change', $event)"
            />
          </div>

          <div class="flex-1 px-2">
            <n-input
              :value="query"
              type="textarea"
              placeholder="输入你的问题，按 Enter 发送，Ctrl + Enter 换行"
              :autosize="{ minRows: 1, maxRows: 8 }"
              :bordered="false"
              class="!bg-transparent shadow-none"
              @update:value="$emit('update:query', $event)"
              @keydown="handleInputKeydown"
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
import { nextTick, ref } from 'vue'

const props = defineProps<{
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
  mediaAttachments: Array<{
    id: string
    type: 'image' | 'video'
    name: string
    previewSrc: string
  }>
}>()

const emit = defineEmits([
  'update:query',
  'update:isMuted',
  'send',
  'clear-file',
  'preview-media',
  'remove-media',
  'file-change',
])

const chatFileInput = ref<HTMLInputElement | null>(null)

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter') {
    return
  }

  if (event.ctrlKey) {
    event.preventDefault()

    const target = event.target as HTMLTextAreaElement | null
    if (!target) {
      return
    }

    const selectionStart = target.selectionStart ?? 0
    const selectionEnd = target.selectionEnd ?? selectionStart
    const nextValue = `${props.query.slice(0, selectionStart)}\n${props.query.slice(selectionEnd)}`

    emit('update:query', nextValue)

    nextTick(() => {
      const cursorPosition = selectionStart + 1
      target.setSelectionRange(cursorPosition, cursorPosition)
    })
    return
  }

  if (!event.shiftKey && !event.altKey && !event.metaKey) {
    event.preventDefault()
    emit('send')
  }
}
</script>
