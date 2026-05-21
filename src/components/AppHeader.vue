<template>
  <n-layout-header class="rounded-[5px] border border-white/8 !bg-white/6 h-75px px-5 py-2 backdrop-blur-2xl shadow-[0_20px_50px_rgba(5,1,13,0.18)]">
    <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0">
        <div class="truncate text-16px font-semibold tracking-tight text-white">
          {{ conversationTitle }}
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <n-tag :bordered="false" round size="small" class="!bg-white/6 !text-white/65">
            {{ aiStatus }}
          </n-tag>
          <n-tag :bordered="false" round size="small" class="!bg-violet-500/10 !text-violet-100">
            模型：{{ modelName }}
          </n-tag>
          <n-tag :bordered="false" round size="small" class="!bg-cyan-500/10 !text-cyan-100">
            {{ knowledgeBaseStatus }}
          </n-tag>
        </div>
      </div>

      <div class="flex items-center gap-2 self-start lg:self-auto">
        <n-button quaternary class="!rounded-xl" @click="$emit('clear-conversation')">
          清空会话
        </n-button>
        <n-button quaternary class="!rounded-xl" :disabled="!canExport" :loading="isExporting" @click="$emit('export')">
          导出
        </n-button>
        <n-dropdown trigger="click" :options="moreOptions" @select="handleSelect">
          <n-button quaternary circle class="!rounded-xl">
            <template #icon>
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 12h.01M12 12h.01M18 12h.01" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </template>
          </n-button>
        </n-dropdown>
      </div>
    </div>
  </n-layout-header>
</template>

<script setup lang="ts">
const props = defineProps<{
  conversationTitle: string
  aiStatus: string
  modelName: string
  knowledgeBaseStatus: string
  canExport: boolean
  isExporting: boolean
}>()

const emit = defineEmits(['clear-conversation', 'export', 'new-conversation', 'rename-current'])

const moreOptions = [
  {
    label: '新建对话',
    key: 'new'
  },
  {
    label: '重命名当前会话',
    key: 'rename'
  }
]

function handleSelect(key: string) {
  if (key === 'new') {
    emit('new-conversation')
    return
  }

  if (key === 'rename') {
    emit('rename-current', props.conversationTitle)
  }
}
</script>
