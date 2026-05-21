<template>
  <div class="mindmap-wrapper group relative">
    <div class="mindmap-container" @click="openModal">
      <svg ref="svgRef" class="w-full h-full min-h-[500px] cursor-zoom-in"></svg>
      <div class="absolute right-4 top-4 opacity-0 transition-opacity group-hover:opacity-100">
        <n-button
          secondary
          circle
          type="primary"
          title="查看大图"
          @click.stop="openModal"
        >
          <template #icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>
          </template>
        </n-button>
      </div>
    </div>

    <!-- Modal -->
    <n-modal
      v-model:show="isModalOpen"
      preset="card"
      style="width: 90vw; height: 90vh"
      title="脑图详情"
      :bordered="false"
      class="!rounded-2xl shadow-2xl"
      header-style="padding: 16px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.08)"
      content-style="padding: 16px; flex: 1; overflow: hidden"
    >
      <div class="h-full w-full">
        <svg ref="modalSvgRef" class="h-full w-full"></svg>
      </div>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { Markmap } from 'markmap-view'
import { Transformer } from 'markmap-lib'

const props = defineProps<{
  code: string
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const modalSvgRef = ref<SVGSVGElement | null>(null)
const isModalOpen = ref(false)

let mm: Markmap | null = null
let modalMm: Markmap | null = null
const transformer = new Transformer()

const updateMarkmap = () => {
  if (!svgRef.value) return
  
  const { root } = transformer.transform(props.code)
  if (mm) {
    mm.setData(root)
    mm.fit()
  } else {
    mm = Markmap.create(svgRef.value, {
      autoFit: true,
      padding: 20,
    }, root)
  }
}

const updateModalMarkmap = async () => {
  await nextTick()
  if (!modalSvgRef.value) return
  
  const { root } = transformer.transform(props.code)
  if (modalMm) {
    modalMm.setData(root)
    modalMm.fit()
  } else {
    modalMm = Markmap.create(modalSvgRef.value, {
      autoFit: true,
      padding: 40,
    }, root)
  }
}

const openModal = () => {
  isModalOpen.value = true
  updateModalMarkmap()
}

const closeModal = () => {
  isModalOpen.value = false
  modalMm = null
}

onMounted(() => {
  updateMarkmap()
})

watch(() => props.code, () => {
  updateMarkmap()
  if (isModalOpen.value) {
    updateModalMarkmap()
  }
})

onUnmounted(() => {
  mm = null
  modalMm = null
})
</script>

<style scoped>
.mindmap-wrapper {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
  width: 85%;
  margin-left: auto;
  margin-right: auto;
}

.mindmap-container {
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 1rem;
  background-color: #ffffff;
  overflow: hidden;
  transition: all 0.3s ease;
}

.mindmap-container:hover {
  border-color: rgba(0, 0, 0, 0.2);
}

:deep(.markmap) {
  background: #ffffff;
  width: 100%;
  height: 100%;
}

:deep(.markmap-node) {
  cursor: pointer;
}

:deep(.markmap-node circle) {
  fill: #fff;
  stroke: #1f2937;
  stroke-width: 1.5px;
}

:deep(.markmap-node text) {
  fill: #1f2937; /* gray-800 */
  font-size: 14px;
  font-weight: 500;
}

:deep(.markmap-link) {
  fill: none;
  stroke: #9ca3af; /* gray-400 */
  stroke-width: 1.5px;
}
</style>
