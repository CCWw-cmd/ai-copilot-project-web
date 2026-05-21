<template>
  <div class="chart-wrapper group relative">
    <div class="chart-container">
      <div v-if="error" class="error-message">
        <n-text type="error">图表数据格式错误: {{ error }}</n-text>
      </div>
      <v-chart v-else ref="chartRef" :option="chartOption" class="chart-instance autoresize" />
      
      <div class="absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100 flex gap-2 no-export">
        <n-button
          secondary
          circle
          type="primary"
          title="导出图片"
          @click.stop="exportImage"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          </template>
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart, LineChart, PieChart, ScatterChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent
} from 'echarts/components'
import VChart from 'vue-echarts'

// 注册 ECharts 组件
use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  DatasetComponent,
  TransformComponent
])

const props = defineProps<{
  code: string
}>()

const chartRef = ref<any>(null)
const error = ref<string | null>(null)

const chartData = computed(() => {
  try {
    error.value = null
    const data = JSON.parse(props.code)
    return data
  } catch (e) {
    error.value = (e as Error).message
    return null
  }
})

const chartOption = computed(() => {
  const data = chartData.value
  if (!data) return {}

  // 基础配置
  const option: any = {
    title: {
      text: data.title || '数据图表',
      left: 'center',
      textStyle: {
        color: '#333'
      }
    },
    tooltip: {
      trigger: data.type === 'pie' ? 'item' : 'axis'
    },
    legend: {
      bottom: '5%',
      textStyle: {
        color: '#666'
      }
    },
    backgroundColor: 'transparent',
    textStyle: {
      color: '#666'
    }
  }

  // 根据类型配置坐标轴
  if (data.type !== 'pie') {
    option.grid = {
      left: '3%',
      right: '4%',
      bottom: '15%',
      containLabel: true
    }
    option.xAxis = {
      type: 'category',
      data: data.xAxis || [],
      axisLine: { lineStyle: { color: '#eee' } },
      axisLabel: { color: '#666' }
    }
    option.yAxis = {
      type: 'value',
      axisLine: { lineStyle: { color: '#eee' } },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
      axisLabel: { color: '#666' }
    }
  }

  // 配置数据系列
  if (data.type === 'pie') {
    option.series = [
      {
        name: data.title || '',
        type: 'pie',
        radius: '50%',
        data: data.series?.[0]?.data || [],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    ]
  } else {
    option.series = (data.series || []).map((s: any) => ({
      name: s.name,
      type: data.type || 'bar',
      data: s.data,
      smooth: data.type === 'line'
    }))
  }

  return option
})

const exportImage = () => {
  if (chartRef.value) {
    const url = chartRef.value.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#05010d'
    })
    const link = document.createElement('a')
    link.href = url
    link.download = `${chartData.value?.title || 'chart'}.png`
    link.click()
  }
}
</script>

<style scoped>
.chart-instance {
  height: 400px;
  width: 100%;
}

:deep(.pdf-export-mode) .chart-instance {
  height: auto !important;
  min-height: 0 !important;
}

:deep(.pdf-export-mode) .no-export {
  display: none !important;
}

.chart-wrapper {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  width: 85%;
  margin-left: auto;
  margin-right: auto;
}

.chart-container {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 1rem;
  background-color: #ffffff;
  padding: 1.5rem;
  overflow: hidden;
  transition: all 0.3s ease;
}

.chart-container:hover {
  border-color: rgba(139, 92, 246, 0.3);
  background-color: #ffffff;
}

.error-message {
  height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 0, 0, 0.05);
  border-radius: 0.5rem;
}
</style>
