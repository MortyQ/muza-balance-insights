<script setup lang="ts">
import type { Component } from 'vue';
import DefaultLayout from './DefaultLayout.vue';
import EmptyLayout from './EmptyLayout.vue';
import type { LayoutName } from './types.ts';
import { layoutOf } from './utils.ts';

/** Screens (component names) kept alive across screen changes inside one layout. */
const KEPT_ALIVE = ['HomePage'];

const LAYOUTS: Record<LayoutName, Component> = { default: DefaultLayout, empty: EmptyLayout };
</script>

<template>
  <!--
    The layout comes from the route's meta.layout. The screen goes into the layout's slot rather than a RouterView of its
    own: when the layout changes, the leaving one keeps the old screen for its fade (a RouterView inside it would already
    show the new one). A change of layout fades the whole shell; a change inside one layout fades only the screen (the
    layout's own <Transition>). Every layout and every screen has one root element: a comment or a second node at the
    root is a second root in dev, and the out-in leave never ends.
    KEPT_ALIVE screens stay in memory while another screen of their layout is open: back from a category, home shows its
    blocks at once (with their switches as they were) and refreshes them quietly, instead of loading from empty.
  -->
  <RouterView v-slot="{ Component, route }">
    <Transition name="swap" mode="out-in">
      <component :is="LAYOUTS[layoutOf(route)]" :key="layoutOf(route)">
        <KeepAlive :include="KEPT_ALIVE">
          <component :is="Component" :key="route.name" />
        </KeepAlive>
      </component>
    </Transition>
  </RouterView>
</template>
