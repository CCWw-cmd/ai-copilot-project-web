<template>
  <n-layout-header bordered class="z-20 !bg-[#05010d]/50 backdrop-blur-md px-6 py-3 h-16 flex items-center justify-between">
    <h1 class="text-xl font-semibold tracking-tight text-white md:text-2xl m-0">
      AI Copilot
    </h1>
    <n-space align="center">
      <n-text depth="3" class="text-xs uppercase tracking-widest">{{ status }}</n-text>
    </n-space>
  </n-layout-header>
</template>

<script setup lang="ts">
defineProps<{
  status: string
}>()
</script>
