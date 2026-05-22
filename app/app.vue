<script setup>
const { data: settings } = await useFetch('/api/settings')

const siteTitle = settings.value?.siteTitle || 'LLM Human Agent'
const siteSubtitle = settings.value?.siteSubtitle || 'A human-in-the-loop server for OpenAI and Claude compatible calls.'
const siteLogo = settings.value?.siteLogo || '/favicon.ico'
const siteLang = settings.value?.language || 'en'

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'icon', href: siteLogo }
  ],
  htmlAttrs: {
    lang: siteLang
  }
})

useSeoMeta({
  title: siteTitle,
  description: siteSubtitle,
  ogTitle: siteTitle,
  ogDescription: siteSubtitle
})
</script>

<template>
  <UApp>
    <UMain>
      <NuxtPage />
    </UMain>
  </UApp>
</template>
