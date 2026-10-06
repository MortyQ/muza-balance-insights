<template>
  <div class="h-full">
    <!-- The screen alone (lock, recovery, connect, settings). One root element: see MasterLayout. -->
    <Transition name="swap" mode="out-in">
      <slot />
    </Transition>
  </div>
</template>
