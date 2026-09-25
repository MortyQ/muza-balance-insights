<template>
  <RouterView v-slot="{ Component }">
    <Transition name="swap" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
</template>
