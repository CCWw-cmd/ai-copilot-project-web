<template>
  <div class="chat-message-group group/msg relative">
    <template v-for="(group, gIndex) in groupedSegments" :key="gIndex">
      <!-- 只有 combined 类型的组需要强制不分页 -->
      <div :class="{ 'keep-together': group.type === 'combined' }">
        <template v-for="(segment, sIndex) in group.segments" :key="sIndex">
          <!-- Markdown 文本段落 -->
          <div
            v-if="segment.type === 'markdown'"
            class="break-words text-white/90"
            v-html="renderMarkdown(segment.content)"
            @click="$emit('citation-click', $event)"
          />
          
          <template v-else>
            <!-- 生成中的 Loading 状态 -->
            <div v-if="segment.isGenerating" class="chart-loading-placeholder no-export">
              <n-space align="center" size="small">
                <n-spin size="small" />
                <n-text depth="3" class="text-xs">
                  正在生成{{ segment.type === 'chart' ? '图表' : (segment.type === 'report' ? '巡检报告' : '脑图') }}...
                </n-text>
              </n-space>
            </div>
            
            <!-- 完成后的正式渲染 -->
            <template v-else>
              <MindMap v-if="segment.type === 'mindmap'" :code="segment.content" />
              <ChartRenderer v-else-if="segment.type === 'chart'" :code="segment.content" />
              <ReportRenderer v-else-if="segment.type === 'report'" :code="segment.content" />
            </template>
          </template>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MindMap from './MindMap.vue'
import ChartRenderer from './ChartRenderer.vue'
import ReportRenderer from './ReportRenderer.vue'
import { renderMarkdown } from '../lib/utils'

const props = defineProps<{
  output: string
}>()

defineEmits(['citation-click'])

const messageSegments = computed(() => {
  const segments: Array<{ type: 'markdown' | 'chart' | 'mindmap' | 'report', content: string, isGenerating?: boolean }> = []
  let lastIndex = 0
  const fullText = props.output
  
  const blockRegex = /```(chart|mindmap|report)\s*\n([\s\S]*?)\n```/gi
  let match
  
  while ((match = blockRegex.exec(fullText)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: 'markdown',
        content: fullText.substring(lastIndex, match.index)
      })
    }
    
    segments.push({
      type: match[1] as 'chart' | 'mindmap' | 'report',
      content: match[2].trim(),
      isGenerating: false
    })
    
    lastIndex = blockRegex.lastIndex
  }
  
  const remainingText = fullText.substring(lastIndex)
  const incompleteMatch = remainingText.match(/```(chart|mindmap|report)\s*\n([\s\S]*)$/i)
  
  if (incompleteMatch) {
    const startIndex = incompleteMatch.index!
    if (startIndex > 0) {
      segments.push({
        type: 'markdown',
        content: remainingText.substring(0, startIndex)
      })
    }
    
    segments.push({
      type: incompleteMatch[1] as 'chart' | 'mindmap' | 'report',
      content: incompleteMatch[2].trim(),
      isGenerating: true
    })
  } else if (remainingText) {
    segments.push({
      type: 'markdown',
      content: remainingText
    })
  }
  
  return segments
})

const groupedSegments = computed(() => {
  const segments = messageSegments.value
  const groups: Array<{ type: 'markdown' | 'chart' | 'mindmap' | 'report' | 'combined', segments: any[] }> = []
  
  for (let i = 0; i < segments.length; i++) {
    const current = segments[i]
    
    if (current.type === 'markdown' && i < segments.length - 1) {
      const next = segments[i + 1]
      const content = current.content.trim()
      const lines = content.split('\n')
      const lastLine = lines[lines.length - 1].trim()
      
      const isTitle = /^#+\s+/.test(lastLine) || /^\d+\.\s+/.test(lastLine)
      
      if (isTitle && (next.type === 'chart' || next.type === 'mindmap' || next.type === 'report')) {
        const otherContent = lines.slice(0, lines.length - 1).join('\n')
        
        if (otherContent.trim()) {
          groups.push({ type: 'markdown', segments: [{ type: 'markdown', content: otherContent }] })
        }
        
        groups.push({
          type: 'combined',
          segments: [
            { type: 'markdown', content: lastLine },
            next
          ]
        })
        
        i++
        continue
      }
    }
    
    groups.push({ type: current.type, segments: [current] })
  }
  
  return groups
})
</script>

<style scoped>
.chart-loading-placeholder {
  margin: 1.5rem auto;
  padding: 1.5rem;
  width: 85%;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 1rem;
  background-color: rgba(255, 255, 255, 0.02);
  display: flex;
  justify-content: center;
  align-items: center;
}

.keep-together {
  page-break-inside: avoid !important;
  break-inside: avoid !important;
  display: block;
  margin-bottom: 20px;
}
</style>
