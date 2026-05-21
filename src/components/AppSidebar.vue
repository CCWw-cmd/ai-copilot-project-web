<template>
  <n-layout-sider
    bordered
    collapse-mode="width"
    :collapsed-width="0"
    :width="300"
    show-trigger="arrow-circle"
    class="!bg-white/2 backdrop-blur-xl z-10"
  >
    <div class="p-4 flex flex-col h-full">
      <div class="flex items-center justify-between mb-4">
        <n-text depth="3" class="text-xs font-medium uppercase tracking-widest">知识文档</n-text>
        <n-button quaternary circle size="small" @click="fileInput?.click()">
          <template #icon>+</template>
        </n-button>
      </div>

      <input ref="fileInput" type="file" class="hidden" @change="$emit('file-change', $event)" />

      <div v-if="selectedFileName !== '未选择文件'" class="mb-4">
        <n-card size="small" class="!bg-nebula-500/10 !border-nebula-500/30">
          <div class="flex items-center justify-between mb-2">
            <n-text depth="2" class="text-xs truncate">📎 {{ selectedFileName }}</n-text>
            <n-button quaternary circle size="tiny" @click="$emit('clear-selection')">
              ×
            </n-button>
          </div>
          <n-button
            block
            type="primary"
            size="small"
            :loading="isUploading"
            @click="$emit('upload')"
            class="!rounded-lg"
          >
            上传至知识库
          </n-button>
        </n-card>
      </div>

      <n-scrollbar class="flex-1 pr-2">
        <div v-if="uploadedFiles.length === 0" class="flex flex-col items-center justify-center py-10 px-4 text-center">
          <n-text depth="3" class="text-2xl opacity-20">📁</n-text>
          <n-text depth="3" class="text-xs">暂无上传文档</n-text>
        </div>
        <n-space vertical v-else size="small">
          <n-card
            v-for="file in uploadedFiles"
            :key="file.name"
            size="small"
            class="!bg-white/5 !border-white/5 hover:!bg-white/10 transition-colors cursor-pointer !rounded-xl group relative"
          >
            <div class="flex items-center justify-between">
              <n-space align="center" size="small" class="overflow-hidden">
                <n-text depth="3">📄</n-text>
                <n-text depth="2" class="truncate max-w-[140px]">{{ file.name }}</n-text>
              </n-space>
              
              <div class="flex items-center">
                <div class="group-hover:hidden flex items-center">
                  <n-spin v-if="file.status === 'uploading'" :size="12" />
                  <n-text v-else-if="file.status === 'success'" type="success" class="font-bold text-xs">√</n-text>
                  <n-text v-else-if="file.status === 'error'" type="error" class="font-bold text-xs">×</n-text>
                </div>
                
                <n-button 
                  quaternary 
                  circle 
                  size="tiny" 
                  class="hidden group-hover:flex"
                  @click.stop="$emit('remove-file', file.name)"
                >
                  <template #icon>×</template>
                </n-button>
              </div>
            </div>
          </n-card>
        </n-space>
      </n-scrollbar>
    </div>
  </n-layout-sider>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  uploadedFiles: Array<{ name: string; status: string }>
  selectedFileName: string
  isUploading: boolean
}>()

const emit = defineEmits(['file-change', 'clear-selection', 'upload', 'remove-file'])
const fileInput = ref<HTMLInputElement | null>(null)

defineExpose({
  fileInput
})
</script>
