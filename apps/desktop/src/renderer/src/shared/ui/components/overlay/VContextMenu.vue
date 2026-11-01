<!-- built on reka-ui (2026-11-01): ContextMenu. Ours, not copied: muzakit has no menu.
     The default slot is the area (one element, rendered as is) that opens the list of actions at the pointer on a
     right click; the keys and the look are VMenu's. No items — the area is shown alone, with no menu. -->
<script setup lang="ts">
import { ContextMenuContent, ContextMenuItem, ContextMenuPortal, ContextMenuRoot, ContextMenuTrigger } from "reka-ui";
import VIcon from "../base/VIcon.vue";
import type { MenuItem } from "./menu";

const { items } = defineProps<{ items: ReadonlyArray<MenuItem> }>();
const emit = defineEmits<{ select: [id: string] }>();
</script>

<template>
  <ContextMenuRoot v-if="items.length > 0">
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuPortal>
      <ContextMenuContent as-child>
        <div class="v-menu">
          <ContextMenuItem v-for="item in items" :key="item.id" class="v-menu__item" @select="emit('select', item.id)">
            <VIcon v-if="item.icon" :icon="item.icon" class="v-menu__item-icon" />
            <span>{{ item.text }}</span>
          </ContextMenuItem>
        </div>
      </ContextMenuContent>
    </ContextMenuPortal>
  </ContextMenuRoot>
  <slot v-else />
</template>

<style lang="scss" scoped>
@use "../../styles/components/overlay/vmenu.scss";
</style>
