<template>
  <div class="flex flex-1 flex-col items-center justify-center pt-20 text-center">
    <div class="relative mb-8">
      <div class="absolute inset-0 rounded-full bg-nebula-500/20 blur-2xl animate-pulse" />
      <DotLottieVue
        style="height: 400px; width: 400px"
        autoplay
        loop
        :src="lottieUrl"
      />
    </div>
    <n-text class="text-4xl font-medium tracking-tight opacity-90 mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/60">
      有什么想问的吗?
    </n-text>
    <p class="text-nebula-200/60 text-lg leading-relaxed mx-auto">
      您可以问我任何关于知识库的问题，或者让我帮您分析数据、生成图表。
    </p>
  </div>
</template>

<script setup lang="ts">
import { DotLottieVue } from '@lottiefiles/dotlottie-vue'

defineProps<{
  lottieUrl: string
}>()
</script>
