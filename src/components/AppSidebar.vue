<template>
  <n-layout-sider :width="320" class="!bg-transparent z-10 !border-r-white/6 !overflow-hidden">
    <div class="h-full px-2 py-1 flex flex-col gap-3 overflow-hidden">
      <!-- Logo 区域 -->
      <div class="rounded-[5px] border border-white/8 bg-white/4 h-75px px-2 py-3 backdrop-blur-2xl shadow-[0_20px_50px_rgba(5,1,13,0.25)] shrink-0">
        <div class="flex items-center gap-3">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 via-fuchsia-500 to-nebula-500 text-lg font-bold text-white shadow-[0_0_30px_rgba(139,92,246,0.35)]">
            AI
          </div>
          <div class="min-w-0">
            <div class="text-sm font-semibold tracking-wide text-white">AI Copilot</div>
            <div class="text-xs text-white/45">智能知识问答工作台</div>
          </div>
        </div>
      </div>

      <!-- 新建对话按钮 -->
      <div
        class="group flex cursor-pointer items-center justify-center gap-3 rounded-[5px] border border-violet-300/25 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(124,58,237,0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_26px_rgba(168,85,247,0.65)] shrink-0 select-none"
        @click="$emit('create-conversation')"
      >
        <span class="text-lg font-bold transition-transform duration-300 group-hover:rotate-90">+</span>
        新建对话
      </div>

      <!-- 最近对话列表 -->
      <div class="min-h-0 flex-1 rounded-[5px] border border-white/8 bg-white/4 backdrop-blur-2xl flex flex-col overflow-hidden">
        <div class="flex items-center justify-between px-2 pt-4 pb-3 shrink-0">
          <div>
            <div class="text-sm font-semibold text-white">最近对话</div>
            <div class="text-xs text-white/40">支持切换、重命名与删除</div>
          </div>
          <div class="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-xs text-white/55">
            {{ conversations.length }}
          </div>
        </div>

        <n-scrollbar class="flex-1 px-2 pb-3">
          <div v-if="conversations.length === 0" class="flex min-h-[180px] items-center justify-center px-2 text-center text-sm text-white/40">
            暂无历史会话，点击上方按钮开始新的对话。
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="conversation in conversations"
              :key="conversation.id"
              class="group w-full cursor-pointer rounded-[5px] border px-3 py-3 text-left transition-all duration-200"
              :class="conversation.id === currentConversationId
                ? 'border-violet-300/30 bg-gradient-to-r from-violet-500/18 to-fuchsia-500/10 shadow-[0_10px_30px_rgba(109,40,217,0.16)]'
                : 'border-white/6 bg-white/3 hover:border-white/14 hover:bg-white/7'"
              @click="$emit('select-conversation', conversation.id)"
            >
              <div class="flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-medium text-white">
                    {{ conversation.title || '未命名对话' }}
                  </div>
                  <div class="mt-1 text-xs text-white/40">
                    {{ formatUpdatedAt(conversation.updatedAt) }}
                  </div>
                </div>

                <div class="flex items-center gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <n-button
                    circle
                    quaternary
                    class="!bg-white/8 !text-white/70 hover:!bg-white/14 hover:!text-white"
                    @click.stop="$emit('rename-conversation', conversation.id)"
                  >
                    <template #icon>
                      <div class="text-16px i-ri:edit-line !text-white/80"></div>
                    </template>
                  </n-button>
                  <n-button
                    circle
                    quaternary
                    class="!bg-white/8 !text-white/70 hover:!bg-rose-500/18 hover:!text-rose-200"
                    @click.stop="$emit('delete-conversation', conversation.id)"
                  >
                    <template #icon>
                      <div class="text-16px i-ri:delete-bin-6-line !text-white/80"></div>
                    </template>
                  </n-button>
                </div>
              </div>
            </div>
          </div>
        </n-scrollbar>
      </div>

      <!-- 知识库区域 -->
      <div class="rounded-[5px] border border-white/8 bg-white/4 px-2 py-4 backdrop-blur-2xl shrink-0 flex flex-col min-h-[40%]">
        <div class="mb-3 flex items-center justify-between shrink-0">
          <div>
            <div class="text-sm font-semibold text-white">知识库</div>
          </div>
          <n-button quaternary circle size="small" @click="fileInput?.click()">
            <template #icon>
              <span class="text-lg font-bold">+</span>
            </template>
          </n-button>
        </div>

        <input ref="fileInput" type="file" class="hidden" accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls" @change="$emit('file-change', $event)" />

        <div v-if="selectedFileName !== '未选择文件'" class="mb-3 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3 shrink-0">
          <div class="mb-2 flex items-center justify-between gap-3">
            <div class="min-w-0 truncate text-xs text-violet-100">待上传：{{ selectedFileName }}</div>
            <n-button text size="tiny" class="!text-white/60 hover:!text-white" @click="$emit('clear-selection')">
              取消
            </n-button>
          </div>
          <n-button
            block
            type="primary"
            size="small"
            :loading="isUploading"
            class="!rounded-xl"
            @click="$emit('upload')"
          >
            上传至知识库
          </n-button>
        </div>

        <n-scrollbar class="flex-1 pr-1">
          <div v-if="uploadedFiles.length === 0" class="flex min-h-[120px] items-center justify-center px-4 text-center text-sm text-white/35">
            暂无上传文档
          </div>

          <div v-else class="space-y-2">
            <div
              v-for="file in uploadedFiles"
              :key="file.name"
              class="group flex items-center justify-between gap-3 rounded-5px border border-white/6 bg-black/10 px-3 py-3 transition-colors hover:border-white/12 hover:bg-white/6"
            >
              <div class="min-w-0">
                <div class="truncate text-sm text-white/88">{{ file.name }}</div>
                <div class="mt-1 text-xs text-white/40">{{ renderFileStatus(file.status) }}</div>
              </div>

              <div class="flex items-center gap-2">
                <n-spin v-if="file.status === 'uploading'" :size="14" />
                <span v-else-if="file.status === 'success'" class="text-xs font-semibold text-emerald-300">已完成</span>
                <span v-else class="text-xs font-semibold text-rose-300">失败</span>
                <n-button
                    circle
                    size="small"
                    quaternary
                    class="!text-white/65 hover:!bg-white/14 hover:!text-white"
                    @click.stop="$emit('remove-file', file.name)"
                  >
                    <template #icon>
                      <span class="text-base">×</span>
                    </template>
                  </n-button>
              </div>
            </div>
          </div>
        </n-scrollbar>
      </div>
    </div>
  </n-layout-sider>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  conversations: Array<{ id: string; title: string; updatedAt: number }>
  currentConversationId: string
  uploadedFiles: Array<{ name: string; status: string }>
  selectedFileName: string
  isUploading: boolean
}>()

defineEmits([
  'create-conversation',
  'select-conversation',
  'rename-conversation',
  'delete-conversation',
  'file-change',
  'clear-selection',
  'upload',
  'remove-file'
])

const fileInput = ref<HTMLInputElement | null>(null)

function formatUpdatedAt(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()

  return sameDay
    ? `今天 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    : date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function renderFileStatus(status: string) {
  if (status === 'uploading') return '上传中'
  if (status === 'success') return '可用于问答'
  return '上传失败'
}

defineExpose({
  fileInput
})
</script>
