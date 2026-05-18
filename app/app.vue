<script setup>
const { data: settings } = await useFetch('/api/settings')

useHead(() => ({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: settings.value?.siteLogo || '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: settings.value?.language || 'en'
  }
}))

const title = computed(() => settings.value?.siteTitle || 'LLM Human Agent')
const description = computed(() => settings.value?.siteSubtitle || 'A human-in-the-loop server for OpenAI and Claude compatible calls.')

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description
})
</script>

<template>
  <UApp>
    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
