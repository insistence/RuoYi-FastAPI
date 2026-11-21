<template>
  <template
    v-for="(part, index) in parts"
    :key="index"
  >
    <slot
      v-if="part.name"
      :name="part.name"
      >{{ part.raw }}</slot
    >
    <template v-else>{{ part.text }}</template>
  </template>
</template>

<script setup>
import { computed } from 'vue'
const props = defineProps({ message: { type: String, required: true } })

// 将译文中的具名占位符渲染为插槽，避免拼接句子或解释 HTML。
const parts = computed(() => {
  const result = []
  let offset = 0
  for (const match of props.message.matchAll(/\{([a-z][a-zA-Z0-9]*)\}/g)) {
    result.push({ text: props.message.slice(offset, match.index) })
    result.push({ name: match[1], raw: match[0] })
    offset = match.index + match[0].length
  }
  result.push({ text: props.message.slice(offset) })
  return result
})
</script>
