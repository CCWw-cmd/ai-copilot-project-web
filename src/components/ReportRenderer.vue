<template>
  <div class="report-container p-6 my-6 rounded-2xl bg-[#1e1b2e] border border-white/10 shadow-xl">
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-bold text-nebula-200 flex items-center gap-2">
        <span class="text-2xl">📋</span> 视频巡检报告
      </h2>
      <div 
        class="px-4 py-1 rounded-full text-sm font-bold"
        :class="riskLevelClass"
      >
        风险等级：{{ reportData.summary?.riskLevel || '未知' }}
      </div>
    </div>

    <!-- 统计摘要 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
      <div class="stat-card p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-4">
        <div class="text-3xl">⚠️</div>
        <div>
          <div class="text-xs text-white/40 uppercase tracking-wider">违规次数</div>
          <div class="text-2xl font-bold text-red-400">{{ reportData.summary?.violationCount || 0 }} 次</div>
        </div>
      </div>
      <div class="stat-card p-4 rounded-xl bg-white/5 border border-white/5 flex items-center gap-4">
        <div class="text-3xl">📊</div>
        <div>
          <div class="text-xs text-white/40 uppercase tracking-wider">统计分析</div>
          <div class="text-sm text-white/80">{{ reportData.summary?.stats || '暂无数据' }}</div>
        </div>
      </div>
    </div>

    <!-- 时间轴 -->
    <div v-if="reportData.timeline?.length" class="mb-8">
      <h3 class="text-lg font-semibold mb-4 text-white/90 flex items-center gap-2">
        <span class="text-lg">⏳</span> 违规时间轴
      </h3>
      <div class="timeline ml-4 border-l-2 border-nebula-500/30 pl-6 space-y-6 relative">
        <div 
          v-for="(item, index) in reportData.timeline" 
          :key="index"
          class="timeline-item relative"
        >
          <div class="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-nebula-500 shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
          <div class="flex items-start gap-3">
            <span class="text-sm font-mono text-nebula-400 bg-nebula-500/10 px-2 py-0.5 rounded">{{ item.time }}</span>
            <span class="text-white/80">{{ item.event }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 详细建议 -->
    <div v-if="reportData.report" class="p-4 rounded-xl bg-nebula-500/5 border border-nebula-500/20">
      <h3 class="text-md font-semibold mb-2 text-nebula-300 flex items-center gap-2">
        <span class="text-md">💡</span> 改进建议与结论
      </h3>
      <p class="text-sm text-white/70 leading-relaxed italic">
        {{ reportData.report }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  code: string
}>()

const reportData = computed(() => {
  try {
    return JSON.parse(props.code)
  } catch (e) {
    console.error('Failed to parse report JSON:', e)
    return {}
  }
})

const riskLevelClass = computed(() => {
  const level = reportData.value.summary?.riskLevel
  if (level === '高') return 'bg-red-500/20 text-red-400 border border-red-500/30'
  if (level === '中') return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
  return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
})
</script>

<style scoped>
.report-container {
  page-break-inside: avoid;
}
.timeline-item {
  transition: all 0.3s ease;
}
.timeline-item:hover {
  transform: translateX(5px);
}
</style>
