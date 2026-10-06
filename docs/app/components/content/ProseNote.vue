<script setup lang="ts">
defineProps<{ title?: string }>();
</script>

<template>
  <CurvesCallout kind="note" :title="title"><slot mdc-unwrap="p" /></CurvesCallout>
</template>
