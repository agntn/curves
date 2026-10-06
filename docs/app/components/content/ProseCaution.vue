<script setup lang="ts">
defineProps<{ title?: string }>();
</script>

<template>
  <CurvesCallout kind="caution" :title="title"><slot mdc-unwrap="p" /></CurvesCallout>
</template>
